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

const overviewCards = [
    {
        title: 'Campaign lifecycle',
        value: 'Draft to archive',
        description:
            'Draft, schedule, publish, and archive campaigns from a dedicated admin surface.',
    },
    {
        title: 'Participant onboarding',
        value: 'Invites and joins',
        description:
            'Invitation workflows and acceptance status will anchor the private-campaign model here.',
    },
    {
        title: 'Challenge catalog',
        value: 'Reusable prompts',
        description:
            'Challenge definitions, repeatability rules, and review expectations now live in a dedicated admin surface.',
    },
    {
        title: 'Reporting and moderation',
        value: 'Audits and exports',
        description:
            'Later phases will attach exports, audit trails, and moderation tools to this shell.',
    },
]

export default function AdminOverviewPage() {
    return (
        <div className='auth-page-stack'>
            <div className='auth-card-grid'>
                {overviewCards.map((card) => (
                    <StatCard
                        key={card.title}
                        eyebrow='Admin module'
                        title={card.title}
                        value={card.value}
                        description={card.description}
                    />
                ))}
            </div>

            <Card className='surface-warm'>
                <CardHeader>
                    <CardTitle>Planned admin entry points</CardTitle>
                    <CardDescription>
                        The routes below are now stable targets for campaign
                        management, challenges, invitations, and reports.
                    </CardDescription>
                </CardHeader>
                <CardContent className='auth-inline-actions'>
                    <Button render={<Link href='/admin/campaigns' />}>
                        Open campaigns
                    </Button>
                    <Button
                        variant='secondary'
                        render={<Link href='/admin/challenges' />}
                    >
                        Open challenges
                    </Button>
                    <Button
                        variant='outline'
                        render={<Link href='/admin/invitations' />}
                    >
                        Review invitations
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
