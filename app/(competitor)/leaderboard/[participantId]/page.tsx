import { notFound } from 'next/navigation'

import { CompetitorDashboardSummary } from '@/components/authenticated/competitor-dashboard-summary'
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
            <header className='surface-card rounded-[calc(var(--radius-xl)+4px)] border border-(--line-strong) bg-card/72 px-6 py-8 shadow-[0_1.25rem_3rem_rgba(64,105,124,0.12)]'>
                <h1 className='text-center text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl'>
                    {formatCampaignHeading(viewModel.participantLabel)}
                </h1>
                <p className='mt-2 text-center text-xl text-muted-foreground'>
                    {viewModel.campaignName}
                </p>
            </header>

            <CompetitorDashboardSummary
                snapshotCards={viewModel.snapshotCards}
                recentActivity={viewModel.recentActivity}
                recentActivityTitle='Recent activities'
                emptyStateMessage='Completed books will appear here after this reader logs a book completion.'
            />
        </div>
    )
}

function formatCampaignHeading(participantLabel: string) {
    return `${participantLabel}${participantLabel.endsWith('s') ? "'" : "'s"} Campaign`
}
