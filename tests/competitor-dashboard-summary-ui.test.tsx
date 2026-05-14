import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CompetitorDashboardSummary } from '@/components/authenticated/competitor-dashboard-summary'

describe('competitor dashboard summary UI', () => {
    it('styles competitor names to match the book title size and use slate blue', () => {
        const html = renderToStaticMarkup(
            <CompetitorDashboardSummary
                emptyStateMessage='No activity yet.'
                snapshotCards={[]}
                recentActivity={[
                    {
                        challengeLabel: null,
                        completedAtLabel: 'May 7',
                        id: 'activity-1',
                        isViewer: false,
                        pointsLabel: '50 points',
                        progressLabel: '320 pages',
                        readerLabel: 'Avery',
                        title: 'The Wild Robot',
                    },
                ]}
            />
        )

        expect(html).toContain(
            'text-lg font-semibold tracking-[0.01em] text-[color:var(--blue-slate)] sm:text-xl'
        )
    })

    it('renders participant detail activity titles and dates on the same row without an empty top spacer', () => {
        const html = renderToStaticMarkup(
            <CompetitorDashboardSummary
                emptyStateMessage='No activity yet.'
                snapshotCards={[]}
                recentActivity={[
                    {
                        challengeLabel: null,
                        completedAtLabel: 'May 6',
                        id: 'activity-1',
                        isViewer: true,
                        pointsLabel: '650 points',
                        progressLabel: '500 pages',
                        readerLabel: null,
                        title: 'Matilda',
                    },
                ]}
            />
        )

        expect(html).toContain(
            '<div class="flex items-start justify-between gap-4"><p class="min-w-0 text-lg font-semibold sm:text-xl">Matilda</p><p class="shrink-0 text-base text-muted-foreground sm:text-lg">May 6</p></div>'
        )
        expect(html).not.toContain('<span></span>')
    })
})
