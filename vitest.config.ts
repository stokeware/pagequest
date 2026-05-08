import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(rootDir),
        },
    },
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
        },
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    },
})
