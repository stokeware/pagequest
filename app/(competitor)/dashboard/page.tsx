import Link from 'next/link'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    StatCard,
} from '@/components/ui'

const dashboardCards = [
    {
        title: 'Current rank',
        value: '#2',
        description:
            'Hold second place with steady page totals and one approved challenge.',
    },
    {
        title: 'Time remaining',
        value: '42 days',
        description:
            'The current quest still has enough runway for a late sprint and a few bonus challenges.',
    },
    {
        title: 'Recent activity',
        value: '1 challenge',
        description:
            'Your next entry will eventually surface here beside quest alerts and leaderboard movement.',
    },
]

export default function DashboardPage() {
    return (
        <div className='auth-page-stack'>
            <div className='auth-card-grid'>
                {dashboardCards.map((card) => (
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
                    <CardTitle>Next steps for this shell</CardTitle>
                    <CardDescription>
                        Phase 7 and Phase 8 will swap these placeholders for
                        live quest stats, forms, and standings.
                    </CardDescription>
                </CardHeader>
                <CardContent className='auth-inline-actions'>
                    <Button render={<Link href='/log-progress' />}>
                        Open log progress
                    </Button>
                    <Button
                        variant='outline'
                        render={<Link href='/leaderboard' />}
                    >
                        View leaderboard
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
