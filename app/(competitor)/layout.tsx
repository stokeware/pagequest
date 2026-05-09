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
import { getCompetitorDashboardViewModel } from '@/lib/competitor-dashboard'
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

    const dashboardViewModel = await getCompetitorDashboardViewModel(
        viewer.userId
    )
    const competitorMetrics: ShellMetric[] = dashboardViewModel.shellMetrics

    return (
        <AppShell
            shellVariant='competitor'
            audienceLabel='Competitor experience'
            title='A focused reading hub for logging progress and checking the race.'
            description='Track your campaign standing, latest entries, and next move from one place.'
            navItems={competitorNavItems}
            metrics={competitorMetrics}
            viewer={viewer}
        >
            {children}
        </AppShell>
    )
}
