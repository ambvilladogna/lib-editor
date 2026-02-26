import { join } from "path";

// Paths are relative to the site repo clone
const SITE_REPO_PATH = process.env.SITE_REPO_PATH;
if (!SITE_REPO_PATH) throw new Error("Missing env var: SITE_REPO_PATH");

const DATA_DIR = join(SITE_REPO_PATH, "data");
const BOOKS_PATH = join(DATA_DIR, "books.json");
const CONFIG_PATH = join(DATA_DIR, "config.json");
const BOOKS_REL_PATH = join("data", "books.json");
const CONFIG_REL_PATH = join("data", "config.json");

// ── Types ────────────────────────────────────────────────────────────────────

export interface Book {
  id: number;
  titolo: string;
  volume?: string;
  copie: number;
  autori?: string;
  editore?: string;
  data?: string;
  tags: string[];
  rating?: number;
  note?: string;
}

export interface TagMeta {
  id: string;
  label: string;
  description?: string;
}

export interface RatingMeta {
  value: number;
  label: string;
  description?: string;
}

export interface Config {
  tags: TagMeta[];
  ratings: RatingMeta[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function readJson<T>(path: string): Promise<T> {
  return Bun.file(path).json() as Promise<T>;
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await Bun.write(path, JSON.stringify(data, null, 2) + "\n");
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function readBooks(): Promise<Book[]> {
  return readJson<Book[]>(BOOKS_PATH);
}

export async function writeBooks(books: Book[]): Promise<void> {
  await writeJson(BOOKS_PATH, books);
}

export async function readConfig(): Promise<Config> {
  return readJson<Config>(CONFIG_PATH);
}

export async function writeConfig(config: Config): Promise<void> {
  await writeJson(CONFIG_PATH, config);
}

export function booksPath(): string {
  return BOOKS_REL_PATH;
}

export function configPath(): string {
  return CONFIG_REL_PATH;
}