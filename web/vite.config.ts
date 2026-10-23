import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      // Set CHOKIDAR_USEPOLLING=true if hot reload misses changes inside Docker
      watch: { usePolling: env.CHOKIDAR_USEPOLLING === 'true' },
      // Same-origin API calls in dev: the browser talks to :5173, Vite forwards to Laravel.
      // This keeps Sanctum's session + XSRF cookies first-party with zero CORS setup.
      proxy: {
        '/api': { target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000', changeOrigin: true },
        '/sanctum': { target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000', changeOrigin: true },
      },
    },
  }
})
