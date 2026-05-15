import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PasswordSignInCard } from '@/components/public/sign-in-form'
import {
    InvitationExistingAccountCard,
    InvitationSignupCard,
    InvitationTokenCard,
} from '@/app/(public)/accept-invitation/page'
import { ResetPasswordRequestCard } from '@/app/(public)/reset-password/page'
import { PasswordResetConfirmCard } from '@/app/(public)/reset-password/confirm/page'

describe('public auth ui', () => {
    it('renders the password sign-in card with labels and reset entry point', () => {
        const html = renderToStaticMarkup(
            <PasswordSignInCard
                defaultEmail='reader@example.com'
                errorMessage='Sign-in failed. Check your email and password and try again.'
                invitationWasCreated={true}
                isHydrated={true}
                isPending={false}
                onSubmit={() => undefined}
                passwordResetWasCompleted={true}
            />
        )

        expect(html).toContain('Your account is ready.')
        expect(html).toContain('Your password has been reset.')
        expect(html).toContain('Email address')
        expect(html).toContain('Password')
        expect(html).toContain('reader@example.com')
        expect(html).toContain('Reset Password')
        expect(html).toContain('Sign-in failed.')
    })

    it('renders the password reset request form with a single email field', () => {
        const html = renderToStaticMarkup(
            <ResetPasswordRequestCard
                defaultEmail='reader@example.com'
                errorMessage={null}
                sent={true}
            />
        )

        expect(html).toContain('Reset password')
        expect(html).toContain('Email address')
        expect(html).toContain('reader@example.com')
        expect(html).toContain('If a Page Quest account matches that email')
        expect(html).toContain('Send email')
    })

    it('renders the password reset confirmation form with a read-only email', () => {
        const html = renderToStaticMarkup(
            <PasswordResetConfirmCard
                email='reader@example.com'
                errorMessage='Passwords do not match.'
                token={'x'.repeat(32)}
            />
        )

        expect(html).toContain('Reset password')
        expect(html).toContain('reader@example.com')
        expect(html).toContain('Password')
        expect(html).toContain('Repeat password')
        expect(html).toContain('Reset Password')
        expect(html).toContain('Passwords do not match.')
    })

    it('renders the invitation signup form with the read-only email and password fields', () => {
        const html = renderToStaticMarkup(
            <InvitationSignupCard
                access={{
                    canAccept: false,
                    campaignName: 'Spring Story Sprint 2026',
                    expectedEmail: 'reader@example.com',
                    state: 'sign-in-required',
                    summary: 'Create your Page Quest account to continue.',
                }}
                token={'x'.repeat(32)}
            />
        )

        expect(html).toContain('Create your Page Quest account.')
        expect(html).toContain('Invited email')
        expect(html).toContain('reader@example.com')
        expect(html).toContain('Name')
        expect(html).toContain('Password')
        expect(html).toContain('Confirm password')
        expect(html).toContain('Create account')
    })

    it('renders the existing-account invitation path with a sign-in call to action', () => {
        const html = renderToStaticMarkup(
            <InvitationExistingAccountCard
                access={{
                    canAccept: false,
                    campaignName: null,
                    expectedEmail: 'reader@example.com',
                    state: 'sign-in-required',
                    summary: 'Sign in with the invited email to continue.',
                }}
                token={'x'.repeat(32)}
            />
        )

        expect(html).toContain('already has a Page Quest account')
        expect(html).toContain('finish accepting this invitation')
        expect(html).toContain('Continue to sign in')
        expect(html).not.toContain('Create account')
    })

    it('renders the ready invitation card without legacy invite copy', () => {
        const html = renderToStaticMarkup(
            <InvitationTokenCard
                access={{
                    canAccept: true,
                    campaignName: 'Spring Story Sprint 2026',
                    expectedEmail: 'reader@example.com',
                    state: 'ready',
                    summary:
                        'Everything is ready. Accept this invitation to continue.',
                }}
                hasExistingPasswordAccount={true}
                token={'x'.repeat(32)}
            />
        )

        expect(html).toContain('Welcome to Page Quest.')
        expect(html).toContain('Accept invitation')
        expect(html).toContain(
            'Accepting this invitation adds your account to this campaign.'
        )
        expect(html).not.toContain('legacy invite')
    })
})
