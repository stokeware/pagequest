import Link from 'next/link'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    StatCard,
} from '@/components/ui'
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
            <Card className='surface-card'>
                <CardHeader>
                    <CardTitle>{viewModel.campaignName}</CardTitle>
                    <CardDescription>
                        {viewModel.campaignStatusLabel}.{' '}
                        {viewModel.campaignDescription}
                    </CardDescription>
                </CardHeader>
                <CardContent className='auth-inline-actions'>
                    <Button render={<Link href='/dashboard' />}>
                        Return to dashboard
                    </Button>
                    <Button variant='outline' render={<Link href='/history' />}>
                        Open my history
                    </Button>
                </CardContent>
            </Card>

            <div className='auth-card-grid'>
                {viewModel.highlights.map((item) => (
                    <StatCard
                        key={item.label}
                        eyebrow='Leaderboard snapshot'
                        title={item.label}
                        value={item.value}
                        description={item.detail}
                    />
                ))}
            </div>

            <Card className='surface-warm'>
                <CardHeader>
                    <CardTitle>Standings</CardTitle>
                    <CardDescription>
                        Points lead each row. Raw totals stay visible beside the
                        scored order so households can see how each reader is
                        building that score.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <div className='hidden rounded-2xl bg-muted/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground md:grid md:grid-cols-[4.5rem_minmax(0,1.5fr)_9rem]'>
                        <span>Rank</span>
                        <span>Reader</span>
                        <span>Points</span>
                    </div>

                    {viewModel.rows.map((row) => (
                        <Link
                            key={row.participantId}
                            href={row.participantHref}
                            className='grid gap-3 rounded-3xl border border-border/70 bg-background/75 px-4 py-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-background md:grid-cols-[4.5rem_minmax(0,1.5fr)_9rem] md:items-start'
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
                                <p className='text-sm text-muted-foreground'>
                                    {row.activityLabel}
                                </p>
                                <p className='text-sm font-medium text-primary'>
                                    Open participant details
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
