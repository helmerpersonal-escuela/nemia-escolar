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
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png', 'brand/*.svg'],
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
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo el código de la app (incluidas las pantallas de carga diferida) queda guardado.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,mp3}'],
        // Al tocar un aviso se abre la conversación (y queda listo para avisos con la app cerrada)
        importScripts: ['/sw-avisos.js'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Las páginas se piden primero al servidor (así un enlace nuevo, como una invitación, abre la
        // versión más reciente). Sin señal o si tarda más de 3 s, se usa la copia guardada.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        // La versión nueva entra en cuanto se descarga (sin esperar a cerrar todas las pestañas)
        skipWaiting: true,
        clientsClaim: true,
        // Nunca se guardan en caché las llamadas a Supabase: los datos offline los maneja la app (IndexedDB).
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate' && !/^\/(functions|rest|auth)\//.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20 },
              precacheFallback: { fallbackURL: '/index.html' },
            },
          },
          {
            // Catálogo de estados, municipios y colonias: se guarda al primer uso para funcionar sin señal
            urlPattern: ({ url }) => url.pathname.startsWith('/geo/') && url.pathname.endsWith('.json'),
            handler: 'CacheFirst',
            options: { cacheName: 'geo-mx-v2', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
          {
            // Mosaicos del mapa (OpenStreetMap): los últimos vistos quedan disponibles sin conexión
            urlPattern: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
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
