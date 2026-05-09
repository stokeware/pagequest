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
    defaultCompetitorDashboardViewModel,
    getCompetitorDashboardViewModel,
} from '@/lib/competitor-dashboard'
import { getRoleAwareSession } from '@/lib/auth/session'

type DashboardPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

export default async function DashboardPage({
    searchParams,
}: DashboardPageProps) {
    const viewer = await getRoleAwareSession('COMPETITOR')
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const invitationAccepted =
        getFirstSearchParamValue(resolvedSearchParams.invitationAccepted) ===
        '1'
    const viewModel = viewer.isAuthorized
        ? await getCompetitorDashboardViewModel(viewer.userId)
        : defaultCompetitorDashboardViewModel

    return (
        <div className='auth-page-stack'>
            {invitationAccepted ? (
                <Card className='surface-tint'>
                    <CardHeader>
                        <CardTitle>Invitation accepted</CardTitle>
                        <CardDescription>
                            Your account is now linked to the campaign. This
                            dashboard is ready to show your standing, countdown,
                            and recent progress as soon as entries are
                            available.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {viewModel.hasQuest ? (
                <>
                    <Card className='surface-card'>
                        <CardHeader>
                            <CardTitle>{viewModel.campaignName}</CardTitle>
                            <CardDescription>
                                {viewModel.campaignStatusLabel}.{' '}
                                {viewModel.participantSummary}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='auth-inline-actions'>
                            <Button render={<Link href='/log-progress' />}>
                                Log today&apos;s progress
                            </Button>
                            <Button
                                variant='outline'
                                render={<Link href='/leaderboard' />}
                            >
                                Open leaderboard
                            </Button>
                        </CardContent>
                    </Card>

                    <div className='auth-card-grid'>
                        {viewModel.snapshotCards.map((card) => (
                            <StatCard
                                key={card.title}
                                eyebrow='Competitor snapshot'
                                title={card.title}
                                value={card.value}
                                description={card.description}
                            />
                        ))}
                    </div>

                    <Card className='surface-warm'>
                        <CardHeader>
                            <CardTitle>Summary stats</CardTitle>
                            <CardDescription>
                                Totals for your selected campaign profile.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className='auth-card-grid'>
                                {viewModel.summaryMetrics.map((metric) => (
                                    <StatCard
                                        key={metric.label}
                                        eyebrow={metric.label}
                                        title={metric.value}
                                        description={metric.detail}
                                        className='surface-card'
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className='surface-card'>
                        <CardHeader>
                            <CardTitle>Recent activity</CardTitle>
                            <CardDescription>
                                Your latest reading and challenge entries for
                                this campaign.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            {viewModel.recentActivity.length > 0 ? (
                                viewModel.recentActivity.map((item) => (
                                    <div
                                        key={item.id}
                                        className='rounded-2xl border border-border/70 bg-background/80 px-4 py-3'
                                    >
                                        <p className='font-medium'>
                                            {item.title}
                                        </p>
                                        <p className='text-sm text-muted-foreground'>
                                            {item.description}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className='text-sm text-muted-foreground'>
                                    Your latest entries will appear here after
                                    you log progress.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : (
                <EmptyState
                    eyebrow='Competitor dashboard'
                    title='Your dashboard is waiting for a campaign.'
                    description={viewModel.participantSummary}
                    action={
                        <div className='auth-inline-actions'>
                            <Button render={<Link href='/log-progress' />}>
                                Open log progress
                            </Button>
                            <Button
                                variant='outline'
                                render={<Link href='/leaderboard' />}
                            >
                                View leaderboard
                            </Button>
                        </div>
                    }
                />
            )}
        </div>
    )
}
