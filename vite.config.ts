import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Stitchify — Cross-Stitch Pattern Maker',
        short_name: 'Stitchify',
        description:
          'Design, convert and track cross-stitch patterns. Turn photos into DMC charts and follow your progress stitch by stitch.',
        theme_color: '#3d5a6c',
        background_color: '#3d5a6c',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Take over immediately on install — don't wait for all tabs to close
        skipWaiting: true,
        clientsClaim: true,
        // Clean up old caches from previous SW versions
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
