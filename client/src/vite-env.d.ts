/// <reference types="vite/client" />

// Type our custom environment variables for autocomplete + safety.
interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  // Set by the browser-compiler-assets Vite plugin.
  readonly VITE_WASM_ASSETS_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
