import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Keep worker-relative Wasm URLs intact, and serve the same files in dev and
// production. Compiler asset requests never carry student source.
export function wasmAssets(): Plugin {
  const root = path.resolve(__dirname, "..");
  const directories = [
    ["/runner-assets/", path.join(root, "node_modules/@wasm-oj/browser/dist/assets")],
    ...["clang", "python", "javascript", "java"].map(name =>
      ["/toolchains/", path.join(root, `node_modules/@wasm-oj/toolchain-${name}/assets`)]),
  ];
  let outDir = "";
  return {
    name: "browser-compiler-assets",
    enforce: "pre",
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/@wasm-oj/browser/dist/index.js")) {
        return code.replaceAll('new URL(`assets/', 'new URL(`/runner-assets/');
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        for (const [prefix, directory] of directories) {
          if (!pathname.startsWith(prefix)) continue;
          const name = pathname.slice(prefix.length);
          if (!name || name.includes("/") || name.includes("..")) continue;
          const file = path.join(directory, name);
          if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
          res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : name.endsWith(".js") || name.endsWith(".mjs") ? "text/javascript" : name.endsWith(".json") ? "application/json" : "application/octet-stream");
          res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          fs.createReadStream(file).pipe(res);
          return;
        }
        next();
      });
    },
    closeBundle() {
      for (const [prefix, directory] of directories) {
        const destination = path.join(outDir, prefix);
        fs.mkdirSync(destination, { recursive: true });
        fs.cpSync(directory, destination, { recursive: true });
      }
      // Ship the license notices alongside the binary distributions.
      for (const name of ["browser", "toolchain-clang", "toolchain-python", "toolchain-javascript", "toolchain-java"]) {
        const source = path.join(root, "node_modules/@wasm-oj", name);
        const target = path.join(outDir, "toolchain-licenses", name);
        fs.mkdirSync(target, { recursive: true });
        for (const entry of ["LICENSE", "THIRD_PARTY_NOTICES.md", "licenses"]) {
          if (fs.existsSync(path.join(source, entry))) fs.cpSync(path.join(source, entry), path.join(target, entry), { recursive: true });
        }
      }
    },
  };
}
