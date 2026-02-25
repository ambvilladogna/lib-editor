import type { PullResult } from "../lib/git";

// The startup pull result is set once by server.ts before any requests arrive.
// Routes can read it via getStartupStatus().
let startupStatus: (PullResult & { checked: boolean }) = { checked: false, success: false };

export function setStartupStatus(result: PullResult): void {
  startupStatus = { checked: true, ...result };
}

export function handleStatus(req: Request): Response {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/api/status") {
    return Response.json(startupStatus);
  }

  return new Response("Not found", { status: 404 });
}