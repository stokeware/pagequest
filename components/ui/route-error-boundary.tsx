'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { Button } from './button'
import { ErrorState } from './error-state'

type RouteErrorBoundaryProps = {
    error: Error & { digest?: string }
    reset: () => void
    eyebrow?: string
    title: string
    description: string
    returnHref: string
    returnLabel: string
}

export function RouteErrorBoundary({
    error,
    reset,
    eyebrow,
    title,
    description,
    returnHref,
    returnLabel,
}: RouteErrorBoundaryProps) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className='route-error-shell'>
            <div className='route-error-panel'>
                <ErrorState
                    eyebrow={eyebrow}
                    title={title}
                    description={description}
                    errorId={error.digest ?? null}
                    action={
                        <>
                            <Button onClick={() => reset()}>Try again</Button>
                            <Button
                                variant='outline'
                                render={<Link href={returnHref} />}
                            >
                                {returnLabel}
                            </Button>
                        </>
                    }
                />
            </div>
        </div>
    )
}
