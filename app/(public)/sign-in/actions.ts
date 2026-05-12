'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
    authenticatePasswordUser,
    createAuthSession,
    getAuthSessionCookie,
} from '@/lib/auth'
import { getSignedInLandingPath } from '@/lib/auth/access'

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

export async function signInWithPasswordAction(formData: FormData) {
    const callbackUrl = getStringField(formData, 'callbackUrl')
    const email = getStringField(formData, 'email')
    const password = getStringField(formData, 'password')
    const user = await authenticatePasswordUser({
        email,
        password,
    })

    if (!user) {
        return {
            error: 'Sign-in failed. Check your email and password and try again.',
        }
    }

    const session = await createAuthSession(user.id)
    const sessionCookie = getAuthSessionCookie()
    const cookieStore = await cookies()

    cookieStore.set(sessionCookie.name, session.sessionToken, {
        ...sessionCookie.options,
        expires: session.expires,
        maxAge: sessionCookie.maxAge,
    })

    redirect(
        getSignedInLandingPath({
            callbackUrl,
            grantedRoles: user.roles,
            isAuthenticated: true,
        })
    )
}
