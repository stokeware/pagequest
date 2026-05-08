import { AppShell } from '@/components/authenticated/app-shell'

const competitorNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'book-marked' },
    {
        href: '/log-progress',
        label: 'Log progress',
        icon: 'clipboard-pen-line',
    },
    { href: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { href: '/history', label: 'My history', icon: 'history' },
]

const competitorMetrics = [
    {
        label: 'Active quest',
        value: 'Spring Story Sprint',
        detail: '42 days remaining',
    },
    {
        label: 'Current standing',
        value: '#2',
        detail: '18 points behind first place',
    },
    {
        label: 'Weekly pace',
        value: '186 pages',
        detail: 'Plus 95 audiobook minutes',
    },
]

export default function CompetitorLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <AppShell
            shellVariant='competitor'
            audienceLabel='Competitor experience'
            title='A focused reading hub for logging progress and checking the race.'
            description='This authenticated shell establishes the future competitor route family without depending on live auth or quest data yet.'
            navItems={competitorNavItems}
            metrics={competitorMetrics}
        >
            {children}
        </AppShell>
    )
}
