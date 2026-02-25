import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handleBooks } from "../routes/books";
import type { Book } from "../lib/db";

// ── Mock data ─────────────────────────────────────────────────────────────────

const seedBooks: Book[] = [
  { id: 1, titolo: "Fungi d'Europa", volume: "Vol. 1", copie: 1, autori: "Eyssartier", editore: "Springer", data: "2011", tags: ["A.M.B."], rating: 3, note: "" },
  { id: 2, titolo: "Guida ai Funghi", volume: "", copie: 2, autori: "Pieri", editore: "Mondadori", data: "2005", tags: [], rating: 2, note: "" },
];

// In-memory store — lives here in the test file, not inside the mock
let store: Book[] = [];

// mock.module replaces ../lib/db for any module that imports it (including routes/books.ts)
// The functions close over `store`, so mutating store affects all consumers
mock.module("../lib/db", () => ({
  readBooks: async () => structuredClone(store),
  writeBooks: async (books: Book[]) => { store = structuredClone(books); },
}));

// Reset store to a fresh copy of seed data before each test
beforeEach(() => { store = structuredClone(seedBooks); });

// ── Helper ────────────────────────────────────────────────────────────────────

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/books", () => {
  it("returns all books as a JSON array", async () => {
    const res = await handleBooks(req("GET", "/api/books"));

    expect(res.status).toBe(200);
    const data = await res.json() as Book[];
    expect(data).toHaveLength(2);
    expect(data[0]!.titolo).toBe("Fungi d'Europa");
  });
});

describe("POST /api/books", () => {
  it("adds a book and auto-assigns the next id", async () => {
    const res = await handleBooks(req("POST", "/api/books", { titolo: "Micologia Applicata", rating: 2, tags: ["Monografia"], copie: 3, autori: "Pacioni", editore: "Edagricole", data: "2018", note: "" }));

    expect(res.status).toBe(201);
    const created = await res.json() as Book;
    expect(created.id).toBe(3);        // max(1, 2) + 1
    expect(created.titolo).toBe("Micologia Applicata");
  });
});

describe("PUT /api/books/:id", () => {
  it("updates an existing book", async () => {
    const res = await handleBooks(req("PUT", "/api/books/1", { rating: 1 }));

    expect(res.status).toBe(200);
    const updated = await res.json() as Book;
    expect(updated.rating).toBe(1);
    expect(updated.titolo).toBe("Fungi d'Europa"); // other fields preserved
  });

  it("returns 404 for an unknown id", async () => {
    const res = await handleBooks(req("PUT", "/api/books/999", { rating: 1 }));
    expect(res.status).toBe(404);
  });

  it("cannot override id via body", async () => {
    const res = await handleBooks(req("PUT", "/api/books/1", { id: 99, titolo: "Renamed" }));
    const updated = await res.json() as Book;
    expect(updated.id).toBe(1);
  });
});

describe("DELETE /api/books/:id", () => {
  it("removes a book and returns it", async () => {
    const res = await handleBooks(req("DELETE", "/api/books/2"));

    expect(res.status).toBe(200);
    const removed = await res.json() as Book;
    expect(removed.id).toBe(2);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await handleBooks(req("DELETE", "/api/books/999"));
    expect(res.status).toBe(404);
  });
});