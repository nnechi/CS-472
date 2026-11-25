import { wasmAssets } from "./scripts/wasmAssets";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [wasmAssets(), react(),
            tailwindcss(),
  ],
  build: mode === "runner-test" ? { rollupOptions: { input: { app: path.resolve(__dirname, "index.html"), runnerTest: path.resolve(__dirname, "tests/runner.html") } } } : {},
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: { exclude: ["@wasm-oj/browser"] },
  preview: { headers: { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp", "Cross-Origin-Resource-Policy": "same-origin" } },
  server: {
    headers: { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp", "Cross-Origin-Resource-Policy": "same-origin" },
    host: true, // listen on 0.0.0.0 so the container is reachable from your host
    port: 5173,
    watch: {
      // File-change events don't always cross the Docker boundary on
      // Windows/macOS. Polling is a reliable (if slightly heavier) fallback.
      usePolling: true,
    },
  },
}));
