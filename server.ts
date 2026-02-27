import serveStatic from "serve-static-bun";
import { handleBooks } from "./routes/books";
import { handleConfig } from "./routes/config";
import { handleSync } from "./routes/sync";
import { handleStatus, setStartupStatus } from "./routes/status";
import { pull } from "./lib/git";
import { handleQuit } from "./routes/quit";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ── Startup pull ──────────────────────────────────────────────────────────────
// Pull from remote before accepting any requests so the editor always starts
// on up-to-date data. The result is stored and exposed via GET /api/status so
// the frontend can surface it as a notification instead of a console message.

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

setStartupStatus(startupPull);

// ── Static file handler ───────────────────────────────────────────────────────

const staticHandler = serveStatic("public");

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // ── API routes ────────────────────────────────────────────────────────────
    if (url.pathname === "/api/status") {
      return handleStatus(req);
    }

    if (url.pathname === "/api/quit") {
      return handleQuit(req);
    }

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