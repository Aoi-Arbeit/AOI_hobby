import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':      { target: 'http://localhost:8000', changeOrigin: true },
      '/account':   { target: 'http://localhost:8000', changeOrigin: true },
      '/rates':     { target: 'http://localhost:8000', changeOrigin: true },
      '/orders':    { target: 'http://localhost:8000', changeOrigin: true },
      '/positions': { target: 'http://localhost:8000', changeOrigin: true },
      '/trades':    { target: 'http://localhost:8000', changeOrigin: true },
      '/stats':       { target: 'http://localhost:8000', changeOrigin: true },
      '/economic':    { target: 'http://localhost:8000', changeOrigin: true },
      '/annotations': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':          { target: 'ws://localhost:8000', ws: true },
    },
  },
})
