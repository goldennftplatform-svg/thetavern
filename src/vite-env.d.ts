/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRAIL_SERVER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
