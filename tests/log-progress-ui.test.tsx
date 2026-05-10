import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LogProgressScreen } from '@/app/(competitor)/log-progress/log-progress-screen'

describe('log progress competitor UI', () => {
    it('renders all supported entry types and campaign challenge prompts', () => {
        const html = renderToStaticMarkup(
            <LogProgressScreen
                challengeOptions={[
                    {
                        id: 'campaign-challenge-1',
                        pointsLabel: '25 points',
                        title: 'Friend recommendation',
                    },
                ]}
                hasLiveQuest={true}
                participantSummary='Your current campaign is live, so this form is ready for book, page, audio, and challenge entries.'
                campaignParticipantId='participant-1'
                campaignPolicy={{
                    entryDeleteWindowMinutes: 60,
                    entryEditWindowMinutes: 180,
                    campaignEndAt: '2026-05-31T23:59:59.000Z',
                    campaignStartAt: '2026-05-01T00:00:00.000Z',
                    timezone: 'America/Chicago',
                }}
                campaignName='Spring Story Sprint'
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
                participantSummary='No active campaign participation is linked to this account yet.'
                campaignParticipantId={null}
                campaignPolicy={null}
                campaignName='Campaign assignment pending'
                scoringSummary={{
                    audiobookMinutes: '0.75 points per minute',
                    bookCompletion: '1 point per book',
                    challengeCompletion: '1 point per completion',
                    pagesRead: '1 point per page',
                }}
            />
        )

        expect(html).toContain('Campaign assignment pending')
        expect(html).toContain(
            'No active challenges are attached to this campaign yet.'
        )
        expect(html).toContain('Campaign dates unavailable')
        expect(html).toContain('Save entry')
    })
})
