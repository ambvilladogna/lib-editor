import { readConfig, writeConfig, type Config } from "../lib/db";

export async function handleConfig(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/api/config") {
    const config = await readConfig();
    return Response.json(config);
  }

  if (req.method === "POST" && url.pathname === "/api/config") {
    const body = (await req.json()) as Config;
    await writeConfig(body);
    return Response.json(body, { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
}