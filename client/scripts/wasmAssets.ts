import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";

// Keep worker-relative Wasm URLs intact, and serve the same files in dev and
// production. Compiler asset requests never carry student source.
export function wasmAssets(): Plugin {
  const root = path.resolve(__dirname, "..");
  const packages = ["browser", "toolchain-clang", "toolchain-python", "toolchain-javascript", "toolchain-java"];
  // The asset file names never change between releases, so the URLs carry the
  // installed package versions. A browser holding an older copy (for example
  // one cached before CORS headers were sent) then requests a new URL instead
  // of reusing the stale response.
  const version = createHash("sha256").update(packages.map(name => {
    const manifest = path.join(root, "node_modules/@wasm-oj", name, "package.json");
    return `${name}@${fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")).version : "missing"}`;
  }).join(",")).digest("hex").slice(0, 12);
  const directories = [
    [`/runner-assets/${version}/`, path.join(root, "node_modules/@wasm-oj/browser/dist/assets")],
    ...["clang", "python", "javascript", "java"].map(name =>
      [`/toolchains/${version}/`, path.join(root, `node_modules/@wasm-oj/toolchain-${name}/assets`)]),
  ];
  let outDir = "";
  return {
    name: "browser-compiler-assets",
    enforce: "pre",
    config: () => ({ define: { "import.meta.env.VITE_WASM_ASSETS_VERSION": JSON.stringify(version) } }),
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    transform(code, id) {
      if (id.split("?")[0].replaceAll("\\", "/").endsWith("/@wasm-oj/browser/dist/index.js")) {
        // Resolve against the page, not import.meta.url, so Vite's own
        // new URL(..., import.meta.url) handling leaves the path alone.
        return code.replace(/new URL\(`assets\/([^`]+)`,\s*import\.meta\.url\)/g,
          (_match, name) => `new URL(${JSON.stringify(`/runner-assets/${version}/${name}`)}, globalThis.location.href)`);
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
          res.setHeader("Access-Control-Allow-Origin", "*");
          // Revalidate rather than trust a copy forever; the versioned URL already
          // changes whenever the packages do.
          res.setHeader("Cache-Control", "no-cache");
          fs.createReadStream(file).pipe(res);
          return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      // Built copies are served statically; add the same CORS header to them.
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        if (directories.some(([prefix]) => pathname.startsWith(prefix))) res.setHeader("Access-Control-Allow-Origin", "*");
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
      for (const name of packages) {
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
