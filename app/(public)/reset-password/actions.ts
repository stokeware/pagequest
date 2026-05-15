'use server'

import { redirect } from 'next/navigation'

import { normalizeAuthEmail } from '@/lib/auth/email'
import { requestPasswordReset } from '@/lib/password-reset'

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

function buildResetPasswordRequestPath({
    email,
    error,
    outcome,
}: {
    email?: string
    error?: string
    outcome?: string
}) {
    const params = new URLSearchParams()

    if (email) {
        params.set('email', email)
    }

    if (error) {
        params.set('error', error)
    }

    if (outcome) {
        params.set('outcome', outcome)
    }

    return params.size > 0
        ? `/reset-password?${params.toString()}`
        : '/reset-password'
}

export async function requestPasswordResetAction(formData: FormData) {
    const email = normalizeAuthEmail(getStringField(formData, 'email')) ?? ''

    try {
        await requestPasswordReset(email)
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Password reset email delivery failed. Try again.'

        redirect(
            buildResetPasswordRequestPath({
                email,
                error: message,
            })
        )
    }

    redirect(
        buildResetPasswordRequestPath({
            email,
            outcome: 'sent',
        })
    )
}
