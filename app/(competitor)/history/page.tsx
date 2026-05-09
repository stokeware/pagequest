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
    const selectedQuestId = getFirstSearchParamValue(resolvedSearchParams.quest)
    const viewModel = viewer.isAuthorized
        ? await getCompetitorHistoryViewModel(viewer.userId, selectedQuestId)
        : defaultCompetitorHistoryViewModel

    if (!viewModel.hasQuestHistory) {
        return (
            <EmptyState
                eyebrow='History'
                title='Your reading timeline is waiting for a quest.'
                description={viewModel.selectedQuestSummary}
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
                    <CardTitle>{viewModel.selectedQuestName}</CardTitle>
                    <CardDescription>
                        {viewModel.selectedQuestStatusLabel}.{' '}
                        {viewModel.selectedQuestSummary}
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
                {viewModel.selectedQuestMetrics.map((metric) => (
                    <StatCard
                        key={metric.label}
                        eyebrow='Quest snapshot'
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
                        Every non-deleted entry for the selected quest, ordered
                        from newest to oldest.
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
                            No reading history has been logged for this quest
                            yet.
                        </p>
                    )}
                </CardContent>
            </Card>

            {viewModel.currentQuestCard ? (
                <Card className='surface-card'>
                    <CardHeader>
                        <CardTitle>Current quest</CardTitle>
                        <CardDescription>
                            Jump back to your live or upcoming quest timeline.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link
                            href={viewModel.currentQuestCard.href}
                            className='block rounded-3xl border border-border/70 bg-background/80 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-background'
                        >
                            <p className='font-medium'>
                                {viewModel.currentQuestCard.questName}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                                {viewModel.currentQuestCard.questStatusLabel}
                            </p>
                            <p className='mt-2 text-sm text-muted-foreground'>
                                {viewModel.currentQuestCard.totalsLabel}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                                {viewModel.currentQuestCard.lastActivityLabel}
                            </p>
                        </Link>
                    </CardContent>
                </Card>
            ) : null}

            <Card className='surface-card'>
                <CardHeader>
                    <CardTitle>Past quests</CardTitle>
                    <CardDescription>
                        Browse earlier quest seasons without leaving your
                        personal history view.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {viewModel.pastQuestCards.length > 0 ? (
                        viewModel.pastQuestCards.map((quest) => (
                            <Link
                                key={quest.participantId}
                                href={quest.href}
                                className='block rounded-3xl border border-border/70 bg-background/80 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-background'
                            >
                                <div className='flex flex-wrap items-start justify-between gap-3'>
                                    <div className='space-y-2'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <p className='font-medium'>
                                                {quest.questName}
                                            </p>
                                            {quest.isSelected ? (
                                                <span className='rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground'>
                                                    Selected
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className='text-sm text-muted-foreground'>
                                            {quest.questStatusLabel}
                                        </p>
                                        <p className='text-sm text-muted-foreground'>
                                            {quest.totalsLabel}
                                        </p>
                                        <p className='text-sm text-muted-foreground'>
                                            {quest.lastActivityLabel}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <p className='text-sm text-muted-foreground'>
                            Past quests will appear here after your first season
                            is completed.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
