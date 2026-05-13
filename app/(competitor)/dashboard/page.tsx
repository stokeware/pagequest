import Link from 'next/link'

import { CompetitorDashboardSummary } from '@/components/authenticated/competitor-dashboard-summary'
import {
    Button,
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
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
                    <CompetitorDashboardSummary
                        snapshotCards={viewModel.snapshotCards}
                        recentActivity={viewModel.recentActivity}
                        emptyStateMessage='Completed books will appear here after you log a book completion.'
                    />
                </>
            ) : (
                <EmptyState
                    eyebrow='Competitor dashboard'
                    title='Your dashboard is waiting for a campaign.'
                    description={viewModel.participantSummary}
                    action={
                        <div className='auth-inline-actions'>
                            <Button render={<Link href='/campaign-board' />}>
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
