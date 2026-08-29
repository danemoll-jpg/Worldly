import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The manifest itself (name, icons, colors, display mode) is already hand-authored at
      // public/manifest.json and linked directly from index.html (that's what makes "Add to
      // Home Screen" work today, no service worker needed for that part) — this plugin is only
      // adding the service worker on top, so it must NOT also generate/inject a second manifest.
      manifest: false,
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        // Explicitly listing what to precache (rather than a broad glob) is deliberate: the app
        // shell (built JS/CSS, index.html, the icons) is small and essential, so it's worth
        // force-downloading at install time. The map/flag data under public/data is NOT in this
        // list on purpose — see the runtimeCaching rule below for why.
        globPatterns: ['assets/*.{js,css}', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
        // Offline access to the app itself (any route, since this SPA has no server-side
        // routing) falls back to the cached shell.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // countries-10m.json, us-states-10m.json, water-body-regions.json — the actual map
            // geometry. ~4MB combined, and world-atlas's countries-10m.json alone is 3.6MB.
            urlPattern: /\/data\/[^/]+\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'worldly-map-data',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Country and US-state flag SVGs — ~9.4MB combined across all of them. Between this
            // and the map data above, that's roughly 13MB total that would otherwise force onto
            // every first visit (including on cellular) for a whole quiz's worth of flags most
            // people won't even see in one sitting. CacheFirst here means each one is fetched
            // from network (and cached) the first time it's actually needed, so the app becomes
            // properly usable offline after you've played it once — the realistic PWA offline
            // promise — without a slow or data-hungry install.
            urlPattern: /\/data\/flags\/.*\.svg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'worldly-flags',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/sounds\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'worldly-sounds',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
