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
import { getRoleAwareSession } from '@/lib/auth/session'
import {
    defaultCompetitorHistoryViewModel,
    getCompetitorHistoryViewModel,
} from '@/lib/competitor-history'

type HistoryPageProps = {
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

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
    const viewer = await getRoleAwareSession('COMPETITOR')
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const selectedCampaignId = getFirstSearchParamValue(
        resolvedSearchParams.campaign
    )
    const viewModel = viewer.isAuthorized
        ? await getCompetitorHistoryViewModel(viewer.userId, selectedCampaignId)
        : defaultCompetitorHistoryViewModel

    if (!viewModel.hasCampaignHistory) {
        return (
            <EmptyState
                eyebrow='History'
                title='Your reading timeline is waiting for a campaign.'
                description={viewModel.selectedCampaignSummary}
                action={
                    <Button
                        variant='outline'
                        render={<Link href='/leaderboard' />}
                    >
                        Browse the leaderboard
                    </Button>
                }
            />
        )
    }

    return (
        <div className='auth-page-stack'>
            <Card className='surface-card'>
                <CardHeader>
                    <CardTitle>{viewModel.selectedCampaignName}</CardTitle>
                    <CardDescription>
                        {viewModel.selectedCampaignStatusLabel}.{' '}
                        {viewModel.selectedCampaignSummary}
                    </CardDescription>
                </CardHeader>
                <CardContent className='auth-inline-actions'>
                    <Button render={<Link href='/dashboard' />}>
                        Return to dashboard
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
                {viewModel.selectedCampaignMetrics.map((metric) => (
                    <StatCard
                        key={metric.label}
                        eyebrow='Campaign snapshot'
                        title={metric.label}
                        value={metric.value}
                        description={metric.detail}
                    />
                ))}
            </div>

            <Card className='surface-warm'>
                <CardHeader>
                    <CardTitle>My history</CardTitle>
                    <CardDescription>
                        Every non-deleted entry for the selected campaign,
                        ordered from newest to oldest.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {viewModel.timelineEntries.length > 0 ? (
                        viewModel.timelineEntries.map((entry) => (
                            <div
                                key={entry.id}
                                className='rounded-3xl border border-border/70 bg-background/80 px-4 py-4'
                            >
                                <div className='flex flex-wrap items-start justify-between gap-3'>
                                    <div className='space-y-2'>
                                        <p className='font-medium'>
                                            {entry.title}
                                        </p>
                                        <p className='text-sm text-muted-foreground'>
                                            {entry.description}
                                        </p>
                                    </div>
                                    <div className='text-left md:text-right'>
                                        <p className='text-sm font-semibold text-foreground'>
                                            {entry.pointsLabel}
                                        </p>
                                        {entry.statusLabel ? (
                                            <p className='text-xs font-semibold uppercase tracking-[0.16em] text-primary'>
                                                {entry.statusLabel}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                                {entry.note ? (
                                    <p className='mt-3 text-sm text-muted-foreground'>
                                        Note: {entry.note}
                                    </p>
                                ) : null}
                            </div>
                        ))
                    ) : (
                        <p className='text-sm text-muted-foreground'>
                            No reading history has been logged for this campaign
                            yet.
                        </p>
                    )}
                </CardContent>
            </Card>

            {viewModel.currentCampaignCard ? (
                <Card className='surface-card'>
                    <CardHeader>
                        <CardTitle>Current campaign</CardTitle>
                        <CardDescription>
                            Jump back to your live or upcoming campaign
                            timeline.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link
                            href={viewModel.currentCampaignCard.href}
                            className='block rounded-3xl border border-border/70 bg-background/80 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-background'
                        >
                            <p className='font-medium'>
                                {viewModel.currentCampaignCard.campaignName}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                                {
                                    viewModel.currentCampaignCard
                                        .campaignStatusLabel
                                }
                            </p>
                            <p className='mt-2 text-sm text-muted-foreground'>
                                {viewModel.currentCampaignCard.totalsLabel}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                                {
                                    viewModel.currentCampaignCard
                                        .lastActivityLabel
                                }
                            </p>
                        </Link>
                    </CardContent>
                </Card>
            ) : null}

            <Card className='surface-card'>
                <CardHeader>
                    <CardTitle>Past campaigns</CardTitle>
                    <CardDescription>
                        Browse earlier campaign seasons without leaving your
                        personal history view.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {viewModel.pastCampaignCards.length > 0 ? (
                        viewModel.pastCampaignCards.map((campaign) => (
                            <Link
                                key={campaign.participantId}
                                href={campaign.href}
                                className='block rounded-3xl border border-border/70 bg-background/80 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-background'
                            >
                                <div className='flex flex-wrap items-start justify-between gap-3'>
                                    <div className='space-y-2'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <p className='font-medium'>
                                                {campaign.campaignName}
                                            </p>
                                            {campaign.isSelected ? (
                                                <span className='rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground'>
                                                    Selected
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className='text-sm text-muted-foreground'>
                                            {campaign.campaignStatusLabel}
                                        </p>
                                        <p className='text-sm text-muted-foreground'>
                                            {campaign.totalsLabel}
                                        </p>
                                        <p className='text-sm text-muted-foreground'>
                                            {campaign.lastActivityLabel}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <p className='text-sm text-muted-foreground'>
                            Past campaigns will appear here after your first
                            season is completed.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
