import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LogProgressScreen } from '@/app/(competitor)/log-progress/log-progress-screen'

describe('log progress competitor UI', () => {
    it('renders all supported entry types and quest challenge prompts', () => {
        const html = renderToStaticMarkup(
            <LogProgressScreen
                challengeOptions={[
                    {
                        availability: 'REPEATABLE',
                        description:
                            'Read a title recommended by another participant.',
                        evidencePrompt:
                            'Name the recommender and the book title.',
                        id: 'quest-challenge-1',
                        pointsLabel: '25 points',
                        requiresReview: true,
                        title: 'Friend recommendation',
                    },
                ]}
                hasLiveQuest={true}
                participantSummary='Your current quest is live, so this form is ready for book, page, audio, and challenge entries.'
                questParticipantId='participant-1'
                questPolicy={{
                    entryDeleteWindowMinutes: 60,
                    entryEditWindowMinutes: 180,
                    questEndAt: '2026-05-31T23:59:59.000Z',
                    questStartAt: '2026-05-01T00:00:00.000Z',
                    timezone: 'America/Chicago',
                }}
                questName='Spring Story Sprint'
                scoringSummary={{
                    audiobookMinutes: '0.75 points per minute',
                    bookCompletion: '10 points per book',
                    challengeCompletion: '25 points per completion',
                    pagesRead: '1 point per page',
                }}
            />
        )

        expect(html).toContain('Quick entry form')
        expect(html).toContain('Book completion')
        expect(html).toContain('Pages read')
        expect(html).toContain('Audiobook minutes')
        expect(html).toContain('Challenge completion')
        expect(html).toContain('Spring Story Sprint')
        expect(html).toContain('Friend recommendation')
        expect(html).toContain('25 points per completion')
        expect(html).toContain('Manual review')
        expect(html).toContain('Entry policy')
        expect(html).toContain('2026-05-01 through 2026-05-31')
        expect(html).toContain('Finished title')
        expect(html).toContain('Title and author stay optional')
        expect(html).toContain('Edits stay open for 180 minutes')
        expect(html).toContain('Save entry')
    })

    it('renders the empty challenge note when no active challenges exist', () => {
        const html = renderToStaticMarkup(
            <LogProgressScreen
                challengeOptions={[]}
                hasLiveQuest={false}
                participantSummary='No active quest participation is linked to this account yet.'
                questParticipantId={null}
                questPolicy={null}
                questName='Quest assignment pending'
                scoringSummary={{
                    audiobookMinutes: '0.75 points per minute',
                    bookCompletion: '1 point per book',
                    challengeCompletion: '1 point per completion',
                    pagesRead: '1 point per page',
                }}
            />
        )

        expect(html).toContain('Quest assignment pending')
        expect(html).toContain(
            'No active challenges are attached to this quest yet.'
        )
        expect(html).toContain('Quest dates unavailable')
        expect(html).toContain('Save entry')
    })
})
