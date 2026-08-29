import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeSkin } from './src/theme/skins.js'

const frontendRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, 'VITE_')
  const skin = normalizeSkin(env.VITE_SKIN)

  return {
    envDir: frontendRoot,
    plugins: [
      react(),
      {
        name: 'html-skin',
        transformIndexHtml(html) {
          return html.replace(/data-env-skin="[^"]*"/, `data-env-skin="${skin}"`)
        },
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
