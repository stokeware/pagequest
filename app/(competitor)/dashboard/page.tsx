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
                    <div className='auth-card-grid'>
                        {viewModel.snapshotCards.map((card) => (
                            <StatCard
                                key={card.title}
                                title={card.title}
                                value={card.value}
                                description={card.description}
                            />
                        ))}
                    </div>

                    <Card className='surface-card'>
                        <CardHeader>
                            <CardTitle>Recent activity</CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            {viewModel.recentActivity.length > 0 ? (
                                viewModel.recentActivity.map((item) => (
                                    <div
                                        key={item.id}
                                        className='rounded-2xl border border-border/70 bg-background/80 px-4 py-3'
                                    >
                                        <div className='space-y-2'>
                                            <p className='font-medium'>
                                                {item.title}
                                            </p>
                                            <p className='text-sm text-muted-foreground'>
                                                Completed{' '}
                                                {item.completedAtLabel}
                                            </p>
                                            {item.challengeLabel ? (
                                                <p className='text-sm text-muted-foreground'>
                                                    Challenge:{' '}
                                                    {item.challengeLabel}
                                                </p>
                                            ) : null}
                                            <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground'>
                                                <span>
                                                    {item.progressLabel}
                                                </span>
                                                <span>{item.pointsLabel}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className='text-sm text-muted-foreground'>
                                    Completed books will appear here after you
                                    log a book completion.
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
