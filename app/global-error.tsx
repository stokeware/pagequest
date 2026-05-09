'use client'

import { RouteErrorBoundary } from '@/components/ui'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html lang='en' className='h-full antialiased font-sans'>
            <body className='min-h-full'>
                <RouteErrorBoundary
                    error={error}
                    reset={reset}
                    eyebrow='Application error'
                    title='Page Quest could not finish rendering the app.'
                    description='Try again or return home while the application reloads from a stable route.'
                    returnHref='/'
                    returnLabel='Return home'
                />
            </body>
        </html>
    )
}
