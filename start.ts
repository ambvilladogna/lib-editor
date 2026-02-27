// start.ts  — cross-platform launcher
import { spawn } from "bun";

const port = process.env.PORT ?? "3000";
const url  = `http://localhost:${port}`;

// Start the actual server as a child process
const server = spawn(["bun", "run", "--hot", "server.ts"], {
  stdout: "inherit", stderr: "inherit", stdin: "inherit",
});

// Give it a moment to bind, then open the browser
await Bun.sleep(800);

const opener =
  process.platform === "win32"  ? ["cmd", "/c", "start", url]  :
  process.platform === "darwin" ? ["open", url]                 :
                                  ["xdg-open", url];             // Linux

spawn(opener);

// Keep the launcher alive so Ctrl-C kills both
process.on("SIGINT",  () => { server.kill(); process.exit(); });
process.on("SIGTERM", () => { server.kill(); process.exit(); });