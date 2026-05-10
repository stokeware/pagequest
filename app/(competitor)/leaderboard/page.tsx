import Link from 'next/link'

import { Button, Card, CardContent, EmptyState } from '@/components/ui'
import {
    defaultCompetitorLeaderboardViewModel,
    getCompetitorLeaderboardViewModel,
} from '@/lib/competitor-leaderboard'
import { getRoleAwareSession } from '@/lib/auth/session'

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
                            render={<Link href='/log-progress' />}
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
                            className='grid gap-3 rounded-3xl border border-border/70 bg-background/75 px-4 py-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-background md:grid-cols-[4rem_minmax(0,1.5fr)_7.5rem] md:items-start'
                            aria-label={`Open details for ${row.readerLabel}`}
                        >
                            <div className='text-sm font-semibold text-muted-foreground'>
                                {row.rankLabel}
                            </div>
                            <div className='space-y-2'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <p className='font-medium'>
                                        {row.readerLabel}
                                    </p>
                                    {row.isViewer ? (
                                        <span className='rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground'>
                                            Your row
                                        </span>
                                    ) : null}
                                </div>
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
