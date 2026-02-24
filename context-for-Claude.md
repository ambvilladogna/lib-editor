# Mycological Library Editor — Project Context

## Overview

A **Bun** app to edit the book catalogue of a mycological library.  
The catalogue is stored as JSON files inside a separate GitHub Pages repo (the static website).  
The editor works **directly on a local clone** of that repo — no intermediate copy.

---

## Repositories

| Repo | Purpose |
|------|---------|
| `ambvilladogna/risorse` (GitHub Pages) | Static website — the "deployment target" |
| `editor/` (this project) | Bun app for editing the catalogue |

The two repos are **siblings on disk** (or wherever `SITE_REPO_PATH` points).

---

## Folder Structure

```
project-root/
├── .env                        # environment config (see below)
│
└── editor/
    ├── package.json
    ├── bunfig.toml              # optional Bun config (port, etc.)
    ├── server.ts                # entry point — Bun.serve()
    │
    ├── routes/
    │   ├── books.ts             # CRUD: GET/POST/PUT/DELETE /api/books
    │   ├── config.ts            # GET /api/config  (tags, ratings metadata)
    │   └── sync.ts              # GET /api/sync/status  POST /api/sync/push
    │
    ├── lib/
    │   ├── db.ts                # read/write JSON files in the repo clone
    │   └── git.ts               # thin wrapper around git CLI via Bun.spawn()
    │
    └── public/
        └── index.html           # editor frontend (vanilla JS, no framework)
```

---

## Environment Variables (`.env`)

```env
# Absolute or relative path to the local clone of the GitHub Pages repo
SITE_REPO_PATH=../risorse

# Path to books.json inside that repo
BOOKS_DATA_PATH=biblioteca/_site/data/books.json

# Path to config.json inside that repo
CONFIG_DATA_PATH=biblioteca/_site/data/config.json

# Port for the editor server
PORT=3000
```

---

## Data Files

Both files live inside the GitHub Pages repo clone at the paths above.

**`books.json`** — array of book objects:
```json
{
  "id": 1,
  "titolo": "...",
  "volume": "...",
  "copie": 1,
  "autori": "...",
  "editore": "...",
  "data": "2007",
  "tags": ["A.M.B.", "Monografia"],
  "rating": 3,
  "note": ""
}
```

**`config.json`** — tag and rating metadata:
```json
{
  "tags": [{ "id": "monografia", "label": "Monografia", "description": "..." }],
  "ratings": [{ "value": 3, "label": "Consigliati", "description": "..." }]
}
```

---

## Module Responsibilities

### `server.ts`
- Starts `Bun.serve()` on `PORT`
- Loads `.env` via Bun's built-in env handling
- Routes requests to the appropriate handler in `routes/`
- Serves `public/` as static files

### `lib/db.ts`
- `readBooks(): Book[]` — reads and parses `books.json`
- `writeBooks(books: Book[]): void` — serializes and writes back
- `readConfig(): Config` — reads `config.json`
- Works directly on the repo clone path from env

### `lib/git.ts`
- Wraps `Bun.spawn()` around git CLI commands
- `status(): { clean: boolean, ahead: number, behind: number }` — runs `git status` + `git rev-list` on the repo clone
- `push(commitMessage: string): void` — stages data files, commits, pushes
- All operations scoped to `SITE_REPO_PATH`

### `routes/books.ts`
- `GET /api/books` — return all books
- `POST /api/books` — add a book (auto-assign next id)
- `PUT /api/books/:id` — update a book by id
- `DELETE /api/books/:id` — remove a book by id

### `routes/config.ts`
- `GET /api/config` — return tags and ratings metadata (read-only for now)

### `routes/sync.ts`
- `GET /api/sync/status` — reports if remote is in sync with local files
- `POST /api/sync/push` — commits and pushes current data files to remote

---

## Key Bun Notes (vs Node)

| Node | Bun equivalent |
|------|---------------|
| `require('http')` / Express | `Bun.serve({ fetch(req) {} })` |
| `fs.readFile` / `JSON.parse` | `await Bun.file(path).json()` |
| `fs.writeFile` | `await Bun.write(path, content)` |
| `child_process.spawn` | `Bun.spawn(['git', ...], { cwd })` |
| `dotenv` package | Built-in: Bun auto-loads `.env` |
| `ts-node` | Not needed: `bun run server.ts` runs TS natively |

---

## Development

```bash
cd editor
bun install
bun run --hot server.ts    # hot reload during development
```

---

## Sync Flow (git)

```
[local books.json edited via API]
        ↓
GET /api/sync/status
→ lib/git.ts runs: git status, git diff (on repo clone)
→ returns: { clean: false, changedFiles: ["biblioteca/_site/data/books.json"] }
        ↓
POST /api/sync/push  { message: "Update catalogue" }
→ lib/git.ts runs: git add <data files>, git commit -m "...", git push
→ GitHub Pages rebuilds automatically
```

Auth for push relies on the **local git config** of the machine (SSH key or credential helper) — the app does not manage credentials.

---

## Current Status

> Architecture defined. No code written yet.  
> Next step: scaffold `package.json`, `server.ts`, and `lib/db.ts`.