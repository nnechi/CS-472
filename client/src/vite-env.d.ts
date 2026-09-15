/// <reference types="vite/client" />

// Type our custom environment variables for autocomplete + safety.
interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
