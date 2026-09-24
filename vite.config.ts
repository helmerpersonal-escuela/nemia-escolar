import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // App instalable que abre sin conexión (solo versión web; Capacitor ya empaqueta los archivos).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // se registra desde src/lib/offline/registerSW.ts
      includeAssets: ['logo-nemia.png', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'Vunlek — Gestión Escolar',
        short_name: 'Vunlek',
        description: 'Planeación, asistencia y evaluación para docentes',
        lang: 'es-MX',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // Todo el código de la app (incluidas las pantallas de carga diferida) queda guardado.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/functions\//, /^\/rest\//, /^\/auth\//],
        cleanupOutdatedCaches: true,
        // Nunca se guardan en caché las llamadas a Supabase: los datos offline los maneja la app (IndexedDB).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
    }),
  ],
  base: '/',
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        // Librerías base en archivos propios: cambian poco, así que el navegador
        // las conserva en caché entre publicaciones de la app.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
})
