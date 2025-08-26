import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // list every API root your app uses
      '/auth': { target: 'http://192.168.13.74:8000', changeOrigin: true },
      '/users': { target: 'http://192.168.13.74:8000', changeOrigin: true },
      '/meta':  { target: 'http://192.168.13.74:8000', changeOrigin: true },
      '/special-referrals': { target: 'http://192.168.13.74:8000', changeOrigin: true },
    },
  },
})
