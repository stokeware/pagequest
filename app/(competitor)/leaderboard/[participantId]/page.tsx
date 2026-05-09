import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    StatCard,
} from '@/components/ui'
import { getRoleAwareSession } from '@/lib/auth/session'
import { getCompetitorParticipantDetailViewModel } from '@/lib/competitor-participant-detail'

type ParticipantDetailPageProps = {
    params: Promise<{
        participantId: string
    }>
}

export default async function ParticipantDetailPage({
    params,
}: ParticipantDetailPageProps) {
    const { participantId } = await params
    const viewer = await getRoleAwareSession('COMPETITOR')
    const viewModel = await getCompetitorParticipantDetailViewModel(
        viewer.userId,
        participantId
    )

    if (!viewModel.hasParticipant) {
        notFound()
    }

    return (
        <div className='auth-page-stack'>
            <Card className='surface-card'>
                <CardHeader>
                    <CardTitle>{viewModel.participantLabel}</CardTitle>
                    <CardDescription>
                        {viewModel.campaignStatusLabel}.{' '}
                        {viewModel.campaignName}. {viewModel.participantSummary}
                    </CardDescription>
                </CardHeader>
                <CardContent className='auth-inline-actions'>
                    <Button render={<Link href='/leaderboard' />}>
                        Back to leaderboard
                    </Button>
                    <Button
                        variant='outline'
                        render={
                            <Link
                                href={
                                    viewModel.isViewer
                                        ? '/history'
                                        : '/dashboard'
                                }
                            />
                        }
                    >
                        {viewModel.isViewer
                            ? 'Open my history'
                            : 'Return to dashboard'}
                    </Button>
                </CardContent>
            </Card>

            <div className='auth-card-grid'>
                {viewModel.summaryMetrics.map((metric) => (
                    <StatCard
                        key={metric.label}
                        eyebrow='Participant snapshot'
                        title={metric.label}
                        value={metric.value}
                        description={metric.detail}
                    />
                ))}
            </div>

            <Card className='surface-warm'>
                <CardHeader>
                    <CardTitle>Campaign reading history</CardTitle>
                    <CardDescription>
                        Every non-deleted entry for this participant in the
                        selected campaign, ordered from newest to oldest.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {viewModel.historyEntries.length > 0 ? (
                        viewModel.historyEntries.map((entry) => (
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
                            No reading history has been logged for this
                            participant yet.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
