export function handleQuit(req: Request): Response {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/api/quit") {
    setTimeout(() => {
      // Delay the quit to ensure the response is sent before the server stops.
      console.log("Closing app...");
      process.exit(0);
    }, 1000);
    return new Response("Server is closing...", { status: 200 });
  }

  return new Response("Not found", { status: 404 });
}