import { defineConfig } from 'prisma/config'

const localDatabaseUrl =
    'postgresql://pagequest:pagequest@127.0.0.1:5433/pagequest?schema=public'

export default defineConfig({
    datasource: {
        url: process.env.DATABASE_URL ?? localDatabaseUrl,
    },
    migrations: {
        path: 'prisma/migrations',
        seed: 'node prisma/seed.mjs',
    },
    schema: 'prisma/schema.prisma',
})
