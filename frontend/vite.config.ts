import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const BACKEND = env.VITE_BACKEND_PROXY
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('xlsx')) return 'xlsx'
            if (id.includes('html2canvas')) return 'html2canvas'
            if (id.includes('JsBarcode') || id.includes('jsbarcode')) return 'jsbarcode'
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'charts'
            if (id.includes('@microsoft/signalr')) return 'signalr'
            if (id.includes('react')) return 'react-vendor'
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: BACKEND,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: { '*': '' },
        },
        '/graphql': {
          target: BACKEND,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: { '*': '' },
        },
        '/hubs': {
          target: BACKEND,
          changeOrigin: true,
          secure: true,
          ws: true,
          cookieDomainRewrite: { '*': '' },
        },
      },
    },
  }
})