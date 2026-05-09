'use client'

import { RouteErrorBoundary } from '@/components/ui'

export default function CompetitorError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <RouteErrorBoundary
            error={error}
            reset={reset}
            eyebrow='Competitor route error'
            title='Your reading dashboard could not finish loading.'
            description='Try this screen again or head back to the dashboard while Page Quest recovers the competitor view.'
            returnHref='/dashboard'
            returnLabel='Open dashboard'
        />
    )
}
