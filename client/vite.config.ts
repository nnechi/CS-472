import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so the container is reachable from your host
    port: 5173,
    watch: {
      // File-change events don't always cross the Docker boundary on
      // Windows/macOS. Polling is a reliable (if slightly heavier) fallback.
      usePolling: true,
    },
  },
});
