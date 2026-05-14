import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    StatCard,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type {
    DashboardRecentActivityItem,
    DashboardSnapshotCard,
} from '@/lib/competitor-dashboard'

type CompetitorDashboardSummaryProps = {
    emptyStateMessage: string
    recentActivity: DashboardRecentActivityItem[]
    recentActivityTitle?: string
    snapshotCards: DashboardSnapshotCard[]
}

export function CompetitorDashboardSummary({
    emptyStateMessage,
    recentActivity,
    recentActivityTitle = 'Recent activity',
    snapshotCards,
}: CompetitorDashboardSummaryProps) {
    return (
        <>
            <div className='auth-card-grid'>
                {snapshotCards.map((card) => (
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
                    <CardTitle>{recentActivityTitle}</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {recentActivity.length > 0 ? (
                        recentActivity.map((item) => (
                            <div
                                key={item.id}
                                className={cn(
                                    'rounded-2xl border px-4 py-3',
                                    item.isViewer
                                        ? 'border-primary/25 bg-(--surface-highlight)'
                                        : 'border-border/70 bg-background/80'
                                )}
                            >
                                <div className='space-y-2'>
                                    {item.readerLabel ? (
                                        <p className='text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
                                            {item.readerLabel}
                                        </p>
                                    ) : null}
                                    <p className='font-medium'>{item.title}</p>
                                    <p className='text-sm text-muted-foreground'>
                                        Completed {item.completedAtLabel}
                                    </p>
                                    {item.challengeLabel ? (
                                        <p className='text-sm text-muted-foreground'>
                                            Challenge: {item.challengeLabel}
                                        </p>
                                    ) : null}
                                    <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground'>
                                        <span>{item.progressLabel}</span>
                                        <span>{item.pointsLabel}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className='text-sm text-muted-foreground'>
                            {emptyStateMessage}
                        </p>
                    )}
                </CardContent>
            </Card>
        </>
    )
}
