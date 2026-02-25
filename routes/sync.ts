import { status, pull, push } from "../lib/git";

export async function handleSync(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // GET /api/sync/status — local git state (no network, no fetch)
  if (req.method === "GET" && url.pathname === "/api/sync/status") {
    const s = await status();
    return Response.json(s);
  }

  // POST /api/sync/pull — fetch + ff-only pull
  if (req.method === "POST" && url.pathname === "/api/sync/pull") {
    const result = await pull();
    return Response.json(result, { status: result.success ? 200 : 409 });
  }

  // POST /api/sync/push — commit data files, pull, push
  if (req.method === "POST" && url.pathname === "/api/sync/push") {
    const body = (await req.json()) as { message?: string };
    const message = body.message?.trim() || "Update catalogue";
    const result = await push(message);
    return Response.json(result, { status: result.success ? 200 : 409 });
  }

  return new Response("Not found", { status: 404 });
}