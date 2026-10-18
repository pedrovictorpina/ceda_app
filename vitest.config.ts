import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Threads avoid forked workers referencing inaccessible Windows sandbox temp files.
  test: { include: ['tests/**/*.test.ts'], environment: 'node', pool: 'threads' }
})
