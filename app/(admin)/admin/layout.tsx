import {
    AppShell,
    type ShellNavItem,
} from '@/components/authenticated/app-shell'
import { getRoleAwareSession, protectAdminRoute } from '@/lib/auth/session'

const adminNavItems: ShellNavItem[] = [
    { href: '/admin', label: 'Overview', icon: 'shield-check' },
    { href: '/admin/campaigns', label: 'Campaigns', icon: 'folder-kanban' },
    {
        href: '/admin/challenges',
        label: 'Challenges',
        icon: 'clipboard-pen-line',
    },
    { href: '/admin/invitations', label: 'Invitations', icon: 'mail-plus' },
    { href: '/admin/reports', label: 'Reports', icon: 'table-properties' },
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
        <AppShell shellVariant='admin' navItems={adminNavItems} viewer={viewer}>
            {children}
        </AppShell>
    )
}
