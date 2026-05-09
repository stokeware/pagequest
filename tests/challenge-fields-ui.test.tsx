import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
    ChallengeForm,
    ChallengePolicyPanel,
    getChallengeFormDefaults,
} from '@/app/(admin)/admin/challenges/challenge-catalog-fields'

describe('challenge field admin UI', () => {
    it('renders the Phase 6 Task 2 challenge fields in the catalog form', () => {
        const html = renderToStaticMarkup(
            <ChallengeForm
                action={vi.fn(async () => undefined)}
                defaultValues={getChallengeFormDefaults()}
                note='Catalog entries are reusable.'
                submitLabel='Create challenge'
                title='Create a challenge'
            />
        )

        expect(html).toContain('Challenge title')
        expect(html).toContain('Description')
        expect(html).toContain('Category')
        expect(html).toContain('Point value')
        expect(html).toContain('Repeatability')
        expect(html).toContain('Review requirement')
        expect(html).toContain('One-time')
        expect(html).toContain('Repeatable')
        expect(html).toContain(
            'Require admin approval before crediting the completion.'
        )
    })

    it('renders point rule, repeatability, and review state in the policy panel', () => {
        const html = renderToStaticMarkup(
            <ChallengePolicyPanel
                defaults={{
                    availability: 'REPEATABLE',
                    pointValue: '15',
                    requiresReview: true,
                }}
            />
        )

        expect(html).toContain('Point rule')
        expect(html).toContain('15 points')
        expect(html).toContain('Repeatable')
        expect(html).toContain('Manual review')
    })

    it('maps stored challenge values into form defaults', () => {
        const defaults = getChallengeFormDefaults({
            availability: 'REPEATABLE',
            category: 'Genre prompt',
            description: 'Read a biography or memoir.',
            evidencePrompt: 'Share the title.',
            pointValue: { toString: () => '15' },
            requiresReview: true,
            title: 'Biography bonus',
        })

        expect(defaults).toEqual({
            availability: 'REPEATABLE',
            category: 'Genre prompt',
            description: 'Read a biography or memoir.',
            evidencePrompt: 'Share the title.',
            pointValue: '15',
            requiresReview: true,
            title: 'Biography bonus',
        })
    })
})
