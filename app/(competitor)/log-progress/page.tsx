import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui'

const entryTypes = [
    'Book completion',
    'Pages read',
    'Audiobook minutes',
    'Challenge completion',
]

export default function LogProgressPage() {
    return (
        <div className='auth-page-stack'>
            <Card className='surface-card'>
                <CardHeader>
                    <CardTitle>Log progress</CardTitle>
                    <CardDescription>
                        This route reserves the authenticated space for the
                        fast-entry form that later phases will wire with React
                        Hook Form and Zod.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className='auth-pill-row'>
                        {entryTypes.map((type) => (
                            <span key={type} className='auth-pill'>
                                {type}
                            </span>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
