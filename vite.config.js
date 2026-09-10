import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [react()],
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
    include: ['src/**/*.test.js'],
  },
});