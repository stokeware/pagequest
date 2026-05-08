import { cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from './card'

type EmptyStateProps = {
    eyebrow?: React.ReactNode
    title: React.ReactNode
    description: React.ReactNode
    action?: React.ReactNode
    className?: string
}

function EmptyState({
    eyebrow,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <Card className={cn('surface-warm ui-empty-state', className)}>
            <CardHeader className='ui-empty-state-header'>
                {eyebrow ? (
                    <p className='ui-empty-state-eyebrow'>{eyebrow}</p>
                ) : null}
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className='ui-empty-state-content'>
                <p className='ui-empty-state-description'>{description}</p>
                {action ? (
                    <div className='ui-empty-state-action'>{action}</div>
                ) : null}
            </CardContent>
        </Card>
    )
}

export { EmptyState }
