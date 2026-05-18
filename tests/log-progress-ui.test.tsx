import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerRefreshMock = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: routerRefreshMock,
    }),
}))

import {
    calculateProgressRowPoints,
    getAvailableProgressChallenges,
    LogProgressScreen,
    type ProgressRow,
} from '@/app/(competitor)/log-progress/log-progress-screen'

describe('log progress competitor UI', () => {
    beforeEach(() => {
        routerRefreshMock.mockReset()
    })

    it('renders the redesigned challenges tab with personal fields and achieved rows', () => {
        const html = renderToStaticMarkup(
            <LogProgressScreen
                campaignDateRange='May 12 - August 15'
                campaignChallenges={[
                    {
                        achieved: true,
                        id: 'challenge-1',
                        kind: 'RECOMMENDATION_INSTANCE',
                        ownedByCurrentParticipant: false,
                        pageMinuteMultiplier: 0,
                        pointValue: 25,
                        sourceBookTitle: 'Friend recommendation book',
                        title: 'Friend recommendation',
                    },
                    {
                        achieved: false,
                        id: 'challenge-2',
                        kind: 'PERSONAL_GOAL_INSTANCE',
                        ownedByCurrentParticipant: true,
                        pageMinuteMultiplier: 1.5,
                        pointValue: 40,
                        sourceBookTitle: 'Epic page turner',
                        title: 'Personal Goal',
                    },
                ]}
                campaignParticipantId='participant-1'
                campaignName='Spring Story Sprint'
                initialActiveTab='challenges'
                progressScoring={{
                    pointsPerBook: 0,
                    pointsPerMinute: 0.75,
                    pointsPerPage: 1,
                }}
                workspaceState={{
                    personalGoalTitle: 'Epic page turner',
                    progressRows: [],
                    recommendationTitle: '',
                }}
            />
        )

        expect(html).toContain('Spring Story Sprint')
        expect(html).toContain('May 12 - August 15')
        expect(html).toContain('Challenges')
        expect(html).toContain('Progress')
        expect(html).toContain('Recommendation Book')
        expect(html).toContain('Personal Goal Book')
        expect(html).toContain('Save changes')
        expect(html).toContain('Friend recommendation')
        expect(html).toContain('Personal Goal')
        expect(html).toContain('25')
        expect(html).toContain('1.5')
        expect(html).toContain('Achieved')
        expect(html).toContain('✓')
        expect(html).not.toContain('Campaign changes saved.')
        expect(html).toContain('disabled=""')
    })

    it('renders the empty challenge note when no campaign challenges exist', () => {
        const html = renderToStaticMarkup(
            <LogProgressScreen
                campaignDateRange={null}
                campaignChallenges={[]}
                campaignParticipantId={null}
                campaignName='Campaign assignment pending'
                initialActiveTab='challenges'
                progressScoring={{
                    pointsPerBook: 0,
                    pointsPerMinute: 0.75,
                    pointsPerPage: 1,
                }}
                workspaceState={{
                    personalGoalTitle: '',
                    progressRows: [],
                    recommendationTitle: '',
                }}
            />
        )

        expect(html).toContain('Campaign assignment pending')
        expect(html).toContain(
            'No active challenges are attached to this campaign yet.'
        )
        expect(html).toContain('Save changes')
    })

    it('renders the editable progress table when the progress tab is active', () => {
        const html = renderToStaticMarkup(
            <LogProgressScreen
                campaignDateRange='May 12 - August 15'
                campaignChallenges={[
                    {
                        achieved: false,
                        id: 'challenge-1',
                        kind: 'RECOMMENDATION_INSTANCE',
                        ownedByCurrentParticipant: false,
                        pageMinuteMultiplier: 0,
                        pointValue: 25,
                        sourceBookTitle: 'Friend recommendation book',
                        title: 'Friend recommendation',
                    },
                    {
                        achieved: false,
                        id: 'challenge-2',
                        kind: 'PERSONAL_GOAL_INSTANCE',
                        ownedByCurrentParticipant: true,
                        pageMinuteMultiplier: 2,
                        pointValue: 0,
                        sourceBookTitle: 'Epic page turner',
                        title: 'Personal Goal',
                    },
                ]}
                campaignParticipantId='participant-1'
                campaignName='Spring Story Sprint'
                progressScoring={{
                    pointsPerBook: 0,
                    pointsPerMinute: 0.75,
                    pointsPerPage: 1,
                }}
                workspaceState={{
                    personalGoalTitle: 'Epic page turner',
                    progressRows: [],
                    recommendationTitle: '',
                }}
            />
        )

        expect(html).toContain('Book name')
        expect(html).toContain('Pages')
        expect(html).toContain('Minutes')
        expect(html).toContain('Completed')
        expect(html).toContain('Challenge')
        expect(html).toContain('Points')
        expect(html).toContain('0')
        expect(html).toContain('New Book')
        expect(html).toContain('Save Changes')
        expect(html).toContain('aria-label="Progress entries"')
        expect(html).toContain('Personal goal entry')
        expect(html).toContain('aria-label="Scrollable progress table"')
        expect(html).toContain(
            'Save changes stays below each entry on smaller screens so it remains reachable.'
        )
        expect(html).toContain('Delete')
        expect(html).toContain(
            'aria-label="Challenge progress-row-personal-goal"'
        )
        expect(html).toContain('disabled=""')
        expect(html).toContain(
            '<option value="challenge-2" selected="">Personal Goal</option>'
        )
    })

    it('sorts challenge choices like the challenges table and hides own recommendation and personal goal', () => {
        const progressRows: ProgressRow[] = [
            {
                bookName: 'Shared pick',
                challengeId: 'challenge-5',
                completed: false,
                id: 'progress-row-1',
                minutes: '20',
                pages: '10',
                rowType: 'STANDARD',
            },
            {
                bookName: 'My favorite recommendation',
                challengeId: '',
                completed: false,
                id: 'progress-row-2',
                minutes: '',
                pages: '',
                rowType: 'STANDARD',
            },
        ]

        const availableChallenges = getAvailableProgressChallenges({
            campaignChallenges: [
                {
                    achieved: false,
                    id: 'challenge-1',
                    kind: 'RECOMMENDATION_INSTANCE',
                    ownedByCurrentParticipant: true,
                    pageMinuteMultiplier: 0,
                    pointValue: 25,
                    sourceBookTitle: 'My favorite recommendation',
                    title: "Alice's Recommendation: My favorite recommendation",
                },
                {
                    achieved: false,
                    id: 'challenge-2',
                    kind: 'RECOMMENDATION_INSTANCE',
                    ownedByCurrentParticipant: false,
                    pageMinuteMultiplier: 0,
                    pointValue: 40,
                    sourceBookTitle: 'Other recommendation',
                    title: "Clara's Recommendation: My favorite recommendation",
                },
                {
                    achieved: false,
                    id: 'challenge-3',
                    kind: 'RECOMMENDATION_INSTANCE',
                    ownedByCurrentParticipant: false,
                    pageMinuteMultiplier: 0,
                    pointValue: 15,
                    sourceBookTitle: 'Different book',
                    title: "Bob's Recommendation: Another Book",
                },
                {
                    achieved: false,
                    id: 'challenge-4',
                    kind: 'PERSONAL_GOAL_INSTANCE',
                    ownedByCurrentParticipant: true,
                    pageMinuteMultiplier: 2,
                    pointValue: 0,
                    sourceBookTitle: null,
                    title: 'Personal Goal',
                },
                {
                    achieved: false,
                    id: 'challenge-5',
                    kind: 'ADMIN',
                    ownedByCurrentParticipant: false,
                    pageMinuteMultiplier: 0,
                    pointValue: 15,
                    sourceBookTitle: null,
                    title: 'Library visit',
                },
                {
                    achieved: false,
                    id: 'challenge-6',
                    kind: 'ADMIN',
                    ownedByCurrentParticipant: false,
                    pageMinuteMultiplier: 0,
                    pointValue: 15,
                    sourceBookTitle: null,
                    title: 'Author event',
                },
            ],
            progressRows,
            rowId: 'progress-row-2',
        })

        expect(availableChallenges.map((challenge) => challenge.title)).toEqual(
            [
                "Bob's Recommendation: Another Book",
                "Clara's Recommendation: My favorite recommendation",
                'Author event',
            ]
        )
    })

    it('adds fixed challenge points to base reading points for completed rows', () => {
        const totalPoints = calculateProgressRowPoints({
            campaignChallenges: [
                {
                    achieved: false,
                    id: 'challenge-1',
                    kind: 'ADMIN',
                    ownedByCurrentParticipant: false,
                    pageMinuteMultiplier: 0,
                    pointValue: 25,
                    sourceBookTitle: null,
                    title: 'Friend recommendation',
                },
            ],
            pointsPerBook: 0,
            pointsPerMinute: 0.75,
            pointsPerPage: 1,
            row: {
                bookName: 'A long read',
                challengeId: 'challenge-1',
                completed: true,
                id: 'progress-row-1',
                minutes: '20',
                pages: '10',
                rowType: 'STANDARD',
            },
        })

        expect(totalPoints).toBe(50)
    })

    it('uses the challenge multiplier instead of adding base points again', () => {
        const totalPoints = calculateProgressRowPoints({
            campaignChallenges: [
                {
                    achieved: false,
                    id: 'challenge-1',
                    kind: 'ADMIN',
                    ownedByCurrentParticipant: false,
                    pageMinuteMultiplier: 3,
                    pointValue: 0,
                    sourceBookTitle: null,
                    title: 'Epic read',
                },
            ],
            pointsPerBook: 50,
            pointsPerMinute: 0,
            pointsPerPage: 1,
            row: {
                bookName: 'A long read',
                challengeId: 'challenge-1',
                completed: true,
                id: 'progress-row-1',
                minutes: '0',
                pages: '500',
                rowType: 'STANDARD',
            },
        })

        expect(totalPoints).toBe(1550)
    })

    it('keeps base reading points when the row is not marked complete', () => {
        const totalPoints = calculateProgressRowPoints({
            campaignChallenges: [
                {
                    achieved: false,
                    id: 'challenge-1',
                    kind: 'ADMIN',
                    ownedByCurrentParticipant: false,
                    pageMinuteMultiplier: 3,
                    pointValue: 200,
                    sourceBookTitle: null,
                    title: 'Epic read',
                },
            ],
            pointsPerBook: 50,
            pointsPerMinute: 0,
            pointsPerPage: 1,
            row: {
                bookName: 'A long read',
                challengeId: 'challenge-1',
                completed: false,
                id: 'progress-row-1',
                minutes: '0',
                pages: '400',
                rowType: 'STANDARD',
            },
        })

        expect(totalPoints).toBe(400)
    })
})
