import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ChallengeReviewQueuePanel } from '@/app/(admin)/admin/challenges/challenge-review-queue-panel'

describe('challenge review queue admin UI', () => {
    it('renders a pending review list and selected review detail', () => {
        const html = renderToStaticMarkup(
            <ChallengeReviewQueuePanel
                action={vi.fn(async () => undefined)}
                pendingReviews={[
                    {
                        awardedPoints: { toString: () => '50' },
                        challengeTitle: 'Friend Recommendation',
                        createdAtLabel: 'May 8, 2026 at 3:00 PM',
                        defaultAwardedPoints: { toString: () => '40' },
                        evidenceText: 'Read a recommendation from Clara.',
                        href: '/admin/challenges?selectedCompletionId=review-1',
                        id: 'review-1',
                        participantLabel: 'Ben Sparrow',
                        campaignLabel: 'Spring Story Sprint',
                        reviewNotes: 'Looks good.',
                        readingEntryNotes: 'Took a recommendation from Clara.',
                        submittedActivityLabel: 'May 7, 2026 at 5:15 PM',
                    },
                ]}
                resolvedReviews={[
                    {
                        awardedPoints: { toString: () => '40' },
                        challengeTitle: 'Read a Biography',
                        participantLabel: 'Alice Redwood',
                        campaignLabel: 'Spring Story Sprint',
                        reviewStateLabel: 'Auto-approved',
                        reviewedAtLabel: 'May 9, 2026 at 4:45 PM',
                        reviewerLabel: 'Automatic system decision',
                    },
                ]}
                selectedChallengeId='challenge-1'
                selectedReviewId='review-1'
            />
        )

        expect(html).toContain('Pending challenge reviews')
        expect(html).toContain('Friend Recommendation')
        expect(html).toContain('Ben Sparrow in Spring Story Sprint')
        expect(html).toContain('Read a recommendation from Clara.')
        expect(html).toContain('Reviewing')
        expect(html).toContain('50 points')
        expect(html).toContain('Suggested points')
        expect(html).toContain('Approve submission')
        expect(html).toContain('Reject submission')
        expect(html).toContain('Recent review outcomes')
        expect(html).toContain('Auto-approved')
    })

    it('renders the empty review queue message when no items are pending', () => {
        const html = renderToStaticMarkup(
            <ChallengeReviewQueuePanel
                action={vi.fn(async () => undefined)}
                pendingReviews={[]}
                resolvedReviews={[]}
                selectedChallengeId={null}
                selectedReviewId={null}
            />
        )

        expect(html).toContain(
            'No challenge completions are waiting for manual review right now.'
        )
        expect(html).toContain(
            'No challenge submissions have been resolved yet.'
        )
    })
})
