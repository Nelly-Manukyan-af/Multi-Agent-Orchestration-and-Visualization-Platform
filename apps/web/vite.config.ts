import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const target = process.env.API_TARGET ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target, ws: true },
      '/runs': target,
      '/agents': target,
      '/models': target,
      '/health': target,
    },
  },
})
