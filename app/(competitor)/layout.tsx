import {
    AppShell,
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
        label: 'Campaign',
        icon: 'clipboard-pen-line',
    },
    { href: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
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
            navItems={competitorNavItems}
            viewer={viewer}
        >
            {children}
        </AppShell>
    )
}
