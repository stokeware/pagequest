import { cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from './card'

type ErrorStateProps = {
    eyebrow?: React.ReactNode
    title: React.ReactNode
    description: React.ReactNode
    action?: React.ReactNode
    errorId?: string | null
    className?: string
}

function ErrorState({
    eyebrow = 'Something went wrong',
    title,
    description,
    action,
    errorId,
    className,
}: ErrorStateProps) {
    return (
        <Card className={cn('surface-warm ui-error-state', className)}>
            <CardHeader className='ui-error-header'>
                <p className='ui-error-eyebrow'>{eyebrow}</p>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className='ui-error-content' role='alert'>
                <p className='ui-error-description'>{description}</p>
                {errorId ? (
                    <p className='ui-error-reference'>Reference: {errorId}</p>
                ) : null}
                {action ? (
                    <div className='ui-error-actions'>{action}</div>
                ) : null}
            </CardContent>
        </Card>
    )
}

export { ErrorState }
