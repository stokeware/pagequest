'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useSyncExternalStore, useTransition } from 'react'

import {
    Button,
    ErrorState,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import { signInWithPasswordAction } from '@/app/(public)/sign-in/actions'

type PasswordSignInCardProps = {
    defaultEmail: string
    errorMessage: string | null
    invitationWasCreated: boolean
    isHydrated: boolean
    isPending: boolean
    onSubmit: React.FormEventHandler<HTMLFormElement>
    passwordResetWasCompleted: boolean
}

function subscribeToHydration() {
    return () => undefined
}

function getClientHydrationSnapshot() {
    return true
}

function getServerHydrationSnapshot() {
    return false
}

export function PasswordSignInCard({
    defaultEmail,
    errorMessage,
    invitationWasCreated,
    isHydrated,
    isPending,
    onSubmit,
    passwordResetWasCompleted,
}: PasswordSignInCardProps) {
    return (
        <FormCard
            title={<span className='text-3xl tracking-tight'>Sign in</span>}
        >
            <form onSubmit={onSubmit} method='post' className='space-y-4'>
                {invitationWasCreated ? (
                    <div className='rounded-lg border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'>
                        Your account is ready. Sign in with the invited email to
                        open your dashboard.
                    </div>
                ) : null}

                {passwordResetWasCompleted ? (
                    <div className='rounded-lg border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'>
                        Your password has been reset. Sign in with your new
                        password.
                    </div>
                ) : null}

                <FormField label='Email address' htmlFor='email'>
                    <Input
                        id='email'
                        name='email'
                        type='email'
                        inputMode='email'
                        placeholder='reader@example.com'
                        autoComplete='email'
                        defaultValue={defaultEmail}
                        disabled={!isHydrated || isPending}
                        required
                    />
                </FormField>

                <FormField label='Password' htmlFor='password'>
                    <Input
                        id='password'
                        name='password'
                        type='password'
                        placeholder='Enter your password'
                        autoComplete='current-password'
                        disabled={!isHydrated || isPending}
                        required
                    />
                </FormField>

                {errorMessage ? (
                    <ErrorState
                        eyebrow='Sign-in error'
                        title='Sign-in failed.'
                        description={errorMessage}
                    />
                ) : null}

                <FormActions>
                    <Button type='submit' disabled={!isHydrated || isPending}>
                        {isPending
                            ? 'Signing in...'
                            : !isHydrated
                              ? 'Preparing sign-in...'
                              : 'Sign In'}
                    </Button>
                    <Button
                        variant='outline'
                        render={<Link href='/reset-password' />}
                    >
                        Reset Password
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}

export function SignInForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const isHydrated = useSyncExternalStore(
        subscribeToHydration,
        getClientHydrationSnapshot,
        getServerHydrationSnapshot
    )
    const callbackUrl = searchParams.get('callbackUrl')?.trim() || ''
    const defaultEmail = searchParams.get('email')?.trim() || ''
    const invitationWasCreated = searchParams.get('invitation') === 'created'
    const passwordResetWasCompleted = searchParams.get('passwordReset') === '1'

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setErrorMessage(null)

        const formData = new FormData(event.currentTarget)
        formData.set('callbackUrl', callbackUrl)

        startTransition(async () => {
            const result = await signInWithPasswordAction(formData)

            if (result?.error) {
                setErrorMessage(result.error)
                return
            }

            router.refresh()
        })
    }

    return (
        <PasswordSignInCard
            defaultEmail={defaultEmail}
            errorMessage={errorMessage}
            invitationWasCreated={invitationWasCreated}
            isHydrated={isHydrated}
            isPending={isPending}
            onSubmit={handleSubmit}
            passwordResetWasCompleted={passwordResetWasCompleted}
        />
    )
}
