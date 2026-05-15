import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const passwordResetActionMocks = vi.hoisted(() => {
    const redirect = vi.fn((url: string) => {
        const error = new Error(`NEXT_REDIRECT:${url}`) as Error & {
            digest: string
        }

        error.digest = `NEXT_REDIRECT;${url}`

        throw error
    })
    const resetPasswordWithToken = vi.fn()

    return {
        redirect,
        resetPasswordWithToken,
    }
})

vi.mock('next/navigation', () => ({
    redirect: passwordResetActionMocks.redirect,
}))

vi.mock('@/lib/password-reset', async () => {
    const actual = await vi.importActual<typeof import('@/lib/password-reset')>(
        '@/lib/password-reset'
    )

    return {
        ...actual,
        resetPasswordWithToken: passwordResetActionMocks.resetPasswordWithToken,
    }
})

import { completePasswordResetAction } from '@/app/(public)/reset-password/confirm/actions'

describe('completePasswordResetAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('redirects to sign-in when the password reset succeeds', async () => {
        passwordResetActionMocks.resetPasswordWithToken.mockResolvedValue({
            email: 'reader@example.com',
            outcome: 'updated',
        })

        const formData = new FormData()
        formData.set('token', 'x'.repeat(32))
        formData.set('password', 'updated-password')
        formData.set('passwordConfirmation', 'updated-password')

        await expect(
            completePasswordResetAction(formData)
        ).rejects.toMatchObject({
            digest: 'NEXT_REDIRECT;/sign-in?email=reader%40example.com&passwordReset=1',
        })
    })

    it('redirects back to the form with an error when confirmation does not match', async () => {
        const formData = new FormData()
        formData.set('token', 'x'.repeat(32))
        formData.set('password', 'updated-password')
        formData.set('passwordConfirmation', 'different-password')

        await expect(
            completePasswordResetAction(formData)
        ).rejects.toMatchObject({
            digest: expect.stringContaining('/reset-password/confirm?token='),
        })

        expect(
            passwordResetActionMocks.resetPasswordWithToken
        ).not.toHaveBeenCalled()
    })
})
