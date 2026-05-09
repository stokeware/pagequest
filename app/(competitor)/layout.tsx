import {
    AppShell,
    type ShellMetric,
    type ShellNavItem,
} from '@/components/authenticated/app-shell'
import {
    getInvitationAccessProfile,
    shouldRedirectCompetitorAccess,
} from '@/lib/invitation-access'
import {
    getRoleAwareSession,
    protectAuthenticatedRoute,
} from '@/lib/auth/session'
import { redirect } from 'next/navigation'

const competitorNavItems: ShellNavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: 'book-marked' },
    {
        href: '/log-progress',
        label: 'Log progress',
        icon: 'clipboard-pen-line',
    },
    { href: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { href: '/history', label: 'My history', icon: 'history' },
]

const competitorMetrics: ShellMetric[] = [
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

export default async function CompetitorLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    const viewer = await getRoleAwareSession('COMPETITOR')

    protectAuthenticatedRoute({
        callbackUrl: '/dashboard',
        viewer,
    })

    const invitationAccess = await getInvitationAccessProfile({
        userEmail: viewer.userEmail,
        userId: viewer.userId,
    })

    const invitationRedirectPath =
        shouldRedirectCompetitorAccess(invitationAccess)

    if (invitationRedirectPath) {
        redirect(invitationRedirectPath)
    }

    return (
        <AppShell
            shellVariant='competitor'
            audienceLabel='Competitor experience'
            title='A focused reading hub for logging progress and checking the race.'
            description='This authenticated shell establishes the future competitor route family without depending on live auth or quest data yet.'
            navItems={competitorNavItems}
            metrics={competitorMetrics}
            viewer={viewer}
        >
            {children}
        </AppShell>
    )
}
