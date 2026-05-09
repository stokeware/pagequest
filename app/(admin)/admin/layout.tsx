import {
    AppShell,
    type ShellMetric,
    type ShellNavItem,
} from '@/components/authenticated/app-shell'
import { getRoleAwareSession, protectAdminRoute } from '@/lib/auth/session'

const adminNavItems: ShellNavItem[] = [
    { href: '/admin', label: 'Overview', icon: 'shield-check' },
    { href: '/admin/quests', label: 'Quests', icon: 'folder-kanban' },
    { href: '/admin/invitations', label: 'Invitations', icon: 'mail-plus' },
    { href: '/admin/reports', label: 'Reports', icon: 'table-properties' },
]

const adminMetrics: ShellMetric[] = [
    {
        label: 'Active quest',
        value: '1 scheduled',
        detail: 'Spring Story Sprint opens next week',
    },
    {
        label: 'Invitations',
        value: '12 pending',
        detail: '3 reminder emails due today',
    },
    {
        label: 'Admin focus',
        value: 'Scoring rules',
        detail: 'Pages and audiobook points ready for review',
    },
]

export default async function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    const viewer = await getRoleAwareSession('ADMIN')

    protectAdminRoute({
        callbackUrl: '/admin',
        viewer,
    })

    return (
        <AppShell
            shellVariant='admin'
            audienceLabel='Administrator experience'
            title='A control surface for running each quest without losing the playful tone.'
            description='This authenticated shell gives the admin experience a stable home before data-backed management flows are implemented.'
            navItems={adminNavItems}
            metrics={adminMetrics}
            viewer={viewer}
        >
            {children}
        </AppShell>
    )
}
