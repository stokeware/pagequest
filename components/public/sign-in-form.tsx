'use client'

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

type SignInFormProps = {
    localDemoEmails: readonly string[]
}

type PasswordSignInCardProps = {
    defaultEmail: string
    errorMessage: string | null
    invitationWasCreated: boolean
    isHydrated: boolean
    isPending: boolean
    localDemoEmails: readonly string[]
    onSubmit: React.FormEventHandler<HTMLFormElement>
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
    localDemoEmails,
    onSubmit,
}: PasswordSignInCardProps) {
    const showLocalDevNote = localDemoEmails.length > 0

    return (
        <FormCard
            title='Sign in'
            description='Enter your Page Quest email and password to continue.'
        >
            <form onSubmit={onSubmit} method='post' className='space-y-4'>
                {invitationWasCreated ? (
                    <div className='rounded-lg border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'>
                        Your account is ready. Sign in with the invited email to
                        open your dashboard.
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

                {showLocalDevNote ? (
                    <p className='text-sm text-muted-foreground'>
                        Local development uses seeded accounts with the password
                        pagequest-local.
                    </p>
                ) : null}

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
                              : 'Sign in'}
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}

export function SignInForm({ localDemoEmails }: SignInFormProps) {
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
            localDemoEmails={localDemoEmails}
            onSubmit={handleSubmit}
        />
    )
}
