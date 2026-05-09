'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui'

type SessionActionProps = {
    isAuthenticated: boolean
}

export function SessionAction({ isAuthenticated }: SessionActionProps) {
    if (!isAuthenticated) {
        return (
            <Link href='/sign-in' className='auth-utility-link'>
                Go to sign in
            </Link>
        )
    }

    return (
        <Button
            variant='outline'
            onClick={() => signOut({ callbackUrl: '/sign-in' })}
        >
            Sign out
        </Button>
    )
}
