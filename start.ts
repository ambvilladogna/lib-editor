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

// NOTE: On Windows, "cmd /c start" requires an empty string as the window
// title before the URL — otherwise "http://..." is parsed as the title and
// the actual URL is silently dropped.
const opener: string[] =
  process.platform === "win32"  ? ["cmd", "/c", "start", "", url] :
  process.platform === "darwin" ? ["open", url]                   :
                                  ["xdg-open", url];               // Linux / WSL

spawn(opener);

// Mirror server exit code so the launcher exits cleanly after /api/quit
server.exited.then((code) => process.exit(code));

// Forward Ctrl-C / SIGTERM so the child also stops
function shutdown() { server.kill(); process.exit(0); }
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);