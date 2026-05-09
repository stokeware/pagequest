import { describe, expect, it } from 'vitest'

import {
    clearRateLimitStore,
    consumeRateLimit,
    resetRateLimit,
} from '@/lib/security/rate-limit'

describe('consumeRateLimit', () => {
    it('allows requests until the configured limit is reached', () => {
        clearRateLimitStore()

        expect(
            consumeRateLimit({
                key: 'invite:1',
                maxAttempts: 2,
                now: new Date('2026-05-09T12:00:00.000Z'),
                windowMs: 60_000,
            })
        ).toMatchObject({
            allowed: true,
            remaining: 1,
        })

        expect(
            consumeRateLimit({
                key: 'invite:1',
                maxAttempts: 2,
                now: new Date('2026-05-09T12:00:30.000Z'),
                windowMs: 60_000,
            })
        ).toMatchObject({
            allowed: true,
            remaining: 0,
        })

        expect(
            consumeRateLimit({
                key: 'invite:1',
                maxAttempts: 2,
                now: new Date('2026-05-09T12:00:45.000Z'),
                windowMs: 60_000,
            })
        ).toMatchObject({
            allowed: false,
            remaining: 0,
        })
    })

    it('resets buckets after the window or explicit reset', () => {
        clearRateLimitStore()

        consumeRateLimit({
            key: 'invite:2',
            maxAttempts: 1,
            now: new Date('2026-05-09T12:00:00.000Z'),
            windowMs: 60_000,
        })

        expect(
            consumeRateLimit({
                key: 'invite:2',
                maxAttempts: 1,
                now: new Date('2026-05-09T12:00:20.000Z'),
                windowMs: 60_000,
            }).allowed
        ).toBe(false)

        resetRateLimit('invite:2')

        expect(
            consumeRateLimit({
                key: 'invite:2',
                maxAttempts: 1,
                now: new Date('2026-05-09T12:00:25.000Z'),
                windowMs: 60_000,
            }).allowed
        ).toBe(true)

        expect(
            consumeRateLimit({
                key: 'invite:3',
                maxAttempts: 1,
                now: new Date('2026-05-09T12:00:00.000Z'),
                windowMs: 60_000,
            }).allowed
        ).toBe(true)

        expect(
            consumeRateLimit({
                key: 'invite:3',
                maxAttempts: 1,
                now: new Date('2026-05-09T12:01:01.000Z'),
                windowMs: 60_000,
            }).allowed
        ).toBe(true)
    })
})
