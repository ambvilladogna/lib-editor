// build.ts
await Bun.build({
  entrypoints: ["./start.ts"],
  compile: true,
  outfile: "./biblioteca-micologica.exe",
  windows: {
    icon: "./assets/books.ico",
    title: "Biblioteca Micologica",
    publisher: "A.M.B. - Gruppo di Villa d'Ogna",
    version: "1.0.0",
    description: "Applicazione per la gestione della biblioteca micologica",
    copyright: "Copyright 2026 - A.M.B. - Gruppo di Villa d'Ogna",
    hideConsole: true,
  },
});

// from the general build API, for reference:
// await Bun.build({
//   entrypoints: ["./start.ts"],
// 
//   // ── Output ──────────────────────────────────────────────
//   outdir: "./dist",          // used when NOT compiling
//   naming: "[name].[ext]",    // output filename template
// 
//   // ── Compilation (produces a standalone .exe) ─────────────
//   compile: true,             // enable single-binary output
//   // When compile:true, use `outdir` or the --outfile CLI flag.
//   // You can't use both compile:true and splitting:true together.
// 
//   // ── Windows-specific metadata ────────────────────────────
//   windows: {
//     icon: "./assets/books.ico",   // path to your .ico file
// 
//     // These get embedded into the .exe's version info block,
//     // visible in File → Properties → Details in Explorer:
//     title:       "Biblioteca Micologica",
//     description: "Applicazione per la gestione della biblioteca micologica",
//     publisher:   "A.M.B. - Gruppo di Villa d'Ogna",
//     version:     "1.0.0",           // must be semver-ish
//     copyright:   "© 2026 - A.M.B. - Gruppo di Villa d'Ogna",
// 
//     // ── The console window ──────────────────────────────────
//     // true  → hides the black terminal window on launch (GUI apps)
//     // false → keeps it visible (CLI tools, default)
//     hideConsole: true,
//   },
// 
//   // ── Other useful build options ───────────────────────────
//   target: "bun",            // "bun" | "node" | "browser"
//   minify: true,             // shrinks output size
//   sourcemap: "none",        // "none" | "inline" | "external"
// 
//   define: {
//     "process.env.NODE_ENV": JSON.stringify("production"),
//   },
// 
//   external: [],             // packages to exclude from the bundle
// });