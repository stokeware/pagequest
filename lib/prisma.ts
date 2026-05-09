import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const localDatabaseUrl =
    'postgresql://pagequest:pagequest@127.0.0.1:5433/pagequest?schema=public'

type GlobalPrismaState = typeof globalThis & {
    __pageQuestPgPool?: Pool
    __pageQuestPrisma?: PrismaClient
}

const globalForPrisma = globalThis as GlobalPrismaState

const pool =
    globalForPrisma.__pageQuestPgPool ??
    new Pool({
        connectionString: process.env.DATABASE_URL ?? localDatabaseUrl,
    })

const prisma =
    globalForPrisma.__pageQuestPrisma ??
    new PrismaClient({
        adapter: new PrismaPg(pool),
    })

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__pageQuestPgPool = pool
    globalForPrisma.__pageQuestPrisma = prisma
}

export { prisma }
