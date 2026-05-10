import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
    calculateProgressRowPoints,
    getAvailableProgressChallenges,
    LogProgressScreen,
    type ProgressRow,
} from '@/app/(competitor)/log-progress/log-progress-screen'

describe('log progress competitor UI', () => {
    it('renders the redesigned challenges tab with personal fields and achieved rows', () => {
        const html = renderToStaticMarkup(
            <LogProgressScreen
                campaignDateRange='May 12 - August 15'
                campaignChallenges={[
                    {
                        achieved: true,
                        id: 'campaign-challenge-1',
                        pointValue: 25,
                        pointsLabel: '25 points',
                        title: 'Friend recommendation',
                    },
                    {
                        achieved: false,
                        id: 'campaign-challenge-2',
                        pointValue: 40,
                        pointsLabel: '40 points',
                        title: 'Epic page turner',
                    },
                ]}
                campaignParticipantId='participant-1'
                campaignName='Spring Story Sprint'
                initialActiveTab='challenges'
                progressScoring={{
                    pointsPerMinute: 0.75,
                    pointsPerPage: 1,
                }}
                workspaceState={{
                    epicReadTitle: '',
                    progressRows: [],
                    recommendationTitle: '',
                }}
            />
        )

        expect(html).toContain('Spring Story Sprint')
        expect(html).toContain('May 12 - August 15')
        expect(html).toContain('Challenges')
        expect(html).toContain('Progress')
        expect(html).toContain('Recommendation Challenge (For Others)')
        expect(html).toContain('Epic Read Challenge (For Myself)')
        expect(html).toContain('Save changes')
        expect(html).toContain('Friend recommendation')
        expect(html).toContain('Epic page turner')
        expect(html).toContain('25 points')
        expect(html).toContain('40 points')
        expect(html).toContain('Achieved')
        expect(html).toContain('✓')
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
                    pointsPerMinute: 0.75,
                    pointsPerPage: 1,
                }}
                workspaceState={{
                    epicReadTitle: '',
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
                        id: 'campaign-challenge-1',
                        pointValue: 25,
                        pointsLabel: '25 points',
                        title: 'Friend recommendation',
                    },
                    {
                        achieved: false,
                        id: 'campaign-challenge-2',
                        pointValue: 40,
                        pointsLabel: '40 points',
                        title: 'Epic page turner',
                    },
                ]}
                campaignParticipantId='participant-1'
                campaignName='Spring Story Sprint'
                progressScoring={{
                    pointsPerMinute: 0.75,
                    pointsPerPage: 1,
                }}
                workspaceState={{
                    epicReadTitle: '',
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
        expect(html).toContain('Delete')
    })

    it('filters challenge choices by row assignments and the own recommendation rule', () => {
        const progressRows: ProgressRow[] = [
            {
                bookName: 'Shared pick',
                challengeId: 'campaign-challenge-2',
                completed: false,
                id: 'progress-row-1',
                minutes: '20',
                pages: '10',
            },
            {
                bookName: 'My favorite recommendation',
                challengeId: '',
                completed: false,
                id: 'progress-row-2',
                minutes: '',
                pages: '',
            },
        ]

        const availableChallenges = getAvailableProgressChallenges({
            campaignChallenges: [
                {
                    achieved: false,
                    id: 'campaign-challenge-1',
                    pointValue: 25,
                    pointsLabel: '25 points',
                    title: 'Friend recommendation',
                },
                {
                    achieved: false,
                    id: 'campaign-challenge-2',
                    pointValue: 40,
                    pointsLabel: '40 points',
                    title: 'Epic page turner',
                },
                {
                    achieved: false,
                    id: 'campaign-challenge-3',
                    pointValue: 15,
                    pointsLabel: '15 points',
                    title: 'Library visit',
                },
            ],
            progressRows,
            recommendationTitle: 'My favorite recommendation',
            rowId: 'progress-row-2',
        })

        expect(availableChallenges.map((challenge) => challenge.title)).toEqual(
            ['Library visit']
        )
    })

    it('calculates progress row points from pages, minutes, and completed challenge points', () => {
        const totalPoints = calculateProgressRowPoints({
            campaignChallenges: [
                {
                    achieved: false,
                    id: 'campaign-challenge-1',
                    pointValue: 25,
                    pointsLabel: '25 points',
                    title: 'Friend recommendation',
                },
            ],
            pointsPerMinute: 0.75,
            pointsPerPage: 1,
            row: {
                bookName: 'A long read',
                challengeId: 'campaign-challenge-1',
                completed: true,
                id: 'progress-row-1',
                minutes: '20',
                pages: '10',
            },
        })

        expect(totalPoints).toBe(50)
    })
})
