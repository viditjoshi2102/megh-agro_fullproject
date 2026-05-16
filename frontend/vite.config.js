import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['megh-logo.jpg', 'pwa-icon.svg'],

      manifest: {
        name: 'Megh Agro Equipment',
        short_name: 'Megh Agro',
        description: 'Field Sales & Proforma Invoice Management',
        theme_color: '#163082',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: 'megh-logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any',
          },
        ],
      },

      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,ico,woff,woff2}'],
        navigateFallback: null,
        offlineGoogleAnalytics: false,

        // Runtime caching strategies
        runtimeCaching: [
          {
            // API calls — Network first, fall back to cache
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24 h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // PDF downloads — Network only (always fresh)
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/'),
            handler: 'NetworkOnly',
          },
        ],
      },

      // Show install prompt automatically
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],

  server: {
    port: 5173,
    proxy: {
      '/api':     { target: 'http://localhost:5000', changeOrigin: true },
      '/storage': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
