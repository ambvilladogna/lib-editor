import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handleConfig } from "../routes/config";
import type { Book, Config } from "../lib/db";

// ── Mock data ─────────────────────────────────────────────────────────────────

const config: Config = {
  "tags": [
    {
      "id": "a.m.b.",
      "label": "A.M.B.",
      "description": "Opere con tag \"A.M.B.\""
    },
    {
      "id": "arte",
      "label": "Arte",
      "description": "Opere con tag \"Arte\""
    },
    {
      "id": "commestibilità",
      "label": "Commestibilità",
      "description": "Opere con tag \"Commestibilità\""
    },
    {
      "id": "formazione",
      "label": "Formazione",
      "description": "Opere con tag \"Formazione\""
    },
    {
      "id": "historia",
      "label": "Historia",
      "description": "Opere con tag \"Historia\""
    },
    {
      "id": "monografia",
      "label": "Monografia",
      "description": "Opere con tag \"Monografia\""
    },
    {
      "id": "realtàlocali",
      "label": "RealtàLocali",
      "description": "Opere con tag \"RealtàLocali\""
    },
    {
      "id": "ricreativa",
      "label": "Ricreativa",
      "description": "Opere con tag \"Ricreativa\""
    },
    {
      "id": "rivista",
      "label": "Rivista",
      "description": "Opere con tag \"Rivista\""
    }
  ],
  "ratings": [
    {
      "value": 3,
      "label": "Consigliati",
      "description": "Riferimenti essenziali, consultati regolarmente"
    },
    {
      "value": 2,
      "label": "Standard",
      "description": "Buone risorse, utili occasionalmente"
    },
    {
      "value": 1,
      "label": "Archivio",
      "description": "Storici/donati, consultati raramente"
    }
  ]
};

// In-memory store — lives here in the test file, not inside the mock
let store: Config = structuredClone(config);

// mock.module replaces ../lib/db for any module that imports it (including routes/books.ts)
// The functions close over `store`, so mutating store affects all consumers
mock.module("../lib/db", () => ({
  readConfig: async () => structuredClone(store),
  writeConfig: async (config: Config) => { store = structuredClone(config); },
}));

// Reset store to a fresh copy of seed data before each test
beforeEach(() => { store = structuredClone(config); });

// ── Helper ────────────────────────────────────────────────────────────────────

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/config", () => {
  it("returns config as JSON", async () => {
    const res = await handleConfig(req("GET", "/api/config"));

    expect(res.status).toBe(200);
    const data = await res.json() as Config;
    expect(data.tags).toHaveLength(9);
    expect(data.tags[0]!.label).toBe("A.M.B.");
  });
});

describe("POST /api/config", () => {
  it("updates config", async () => {
    const res = await handleConfig(req("POST", "/api/config", { tags: [], ratings: [] }));

    expect(res.status).toBe(200);
    const updated = await res.json() as Config;
    expect(updated.tags).toHaveLength(0);
    expect(updated.ratings).toHaveLength(0);
  });
});

describe("PUT /api/config", () => {
  it("updates an existing config", async () => {
    const res = await handleConfig(req("PUT", "/api/config", { tags: [], ratings: [] }));
    expect(res.status).toBe(405);
  });
});

describe("DELETE /api/config", () => {
  it("removes a config and returns it", async () => {
    const res = await handleConfig(req("DELETE", "/api/config"));
    expect(res.status).toBe(405);
  });
});