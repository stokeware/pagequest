import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
    ChallengeForm,
    ChallengePolicyPanel,
    getChallengeFormDefaults,
} from '@/app/(admin)/admin/challenges/challenge-catalog-fields'

describe('challenge field admin UI', () => {
    it('renders the simplified challenge fields in the catalog form', () => {
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
        expect(html).toContain('Point value')
    })

    it('renders point rule in the policy panel', () => {
        const html = renderToStaticMarkup(
            <ChallengePolicyPanel
                defaults={{
                    pageMinuteMultiplier: '1.5',
                    pointValue: '15',
                }}
            />
        )

        expect(html).toContain('Scoring')
        expect(html).toContain('Points')
        expect(html).toContain('15')
        expect(html).toContain('Multiplier')
        expect(html).toContain('1.5')
    })

    it('maps stored challenge values into form defaults', () => {
        const defaults = getChallengeFormDefaults({
            pageMinuteMultiplier: { toString: () => '1.5' },
            pointValue: { toString: () => '15' },
            title: 'Biography bonus',
        })

        expect(defaults).toEqual({
            pageMinuteMultiplier: '1.5',
            pointValue: '15',
            title: 'Biography bonus',
        })
    })
})
