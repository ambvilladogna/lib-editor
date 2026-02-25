import serveStatic from "serve-static-bun";
import { handleBooks } from "./routes/books";
import { handleConfig } from "./routes/config";
import { handleSync } from "./routes/sync";
import { pull } from "./lib/git";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ── Startup pull ──────────────────────────────────────────────────────────────
// Pull from remote before accepting any requests so the editor always starts
// on up-to-date data. A non-fast-forward failure is logged prominently but
// does not prevent the server from starting — the operator can resolve
// conflicts externally and restart.

console.log("Pulling latest changes from remote…");
const startupPull = await pull();
if (startupPull.success) {
  console.log("Repository is up to date.");
} else {
  console.error("⚠️  Startup pull failed:", startupPull.error);
  console.error(
    "   The editor will start, but local data may be out of sync with remote."
  );
  console.error("   Resolve conflicts externally and restart the app.");
}

// ── Static file handler ───────────────────────────────────────────────────────

const staticHandler = serveStatic("public");

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // ── API routes ────────────────────────────────────────────────────────────
    if (url.pathname.startsWith("/api/books")) {
      return handleBooks(req).catch(apiError);
    }

    if (url.pathname === "/api/config") {
      return handleConfig(req).catch(apiError);
    }

    if (url.pathname.startsWith("/api/sync")) {
      return handleSync(req).catch(apiError);
    }

    // ── Static files (public/) ────────────────────────────────────────────────
    return staticHandler(req);
  },
});

function apiError(err: unknown): Response {
  console.error("[API error]", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return Response.json({ error: message }, { status: 500 });
}

console.log(`Server running on http://localhost:${PORT}`);