import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/Pokemon-shiny/',
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'app', include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom' },
      },
      {
        extends: true,
        test: { name: 'scripts', include: ['scripts/**/*.test.ts'], environment: 'node' },
      },
    ],
  },
})
