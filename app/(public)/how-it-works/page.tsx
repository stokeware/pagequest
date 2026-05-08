import { PublicShell } from '@/components/public/public-shell'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui'

const steps = [
    {
        title: '1. Receive an invitation',
        description:
            'An administrator sends a quest invitation with a secure join link and the season details.',
    },
    {
        title: '2. Sign in and join',
        description:
            'Participants connect or create an account, then enter the active quest through the invitation flow.',
    },
    {
        title: '3. Log progress quickly',
        description:
            'Competitors record books, pages, audiobook minutes, and challenge completions from phones or desktops.',
    },
    {
        title: '4. Watch the leaderboard shift',
        description:
            'The scoreboard surfaces points and raw reading metrics without burying the family rivalry in clutter.',
    },
]

export default function HowItWorksPage() {
    return (
        <PublicShell
            eyebrow='Quest flow'
            title='How Page Quest runs a season from invite to leaderboard.'
            description='The public shell explains the full journey up front so competitors know what to expect before they ever log an entry.'
        >
            <div className='public-stack'>
                {steps.map((step) => (
                    <Card key={step.title} className='surface-card'>
                        <CardHeader>
                            <CardTitle>{step.title}</CardTitle>
                            <CardDescription>
                                {step.description}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ))}
                <Card className='surface-tint'>
                    <CardHeader>
                        <CardTitle>What comes next</CardTitle>
                        <CardDescription>
                            Later phases will connect these routes to Auth.js,
                            invitation validation, and the competitor dashboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className='public-card-copy'>
                            For now, the route map is stable and ready for
                            deeper feature work without reshaping the public
                            entry surface.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </PublicShell>
    )
}
