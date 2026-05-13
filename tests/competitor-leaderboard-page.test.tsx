import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCompetitorLeaderboardViewModelMock, getRoleAwareSessionMock } =
    vi.hoisted(() => ({
        getCompetitorLeaderboardViewModelMock: vi.fn(),
        getRoleAwareSessionMock: vi.fn(),
    }))

vi.mock('@/lib/auth/session', () => ({
    getRoleAwareSession: getRoleAwareSessionMock,
}))

vi.mock('@/lib/competitor-leaderboard', () => ({
    defaultCompetitorLeaderboardViewModel: {
        hasQuest: false,
        highlights: [],
        campaignDescription: 'No leaderboard yet.',
        campaignDateRange: null,
        campaignName: 'Campaign assignment pending',
        campaignStatusLabel: 'Awaiting invitation',
        rows: [],
    },
    getCompetitorLeaderboardViewModel: getCompetitorLeaderboardViewModelMock,
}))

import LeaderboardPage from '@/app/(competitor)/leaderboard/page'

describe('competitor leaderboard page', () => {
    beforeEach(() => {
        getRoleAwareSessionMock.mockReset()
        getCompetitorLeaderboardViewModelMock.mockReset()
    })

    it('renders the current campaign heading and date range above standings', async () => {
        getRoleAwareSessionMock.mockResolvedValue({
            isAuthorized: true,
            userId: 'user-1',
        })
        getCompetitorLeaderboardViewModelMock.mockResolvedValue({
            hasQuest: true,
            highlights: [],
            campaignDescription:
                'Spring Story Sprint is ordered by points first.',
            campaignDateRange: 'April 20 - May 20',
            campaignName: 'Spring Story Sprint',
            campaignStatusLabel: 'Active leaderboard',
            rows: [
                {
                    activityLabel: 'Last activity May 8, 2026.',
                    isViewer: true,
                    metricsLabel:
                        '350 pages • 120 minutes • 4 books • 2 challenges',
                    participantHref: '/leaderboard/participant-1',
                    participantId: 'participant-1',
                    pointsLabel: '450 points',
                    rankLabel: '#1',
                    readerLabel: 'Avery',
                },
            ],
        })

        const html = renderToStaticMarkup(await LeaderboardPage())

        expect(html).toContain('Spring Story Sprint')
        expect(html).toContain('April 20 - May 20')
        expect(html).toContain('Avery')
        expect(html).toContain('450 points')
        expect(html).toContain('bg-(--surface-highlight)')
        expect(html).not.toContain('Your row')
    })
})
