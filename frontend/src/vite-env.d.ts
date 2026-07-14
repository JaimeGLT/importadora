/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_COOKIE_DOMAIN: string
  readonly VITE_GQL_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}