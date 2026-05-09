import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
    ConfirmationDialog,
    ErrorState,
    EmptyState,
    FormActions,
    FormCard,
    FormField,
    Input,
    LoadingState,
    StatCard,
    TableCard,
} from '@/components/ui'

describe('shared UI patterns', () => {
    it('renders stat, empty, and table patterns with their content', () => {
        const html = renderToStaticMarkup(
            <div>
                <StatCard
                    eyebrow='Competitor snapshot'
                    title='Current rank'
                    value='#2'
                    description='18 points behind first place'
                />
                <EmptyState
                    eyebrow='Reports'
                    title='No reports yet'
                    description='Summaries appear once a campaign has entries.'
                />
                <ErrorState
                    eyebrow='Route error'
                    title='This page hit a snag'
                    description='Try the route again.'
                />
                <LoadingState
                    eyebrow='Loading'
                    title='Preparing reports'
                    description='Campaign summaries are loading now.'
                />
                <TableCard
                    title='Leaderboard'
                    columns={['Rank', 'Reader']}
                    rows={[{ key: 'morgan', cells: ['1', 'Morgan'] }]}
                    ariaLabel='Leaderboard preview'
                />
            </div>
        )

        expect(html).toContain('Current rank')
        expect(html).toContain('#2')
        expect(html).toContain('No reports yet')
        expect(html).toContain('This page hit a snag')
        expect(html).toContain('Preparing reports')
        expect(html).toContain('Morgan')
    })

    it('renders form and confirmation dialog primitives', () => {
        const html = renderToStaticMarkup(
            <div>
                <FormCard title='Sign in'>
                    <FormField label='Email address' htmlFor='email'>
                        <Input id='email' placeholder='reader@example.com' />
                    </FormField>
                    <FormActions note='Auth arrives later'>
                        Save for later
                    </FormActions>
                </FormCard>
                <ConfirmationDialog
                    triggerLabel='Archive campaign'
                    title='Archive Spring Story Sprint?'
                    description='This action can be confirmed from a shared dialog.'
                    tone='destructive'
                />
            </div>
        )

        expect(html).toContain('Email address')
        expect(html).toContain('Auth arrives later')
        expect(html).toContain('Archive campaign')
    })
})
