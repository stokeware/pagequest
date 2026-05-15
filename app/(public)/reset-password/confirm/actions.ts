'use server'

import { redirect } from 'next/navigation'

import { assertPasswordConfirmation } from '@/lib/auth/password'
import {
    normalizePasswordResetToken,
    resetPasswordWithToken,
} from '@/lib/password-reset'

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

function buildPasswordResetConfirmPath({
    error,
    token,
}: {
    error?: string
    token?: string
} = {}) {
    const params = new URLSearchParams()

    if (token) {
        params.set('token', token)
    }

    if (error) {
        params.set('error', error)
    }

    return params.size > 0
        ? `/reset-password/confirm?${params.toString()}`
        : '/reset-password/confirm'
}

export async function completePasswordResetAction(formData: FormData) {
    const token = normalizePasswordResetToken(getStringField(formData, 'token'))
    const password = getStringField(formData, 'password')
    const passwordConfirmation = getStringField(
        formData,
        'passwordConfirmation'
    )

    if (!token) {
        redirect(buildPasswordResetConfirmPath())
    }

    try {
        assertPasswordConfirmation({
            password,
            passwordConfirmation,
        })

        const result = await resetPasswordWithToken({
            password,
            token,
        })

        if (result.outcome === 'updated') {
            const params = new URLSearchParams({
                email: result.email,
                passwordReset: '1',
            })

            redirect(`/sign-in?${params.toString()}`)
        }

        redirect(buildPasswordResetConfirmPath({ token }))
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Password reset failed. Try again.'

        redirect(
            buildPasswordResetConfirmPath({
                error: message,
                token,
            })
        )
    }
}
