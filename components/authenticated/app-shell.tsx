'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    BookMarked,
    BookOpenText,
    ClipboardPenLine,
    FolderKanban,
    History,
    MailPlus,
    ShieldCheck,
    TableProperties,
    Trophy,
    type LucideIcon,
} from 'lucide-react'

import { SkipLink } from '@/components/ui'
import { SessionAction } from '@/components/authenticated/session-action'
import type { RoleAwareSession } from '@/lib/auth/session'
import { cn } from '@/lib/utils'

export type ShellNavItem = {
    href: string
    label: string
    icon: ShellNavIcon
}

export type ShellNavIcon =
    | 'book-marked'
    | 'clipboard-pen-line'
    | 'folder-kanban'
    | 'history'
    | 'mail-plus'
    | 'shield-check'
    | 'table-properties'
    | 'trophy'

type AppShellProps = {
    shellVariant: 'competitor' | 'admin'
    navItems: ShellNavItem[]
    viewer: RoleAwareSession
    children: React.ReactNode
}

const navIconMap: Record<ShellNavIcon, LucideIcon> = {
    'book-marked': BookMarked,
    'clipboard-pen-line': ClipboardPenLine,
    'folder-kanban': FolderKanban,
    history: History,
    'mail-plus': MailPlus,
    'shield-check': ShieldCheck,
    'table-properties': TableProperties,
    trophy: Trophy,
}

export function AppShell({
    shellVariant,
    navItems,
    viewer,
    children,
}: AppShellProps) {
    const pathname = usePathname()

    return (
        <div className={cn('auth-shell', `auth-shell-${shellVariant}`)}>
            <SkipLink targetId='main-content'>Skip to main content</SkipLink>
            <div className='auth-glow auth-glow-left' aria-hidden='true' />
            <div className='auth-glow auth-glow-right' aria-hidden='true' />

            <header className='auth-topbar surface-panel'>
                <Link href='/' className='auth-brand'>
                    <span className='auth-brand-mark' aria-hidden='true'>
                        <BookOpenText className='size-4' />
                    </span>
                    <span>Page Quest</span>
                </Link>

                <nav
                    className='auth-header-nav'
                    aria-label='Authenticated navigation'
                >
                    {navItems.map((item) => {
                        const Icon = navIconMap[item.icon]
                        const isActive =
                            pathname === item.href ||
                            (item.href !== '/' &&
                                pathname.startsWith(`${item.href}/`))

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'auth-header-nav-link',
                                    isActive && 'auth-header-nav-link-active'
                                )}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <Icon className='size-4' aria-hidden='true' />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className='auth-topbar-actions'>
                    <SessionAction isAuthenticated={viewer.isAuthenticated} />
                </div>
            </header>

            <main id='main-content' tabIndex={-1} className='auth-stage'>
                <section className='auth-content surface-panel'>
                    {children}
                </section>
            </main>
        </div>
    )
}
