import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    // In dev, forward /api/* to `vercel dev` running on port 3000.
    // Run: vercel dev (terminal 1) + npm run dev (terminal 2)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Aisle',
        short_name: 'Aisle',
        description: 'Smart grocery list',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: '/favicon.png', sizes: '32x32', type: 'image/png' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '1024x1024', type: 'image/png', purpose: 'any maskable' },
        ]
      }
    })
  ]
})
