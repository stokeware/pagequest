import Link from 'next/link'

import { Button, Card, CardContent, EmptyState } from '@/components/ui'
import {
    defaultCompetitorLeaderboardViewModel,
    getCompetitorLeaderboardViewModel,
} from '@/lib/competitor-leaderboard'
import { getRoleAwareSession } from '@/lib/auth/session'
import { cn } from '@/lib/utils'

export default async function LeaderboardPage() {
    const viewer = await getRoleAwareSession('COMPETITOR')
    const viewModel = viewer.isAuthorized
        ? await getCompetitorLeaderboardViewModel(viewer.userId)
        : defaultCompetitorLeaderboardViewModel

    if (!viewModel.hasQuest) {
        return (
            <EmptyState
                eyebrow='Leaderboard'
                title='The leaderboard is waiting for a campaign.'
                description={viewModel.campaignDescription}
                action={
                    <div className='auth-inline-actions'>
                        <Button render={<Link href='/dashboard' />}>
                            Open dashboard
                        </Button>
                        <Button
                            variant='outline'
                            render={<Link href='/campaign-board' />}
                        >
                            Log progress
                        </Button>
                    </div>
                }
            />
        )
    }

    return (
        <div className='auth-page-stack'>
            <header className='surface-card rounded-[calc(var(--radius-xl)+4px)] border border-(--line-strong) bg-card/72 px-6 py-8 shadow-[0_1.25rem_3rem_rgba(64,105,124,0.12)]'>
                <h1 className='text-center text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl'>
                    {viewModel.campaignName}
                </h1>
                {viewModel.campaignDateRange ? (
                    <p className='mt-2 text-center text-xl text-muted-foreground'>
                        {viewModel.campaignDateRange}
                    </p>
                ) : null}
            </header>

            <Card className='surface-warm'>
                <CardContent className='space-y-3'>
                    <div className='hidden rounded-2xl bg-muted/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground md:grid md:grid-cols-[4rem_minmax(0,1.5fr)_7.5rem] md:gap-3'>
                        <span>Rank</span>
                        <span>Reader</span>
                        <span className='text-center'>Points</span>
                    </div>

                    {viewModel.rows.map((row) => (
                        <Link
                            key={row.participantId}
                            href={row.participantHref}
                            className={cn(
                                'grid gap-3 rounded-3xl border border-border/70 px-4 py-4 shadow-sm transition-colors md:grid-cols-[4rem_minmax(0,1.5fr)_7.5rem] md:items-start',
                                row.isViewer
                                    ? 'border-primary/25 bg-(--surface-highlight) hover:border-primary/45 hover:bg-(--surface-highlight)'
                                    : 'bg-background/75 hover:border-primary/40 hover:bg-background'
                            )}
                            aria-label={`Open details for ${row.readerLabel}`}
                        >
                            <div className='text-sm font-semibold text-muted-foreground'>
                                {row.rankLabel}
                            </div>
                            <div className='space-y-2'>
                                <p className='font-medium'>{row.readerLabel}</p>
                                <p className='text-sm text-muted-foreground'>
                                    {row.metricsLabel}
                                </p>
                            </div>
                            <div className='text-left md:text-right'>
                                <p className='text-lg font-semibold text-foreground'>
                                    {row.pointsLabel}
                                </p>
                            </div>
                        </Link>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
