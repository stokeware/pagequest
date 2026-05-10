import {
    AppShell,
    type ShellNavItem,
} from '@/components/authenticated/app-shell'
import { getRoleAwareSession, protectAdminRoute } from '@/lib/auth/session'

const adminNavItems: ShellNavItem[] = [
    { href: '/admin/campaigns', label: 'Campaigns', icon: 'folder-kanban' },
    {
        href: '/admin/challenges',
        label: 'Challenges',
        icon: 'clipboard-pen-line',
    },
    { href: '/admin/members', label: 'Members', icon: 'mail-plus' },
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
