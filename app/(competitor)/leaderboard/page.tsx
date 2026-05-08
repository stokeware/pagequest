import { TableCard } from '@/components/ui'

const rows = [
    {
        key: 'morgan',
        cells: ['1', 'Morgan', '1,240', '1,240 pages'],
    },
    {
        key: 'avery',
        cells: ['2', 'Avery', '1,222', '1,127 pages + 95 minutes'],
    },
    {
        key: 'jordan',
        cells: ['3', 'Jordan', '1,010', '4 books + 390 pages'],
    },
]

export default function LeaderboardPage() {
    return (
        <TableCard
            title='Leaderboard shell'
            description='The future leaderboard will stay summary-focused here and link outward to richer participant history pages.'
            columns={['Rank', 'Reader', 'Points', 'Highlights']}
            rows={rows}
            ariaLabel='Leaderboard preview'
        />
    )
}
