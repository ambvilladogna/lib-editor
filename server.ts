import serveStatic from "serve-static-bun";

Bun.serve({
    fetch: serveStatic("public")
});

console.log(`Server running`);
