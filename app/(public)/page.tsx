import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { authOptions } from '@/lib/auth'
import { getSignedInLandingPath } from '@/lib/auth/access'
import { PublicShell } from '@/components/public/public-shell'

const highlights = [
    {
        title: 'Track every kind of reading',
        body: 'Books, pages, audiobook minutes, and special challenges all roll into one family campaign.',
    },
    {
        title: 'Keep the competition friendly',
        body: 'Seasonal standings stay readable on phones while still showing the details that matter.',
    },
    {
        title: 'Stay local-first',
        body: 'This MVP route shell works without Azure dependencies and leaves room for later production adapters.',
    },
]

export default async function HomePage() {
    const session = await getServerSession(authOptions)
    const redirectPath = getSignedInLandingPath({
        grantedRoles: Array.isArray(session?.user?.roles)
            ? session.user.roles
            : [],
    })

    if (redirectPath) {
        redirect(redirectPath)
    }

    return (
        <PublicShell
            eyebrow='Seasonal reading competition'
            title='A storybook home for family reading campaigns.'
            description='Page Quest gives every season a clear launch point: learn the rules, sign in, and accept an invitation before the deeper competitor and admin experiences arrive.'
        >
            <div className='public-grid'>
                {highlights.map((highlight) => (
                    <Card key={highlight.title} className='surface-card'>
                        <CardHeader>
                            <CardTitle>{highlight.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className='public-card-copy'>{highlight.body}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </PublicShell>
    )
}
