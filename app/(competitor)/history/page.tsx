import Link from 'next/link'

import { Button, EmptyState } from '@/components/ui'

export default function HistoryPage() {
    return (
        <EmptyState
            eyebrow='History'
            title='Your reading timeline will land here.'
            description='Once live data is wired, this area will show a chronological entry list with filters for quest, entry type, and edits.'
            action={
                <Button variant='outline' render={<Link href='/leaderboard' />}>
                    Browse the leaderboard
                </Button>
            }
        />
    )
}
