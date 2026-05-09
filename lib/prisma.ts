import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const localDatabaseUrl =
    'postgresql://pagequest:pagequest@127.0.0.1:5433/pagequest?schema=public'

type GlobalPrismaState = typeof globalThis & {
    __pageCampaignPgPool?: Pool
    __pageCampaignPrisma?: PrismaClient
}

const globalForPrisma = globalThis as GlobalPrismaState

const pool =
    globalForPrisma.__pageCampaignPgPool ??
    new Pool({
        connectionString: process.env.DATABASE_URL ?? localDatabaseUrl,
    })

const prisma =
    globalForPrisma.__pageCampaignPrisma ??
    new PrismaClient({
        adapter: new PrismaPg(pool),
    })

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__pageCampaignPgPool = pool
    globalForPrisma.__pageCampaignPrisma = prisma
}

export { prisma }
