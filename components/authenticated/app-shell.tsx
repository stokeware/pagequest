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

import {
    CardDescription,
    CardHeader,
    CardTitle,
    StatCard,
} from '@/components/ui'
import { cn } from '@/lib/utils'

type ShellNavItem = {
    href: string
    label: string
    icon: ShellNavIcon
}

type ShellNavIcon =
    | 'book-marked'
    | 'clipboard-pen-line'
    | 'folder-kanban'
    | 'history'
    | 'mail-plus'
    | 'shield-check'
    | 'table-properties'
    | 'trophy'

type ShellMetric = {
    label: string
    value: string
    detail: string
}

type AppShellProps = {
    shellVariant: 'competitor' | 'admin'
    audienceLabel: string
    title: string
    description: string
    navItems: ShellNavItem[]
    metrics: ShellMetric[]
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
    audienceLabel,
    title,
    description,
    navItems,
    metrics,
    children,
}: AppShellProps) {
    const pathname = usePathname()
    const activeNavItem = navItems.find(
        (item) =>
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(`${item.href}/`))
    )

    const shellNote =
        shellVariant === 'competitor'
            ? 'Mobile-first competitor shell prototype'
            : 'Admin shell with rail and compact header navigation'

    return (
        <div className={cn('auth-shell', `auth-shell-${shellVariant}`)}>
            <div className='auth-glow auth-glow-left' aria-hidden='true' />
            <div className='auth-glow auth-glow-right' aria-hidden='true' />

            <header className='auth-topbar surface-panel'>
                <Link href='/' className='auth-brand'>
                    <span className='auth-brand-mark' aria-hidden='true'>
                        <BookOpenText className='size-4' />
                    </span>
                    <span>Page Quest</span>
                </Link>

                <div className='auth-topbar-copy'>
                    <p className='auth-kicker'>{audienceLabel}</p>
                    <p className='auth-topbar-note'>{shellNote}</p>
                </div>

                <div className='auth-topbar-actions'>
                    {activeNavItem ? (
                        <p className='auth-active-section'>
                            Current section: {activeNavItem.label}
                        </p>
                    ) : null}
                    <Link href='/sign-in' className='auth-utility-link'>
                        Return to sign in
                    </Link>
                </div>
            </header>

            {shellVariant === 'admin' ? (
                <div className='auth-admin-mobile-nav surface-panel'>
                    <p className='auth-admin-mobile-label'>Admin sections</p>
                    <nav
                        className='auth-header-nav'
                        aria-label='Administrator quick navigation'
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
                                        isActive &&
                                            'auth-header-nav-link-active'
                                    )}
                                    aria-current={isActive ? 'page' : undefined}
                                >
                                    <Icon
                                        className='size-4'
                                        aria-hidden='true'
                                    />
                                    <span>{item.label}</span>
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            ) : null}

            <div className='auth-frame'>
                <aside
                    className={cn(
                        'auth-sidebar surface-panel',
                        `auth-sidebar-${shellVariant}`
                    )}
                >
                    <div className='auth-sidebar-nav'>
                        <p className='auth-sidebar-label'>
                            Navigate this workspace
                        </p>
                        <nav
                            className='auth-nav'
                            aria-label={`${audienceLabel} navigation`}
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
                                            'auth-nav-link',
                                            isActive && 'auth-nav-link-active'
                                        )}
                                        aria-current={
                                            isActive ? 'page' : undefined
                                        }
                                    >
                                        <span
                                            className='auth-nav-icon'
                                            aria-hidden='true'
                                        >
                                            <Icon className='size-4' />
                                        </span>
                                        <span>{item.label}</span>
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    <div className='auth-sidebar-panel auth-sidebar-stats'>
                        <CardHeader>
                            <CardTitle>Season snapshot</CardTitle>
                            <CardDescription>
                                Static placeholder context until auth, live
                                data, and server-side guards are wired.
                            </CardDescription>
                        </CardHeader>
                        <div className='auth-metric-grid'>
                            {metrics.map((metric) => (
                                <StatCard
                                    key={metric.label}
                                    eyebrow={metric.label}
                                    title={metric.value}
                                    description={metric.detail}
                                    className='surface-warm'
                                />
                            ))}
                        </div>
                    </div>
                </aside>

                <main className='auth-stage'>
                    <section className='auth-hero surface-panel'>
                        <p className='eyebrow'>{audienceLabel}</p>
                        <h1>{title}</h1>
                        <p className='auth-description'>{description}</p>
                    </section>

                    <section className='auth-content surface-panel'>
                        {children}
                    </section>
                </main>
            </div>

            {shellVariant === 'competitor' ? (
                <nav
                    className='auth-mobile-nav surface-panel'
                    aria-label='Competitor mobile navigation'
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
                                    'auth-mobile-nav-link',
                                    isActive && 'auth-mobile-nav-link-active'
                                )}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <Icon className='size-4' aria-hidden='true' />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>
            ) : null}
        </div>
    )
}
