import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { CampaignChallengesTable } from '@/app/(admin)/admin/campaigns/page'

function buildCampaign(): Parameters<
    typeof CampaignChallengesTable
>[0]['campaign'] {
    return {
        challenges: [
            {
                id: 'challenge-1',
                kind: 'ADMIN',
                pageMinuteMultiplier: '1',
                pointValue: '10',
                title: 'Night Reading',
            },
            {
                id: 'challenge-2',
                kind: 'ADMIN',
                pageMinuteMultiplier: '2',
                pointValue: '15',
                title: 'Weekend Sprint',
            },
            {
                id: 'challenge-3',
                kind: 'PERSONAL_GOAL_TEMPLATE',
                pageMinuteMultiplier: '1',
                pointValue: '5',
                title: 'Personal Goal',
            },
        ],
        id: 'campaign-1',
        name: 'Spring Story Sprint',
    } as Parameters<typeof CampaignChallengesTable>[0]['campaign']
}

describe('admin campaigns challenge table', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('renders hidden delete forms outside the save form', () => {
        const html = renderToStaticMarkup(
            <CampaignChallengesTable campaign={buildCampaign()} />
        )

        document.body.innerHTML = html

        const saveForm = document.getElementById(
            'campaign-1-campaign-challenges-form'
        )
        const deleteFormOne = document.getElementById('challenge-1-delete-form')
        const deleteFormTwo = document.getElementById('challenge-2-delete-form')

        expect(saveForm).not.toBeNull()
        expect(saveForm?.querySelector('form')).toBeNull()
        expect(saveForm?.contains(deleteFormOne)).toBe(false)
        expect(saveForm?.contains(deleteFormTwo)).toBe(false)
        expect(document.querySelectorAll('form')).toHaveLength(3)
        expect(
            document.querySelector('button[form="challenge-1-delete-form"]')
        ).not.toBeNull()
        expect(
            document.querySelector('button[form="challenge-2-delete-form"]')
        ).not.toBeNull()
    })
})
