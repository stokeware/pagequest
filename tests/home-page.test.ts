import { describe, expect, it } from 'vitest'

import {
    HOME_PAGE_FALLBACK_COUNTDOWN_TARGET,
    selectHomePageCountdownTarget,
} from '@/lib/home-page'

describe('home page countdown target', () => {
    it('selects the nearest future quest start', () => {
        const now = new Date('2026-05-10T12:00:00.000Z')

        expect(
            selectHomePageCountdownTarget(
                [
                    {
                        startAt: new Date('2026-07-01T12:00:00.000Z'),
                    },
                    {
                        startAt: new Date('2026-05-20T12:00:00.000Z'),
                    },
                    {
                        startAt: new Date('2026-05-01T12:00:00.000Z'),
                    },
                ],
                now
            ).toISOString()
        ).toBe('2026-05-20T12:00:00.000Z')
    })

    it('falls back to the fixed countdown date when the quest has started', () => {
        const now = new Date('2026-05-10T12:00:00.000Z')

        expect(
            selectHomePageCountdownTarget(
                [
                    {
                        startAt: new Date('2026-05-01T05:00:00.000Z'),
                    },
                ],
                now
            ).toISOString()
        ).toBe(HOME_PAGE_FALLBACK_COUNTDOWN_TARGET.toISOString())
    })
})
