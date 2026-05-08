import { cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from './card'

type StatCardProps = {
    eyebrow?: React.ReactNode
    title: React.ReactNode
    value?: React.ReactNode
    description?: React.ReactNode
    className?: string
}

function StatCard({
    eyebrow,
    title,
    value,
    description,
    className,
}: StatCardProps) {
    return (
        <Card className={cn('surface-card ui-stat-card', className)}>
            <CardHeader className='ui-stat-header'>
                {eyebrow ? <p className='ui-stat-eyebrow'>{eyebrow}</p> : null}
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            {value || description ? (
                <CardContent className='ui-stat-content'>
                    {value ? (
                        <strong className='ui-stat-value'>{value}</strong>
                    ) : null}
                    {description ? (
                        <p className='ui-stat-description'>{description}</p>
                    ) : null}
                </CardContent>
            ) : null}
        </Card>
    )
}

export { StatCard }
