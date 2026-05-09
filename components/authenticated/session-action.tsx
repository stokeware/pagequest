'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui'

type SessionActionProps = {
    isAuthenticated: boolean
}

export function SessionAction({ isAuthenticated }: SessionActionProps) {
    if (!isAuthenticated) {
        return <Button render={<Link href='/sign-in' />}>Sign in</Button>
    }

    return (
        <Button
            variant='outline'
            onClick={() => signOut({ callbackUrl: '/sign-in' })}
        >
            Log out
        </Button>
    )
}
