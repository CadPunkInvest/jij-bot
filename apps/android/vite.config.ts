import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildGradle = readFileSync(resolve(__dirname, 'android/app/build.gradle'), 'utf-8')
const versionMatch = buildGradle.match(/versionName\s+"([^"]+)"/)
const appVersion = versionMatch ? versionMatch[1] : '0.0.0'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_DESIGN_MODE': JSON.stringify(process.env.VITE_DESIGN_MODE ?? 'false'),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true,
  },
})
