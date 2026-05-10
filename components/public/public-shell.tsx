import Link from 'next/link'
import { BookOpenText, Compass, KeyRound, ScrollText } from 'lucide-react'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    SkipLink,
} from '@/components/ui'
import { cn } from '@/lib/utils'

const navigationLinks = [
    { href: '/', label: 'Home' },
    { href: '/how-it-works', label: 'How it works' },
    { href: '/accept-invitation', label: 'Accept invitation' },
]

const quickActions = [
    {
        href: '/how-it-works',
        label: 'See the campaign flow',
        description:
            'Learn how invitations, scoring, and leaderboards fit together.',
        icon: Compass,
    },
    {
        href: '/sign-in',
        label: 'Check the sign-in path',
        description:
            'Use the local-first auth entry point that Phase 3 will connect.',
        icon: KeyRound,
    },
    {
        href: '/accept-invitation',
        label: 'Preview invite acceptance',
        description:
            'Open the route where invited competitors will join a campaign.',
        icon: ScrollText,
    },
]

type PublicShellProps = {
    eyebrow?: string
    title?: string
    description?: string
    children: React.ReactNode
    headerVariant?: 'default' | 'brand-only'
    contentVariant?: 'default' | 'compact'
}

export function PublicShell({
    eyebrow,
    title,
    description,
    children,
    headerVariant = 'default',
    contentVariant = 'default',
}: PublicShellProps) {
    const showHero =
        contentVariant === 'default' && eyebrow && title && description

    return (
        <div className='public-shell'>
            <SkipLink targetId='main-content'>Skip to main content</SkipLink>
            <div className='public-glow public-glow-left' aria-hidden='true' />
            <div className='public-glow public-glow-right' aria-hidden='true' />

            <header
                className={cn(
                    'public-topbar',
                    headerVariant === 'brand-only' && 'public-topbar-brand-only'
                )}
            >
                <Link href='/' className='public-brand'>
                    <span className='public-brand-mark' aria-hidden='true'>
                        <BookOpenText className='size-4' />
                    </span>
                    <span>Page Quest</span>
                </Link>

                {headerVariant === 'default' ? (
                    <>
                        <nav
                            className='public-nav'
                            aria-label='Public navigation'
                        >
                            {navigationLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className='public-nav-link'
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        <div className='public-topbar-actions'>
                            <Button render={<Link href='/sign-in' />}>
                                Sign in
                            </Button>
                        </div>
                    </>
                ) : null}
            </header>

            <main
                id='main-content'
                tabIndex={-1}
                className={cn(
                    'public-main',
                    contentVariant === 'compact' && 'public-main-compact'
                )}
            >
                {showHero ? (
                    <>
                        <section className='public-hero'>
                            <div className='public-hero-copy'>
                                <p className='eyebrow'>{eyebrow}</p>
                                <h1>{title}</h1>
                                <p className='public-description'>
                                    {description}
                                </p>
                                <div className='public-hero-actions'>
                                    <Button render={<Link href='/sign-in' />}>
                                        Sign in
                                    </Button>
                                    <Button
                                        variant='outline'
                                        render={<Link href='/how-it-works' />}
                                    >
                                        How it works
                                    </Button>
                                </div>
                            </div>

                            <Card className='public-summary-card surface-warm'>
                                <CardHeader>
                                    <CardTitle>Public entry points</CardTitle>
                                    <CardDescription>
                                        These routes establish the MVP shell
                                        before auth and invitation logic are
                                        wired.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className='space-y-3'>
                                    {quickActions.map((action) => {
                                        const Icon = action.icon

                                        return (
                                            <Link
                                                key={action.href}
                                                href={action.href}
                                                className='public-quick-link'
                                            >
                                                <span
                                                    className='public-quick-icon'
                                                    aria-hidden='true'
                                                >
                                                    <Icon className='size-4' />
                                                </span>
                                                <span>
                                                    <span className='public-quick-title'>
                                                        {action.label}
                                                    </span>
                                                    <span className='public-quick-description'>
                                                        {action.description}
                                                    </span>
                                                </span>
                                            </Link>
                                        )
                                    })}
                                </CardContent>
                            </Card>
                        </section>

                        <section className='public-content'>{children}</section>
                    </>
                ) : (
                    <section className='public-content public-content-compact'>
                        {children}
                    </section>
                )}
            </main>
        </div>
    )
}
