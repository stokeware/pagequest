import Link from 'next/link'

import { PublicShell } from '@/components/public/public-shell'
import {
    Button,
    EmptyState,
    ErrorState,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import { getPasswordResetAccess } from '@/lib/password-reset'

import { completePasswordResetAction } from './actions'

type PasswordResetConfirmPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type PasswordResetConfirmCardProps = {
    email: string
    errorMessage: string | null
    token: string
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0]?.trim() || null
    }

    return value?.trim() || null
}

export function PasswordResetConfirmCard({
    email,
    errorMessage,
    token,
}: PasswordResetConfirmCardProps) {
    return (
        <FormCard
            title={
                <span className='text-3xl tracking-tight'>Reset password</span>
            }
        >
            <form
                action={completePasswordResetAction}
                className='ui-form-shell'
            >
                <input type='hidden' name='token' value={token} />

                <FormField
                    label='Email address'
                    htmlFor='password-reset-confirm-email'
                >
                    <Input
                        id='password-reset-confirm-email'
                        value={email}
                        readOnly
                    />
                </FormField>

                <FormField
                    label='Password'
                    htmlFor='password-reset-confirm-password'
                >
                    <Input
                        id='password-reset-confirm-password'
                        name='password'
                        type='password'
                        autoComplete='new-password'
                        required
                    />
                </FormField>

                <FormField
                    label='Repeat password'
                    htmlFor='password-reset-confirm-password-confirmation'
                >
                    <Input
                        id='password-reset-confirm-password-confirmation'
                        name='passwordConfirmation'
                        type='password'
                        autoComplete='new-password'
                        required
                    />
                </FormField>

                {errorMessage ? (
                    <ErrorState
                        eyebrow='Password reset error'
                        title='Password reset failed.'
                        description={errorMessage}
                    />
                ) : null}

                <FormActions>
                    <Button nativeButton type='submit'>
                        Reset Password
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}

export default async function PasswordResetConfirmPage({
    searchParams,
}: PasswordResetConfirmPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const token = getFirstSearchParamValue(resolvedSearchParams.token)
    const errorMessage = getFirstSearchParamValue(resolvedSearchParams.error)
    const access = await getPasswordResetAccess(token)

    return (
        <PublicShell headerVariant='brand-only' contentVariant='default'>
            <h1 className='sr-only'>Reset password</h1>
            {access.state === 'invalid' ? (
                <EmptyState
                    eyebrow='Reset password'
                    title='This password reset link is not valid.'
                    description='Request a new password reset email from the sign-in page.'
                    action={
                        <Button
                            variant='outline'
                            render={<Link href='/reset-password' />}
                        >
                            Request new email
                        </Button>
                    }
                />
            ) : access.state === 'expired' ? (
                <EmptyState
                    eyebrow='Reset password'
                    title='This password reset link expired.'
                    description='Request a new password reset email to choose a new password.'
                    action={
                        <Button
                            variant='outline'
                            render={<Link href='/reset-password' />}
                        >
                            Request new email
                        </Button>
                    }
                />
            ) : (
                <PasswordResetConfirmCard
                    email={access.email ?? ''}
                    errorMessage={errorMessage}
                    token={token ?? ''}
                />
            )}
        </PublicShell>
    )
}
