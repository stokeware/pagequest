'use client'

import { RouteErrorBoundary } from '@/components/ui'

export default function PublicError({
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
            eyebrow='Public route error'
            title='This public page hit an unexpected problem.'
            description='Try the route again or return home while Page Quest reloads the public experience.'
            returnHref='/'
            returnLabel='Return home'
        />
    )
}
