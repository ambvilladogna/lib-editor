import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handleTags } from "../routes/tags";
import type { Book, Config } from "../lib/db";

// ── Mock data ─────────────────────────────────────────────────────────────────

const seedConfig: Config = {
  tags: [
    { id: "monografia", label: "Monografia", description: "Opere monografiche" },
    { id: "rivista",    label: "Rivista",    description: "Pubblicazioni periodiche" },
    { id: "arte",       label: "Arte" },
  ],
  ratings: [
    { value: 3, label: "Consigliati" },
    { value: 2, label: "Standard" },
    { value: 1, label: "Archivio" },
  ],
};

const seedBooks: Book[] = [
  { id: 1, titolo: "Guida ai Funghi",    copie: 1, tags: ["Monografia", "Arte"], rating: 3 },
  { id: 2, titolo: "Bollettino AMB",     copie: 1, tags: ["Rivista"],            rating: 2 },
  { id: 3, titolo: "Micologia Alpina",   copie: 1, tags: ["Monografia"],         rating: 1 },
  { id: 4, titolo: "Senza categorie",    copie: 1, tags: [],                     rating: 1 },
];

let configStore: Config = structuredClone(seedConfig);
let booksStore:  Book[]  = structuredClone(seedBooks);

mock.module("../lib/db", () => ({
  readConfig:  async () => structuredClone(configStore),
  writeConfig: async (c: Config) => { configStore = structuredClone(c); },
  readBooks:   async () => structuredClone(booksStore),
  writeBooks:  async (b: Book[]) => { booksStore = structuredClone(b); },
}));

beforeEach(() => {
  configStore = structuredClone(seedConfig);
  booksStore  = structuredClone(seedBooks);
});

// ── Helper ────────────────────────────────────────────────────────────────────

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── POST /api/tags ────────────────────────────────────────────────────────────

describe("POST /api/tags", () => {
  it("adds a new tag", async () => {
    const res = await handleTags(req("POST", "/api/tags", { label: "Formazione" }));
    expect(res.status).toBe(201);
    const tag = await res.json() as { id: string; label: string };
    expect(tag.label).toBe("Formazione");
    expect(tag.id).toBe("formazione");
    expect(configStore.tags).toHaveLength(4);
  });

  it("auto-slugifies the id from label", async () => {
    const res = await handleTags(req("POST", "/api/tags", { label: "Realtà Locali" }));
    expect(res.status).toBe(201);
    const tag = await res.json() as { id: string };
    expect(tag.id).toBe("realta-locali");
  });

  it("returns 400 when label is missing", async () => {
    const res = await handleTags(req("POST", "/api/tags", { description: "oops" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when id already exists", async () => {
    const res = await handleTags(req("POST", "/api/tags", { label: "Monografia" }));
    expect(res.status).toBe(409);
  });
});

// ── PUT /api/tags/:id ─────────────────────────────────────────────────────────

describe("PUT /api/tags/:id", () => {
  it("renames a tag and cascades to books", async () => {
    const res = await handleTags(req("PUT", "/api/tags/monografia", { label: "Monografie" }));
    expect(res.status).toBe(200);
    const { tag, affectedBooks } = await res.json() as { tag: { label: string }; affectedBooks: number };
    expect(tag.label).toBe("Monografie");
    expect(affectedBooks).toBe(2); // books 1 and 3 had "Monografia"

    // Verify cascade in books store
    expect(booksStore.find(b => b.id === 1)!.tags).toContain("Monografie");
    expect(booksStore.find(b => b.id === 3)!.tags).toContain("Monografie");
    expect(booksStore.find(b => b.id === 1)!.tags).not.toContain("Monografia");
  });

  it("updates description without cascading when label unchanged", async () => {
    const res = await handleTags(req("PUT", "/api/tags/rivista", { label: "Rivista", description: "Nuova desc" }));
    expect(res.status).toBe(200);
    const { affectedBooks } = await res.json() as { affectedBooks: number };
    expect(affectedBooks).toBe(0);
    expect(configStore.tags.find(t => t.id === "rivista")!.description).toBe("Nuova desc");
  });

  it("returns 404 for unknown id", async () => {
    const res = await handleTags(req("PUT", "/api/tags/nonexistent", { label: "X" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when label is empty", async () => {
    const res = await handleTags(req("PUT", "/api/tags/monografia", { label: "  " }));
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/tags/:id ──────────────────────────────────────────────────────

describe("DELETE /api/tags/:id", () => {
  it("removes a tag and strips it from all books", async () => {
    const res = await handleTags(req("DELETE", "/api/tags/monografia"));
    expect(res.status).toBe(200);
    const { removed, affectedBooks } = await res.json() as { removed: { label: string }; affectedBooks: number };
    expect(removed.label).toBe("Monografia");
    expect(affectedBooks).toBe(2);

    expect(configStore.tags).toHaveLength(2);
    expect(booksStore.find(b => b.id === 1)!.tags).not.toContain("Monografia");
    expect(booksStore.find(b => b.id === 3)!.tags).not.toContain("Monografia");
    // Other tags on the same book are untouched
    expect(booksStore.find(b => b.id === 1)!.tags).toContain("Arte");
  });

  it("reports 0 affected books when no book uses the tag", async () => {
    const res = await handleTags(req("DELETE", "/api/tags/arte"));
    const { affectedBooks } = await res.json() as { affectedBooks: number };
    // Only book 1 has "Arte"
    expect(affectedBooks).toBe(1);
  });

  it("returns 404 for unknown id", async () => {
    const res = await handleTags(req("DELETE", "/api/tags/nonexistent"));
    expect(res.status).toBe(404);
  });
});