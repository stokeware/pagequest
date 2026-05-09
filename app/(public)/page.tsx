import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
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

export default function HomePage() {
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
