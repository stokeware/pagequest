import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const localDatabaseUrl =
    'postgresql://pagequest:pagequest@127.0.0.1:5433/pagequest?schema=public'

const legacySslModeAliases = new Set(['prefer', 'require', 'verify-ca'])

function normalizeConnectionString(connectionString: string) {
    try {
        const url = new URL(connectionString)

        if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
            return connectionString
        }

        if (url.searchParams.get('uselibpqcompat') === 'true') {
            return connectionString
        }

        const sslMode = url.searchParams.get('sslmode')

        if (!sslMode || !legacySslModeAliases.has(sslMode)) {
            return connectionString
        }

        url.searchParams.set('sslmode', 'verify-full')

        return url.toString()
    } catch {
        return connectionString
    }
}

const databaseUrl = normalizeConnectionString(
    process.env.DATABASE_URL ?? localDatabaseUrl
)

type GlobalPrismaState = typeof globalThis & {
    __pageCampaignPgPool?: Pool
    __pageCampaignPrisma?: PrismaClient
}

const globalForPrisma = globalThis as GlobalPrismaState

const pool =
    globalForPrisma.__pageCampaignPgPool ??
    new Pool({
        connectionString: databaseUrl,
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
