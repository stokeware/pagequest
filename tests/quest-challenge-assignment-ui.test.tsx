import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { QuestChallengeAssignmentsPanel } from '@/app/(admin)/admin/quests/quest-challenge-assignment-panel'

describe('quest challenge assignment admin UI', () => {
    it('renders current assignments and the add-assignment form', () => {
        const html = renderToStaticMarkup(
            <QuestChallengeAssignmentsPanel
                action={vi.fn(async () => undefined)}
                availableChallenges={[
                    {
                        id: 'challenge-2',
                        title: 'Mystery pick',
                    },
                ]}
                assignments={[
                    {
                        challenge: {
                            availability: 'ONE_TIME',
                            category: 'Genre prompt',
                            requiresReview: true,
                            title: 'Biography bonus',
                        },
                        challengeId: 'challenge-1',
                        id: 'assignment-1',
                        isActive: true,
                        pointValueOverride: { toString: () => '15' },
                        sortOrder: 1,
                    },
                ]}
                canEdit={true}
                questId='quest-1'
            />
        )

        expect(html).toContain('Quest challenges')
        expect(html).toContain('Biography bonus')
        expect(html).toContain('15 points')
        expect(html).toContain('Catalog challenge')
        expect(html).toContain('Sort order')
        expect(html).toContain('Point override')
        expect(html).toContain('Add challenge to quest')
        expect(html).toContain('Mystery pick')
    })

    it('renders the archived read-only note when editing is disabled', () => {
        const html = renderToStaticMarkup(
            <QuestChallengeAssignmentsPanel
                action={vi.fn(async () => undefined)}
                availableChallenges={[]}
                assignments={[]}
                canEdit={false}
                questId='quest-1'
            />
        )

        expect(html).toContain(
            'assignments can no longer change from this surface'
        )
    })
})
