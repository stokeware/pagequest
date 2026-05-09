import { cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from './card'

type LoadingStateProps = {
    eyebrow?: React.ReactNode
    title?: React.ReactNode
    description?: React.ReactNode
    className?: string
    lines?: number
}

function LoadingState({
    eyebrow = 'Loading',
    title = 'Gathering the next chapter.',
    description = 'Page Quest is preparing this screen.',
    className,
    lines = 3,
}: LoadingStateProps) {
    const clampedLines = Math.min(Math.max(lines, 1), 4)

    return (
        <Card
            className={cn('surface-card ui-loading-state', className)}
            role='status'
            aria-live='polite'
            aria-busy='true'
        >
            <CardHeader className='ui-loading-header'>
                <p className='ui-loading-eyebrow'>{eyebrow}</p>
                <CardTitle>{title}</CardTitle>
                <p className='ui-loading-description'>{description}</p>
            </CardHeader>
            <CardContent className='ui-loading-content'>
                {Array.from({ length: clampedLines }).map((_, index) => (
                    <span
                        key={index}
                        className={cn(
                            'ui-loading-line',
                            index === clampedLines - 1 &&
                                'ui-loading-line-short'
                        )}
                    />
                ))}
            </CardContent>
        </Card>
    )
}

export { LoadingState }
