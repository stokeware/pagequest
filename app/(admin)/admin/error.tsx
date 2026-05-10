'use client'

import { RouteErrorBoundary } from '@/components/ui'

export default function AdminError({
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
            eyebrow='Admin route error'
            title='The admin control surface ran into a problem.'
            description='Try this route again or return to campaigns while Page Quest reloads the management view.'
            returnHref='/admin/campaigns'
            returnLabel='Open campaigns'
        />
    )
}
