import path from 'node:path'
import react from '@vitejs/plugin-react'
import { serwist } from '@serwist/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    react(),
    // Offline app shell: builds src/sw.js into dist/sw.js with the whole
    // build precached (every lazy route chunk), so Sippd opens offline once
    // installed. Registered by src/lib/offline/serviceWorker.js on the web
    // build only. See OFFLINE.md.
    serwist({
      swSrc: 'src/sw.js',
      swDest: 'sw.js',
      globDirectory: 'dist',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,json,woff2}'],
      // Store-listing screenshots and the like are not part of the shell.
      globIgnores: ['**/screenshots/**'],
      injectionPoint: 'self.__SW_MANIFEST',
      rollupFormat: 'iife',
      disable: Boolean(process.env.VITEST),
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Business-logic tests in /lib are plain functions — no DOM needed, so
  // no jsdom/@testing-library/react dependency. UI-component tests are
  // intentionally out of scope per this project's own testing convention.
  test: {
    environment: 'node',
    // Edge functions run under Node via supabase/functions/_test/harness.js.
    include: ['src/**/*.test.js', 'supabase/functions/**/*.test.js'],
  },
});