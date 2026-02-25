import serveStatic from "serve-static-bun";
import { handleBooks } from "./routes/books";
import { handleConfig } from "./routes/config";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Static file handler (fallback for non-API requests)
const staticHandler = serveStatic("public");

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // ── API routes ──────────────────────────────────────────────────────────
    if (url.pathname.startsWith("/api/books")) {
      return handleBooks(req).catch(apiError);
    }

    if (url.pathname === "/api/config") {
      return handleConfig(req).catch(apiError);
    }

    // ── Static files (public/) ──────────────────────────────────────────────
    return staticHandler(req);
  },
});

function apiError(err: unknown): Response {
  console.error("[API error]", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return Response.json({ error: message }, { status: 500 });
}

console.log(`Server running on http://localhost:${PORT}`);