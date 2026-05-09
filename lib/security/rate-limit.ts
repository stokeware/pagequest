type RateLimitBucket = {
    count: number
    resetAt: number
}

type RateLimitStore = Map<string, RateLimitBucket>

type RateLimitInput = {
    key: string
    maxAttempts: number
    now?: Date
    windowMs: number
}

export type RateLimitResult = {
    allowed: boolean
    remaining: number
    retryAfterSeconds: number
}

const rateLimitStoreKey = '__pagequestRateLimitStore'

function getRateLimitStore(): RateLimitStore {
    const globalScope = globalThis as typeof globalThis & {
        [rateLimitStoreKey]?: RateLimitStore
    }

    if (!globalScope[rateLimitStoreKey]) {
        globalScope[rateLimitStoreKey] = new Map<string, RateLimitBucket>()
    }

    return globalScope[rateLimitStoreKey]
}

export function consumeRateLimit({
    key,
    maxAttempts,
    now = new Date(),
    windowMs,
}: RateLimitInput): RateLimitResult {
    const rateLimitStore = getRateLimitStore()
    const nowMs = now.getTime()
    const currentBucket = rateLimitStore.get(key)

    if (!currentBucket || currentBucket.resetAt <= nowMs) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: nowMs + windowMs,
        })

        return {
            allowed: true,
            remaining: Math.max(0, maxAttempts - 1),
            retryAfterSeconds: 0,
        }
    }

    if (currentBucket.count >= maxAttempts) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil((currentBucket.resetAt - nowMs) / 1000)
            ),
        }
    }

    currentBucket.count += 1
    rateLimitStore.set(key, currentBucket)

    return {
        allowed: true,
        remaining: Math.max(0, maxAttempts - currentBucket.count),
        retryAfterSeconds: 0,
    }
}

export function clearRateLimitStore() {
    getRateLimitStore().clear()
}

export function resetRateLimit(key: string) {
    getRateLimitStore().delete(key)
}
