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

function subscribeToHydration() {
    return () => undefined
}

function getClientHydrationSnapshot() {
    return true
}

function getServerHydrationSnapshot() {
    return false
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
        <FormCard
            title='Sign in'
            description='Use a seeded local reader or a password-backed invited account before continuing into a private campaign.'
        >
            <form onSubmit={handleSubmit} method='post' className='space-y-4'>
                <input type='hidden' name='callbackUrl' value={callbackUrl} />

                <FormField label='Email address' htmlFor='email'>
                    <Input
                        id='email'
                        name='email'
                        type='email'
                        inputMode='email'
                        placeholder='reader@example.com'
                        autoComplete='email'
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

                <div className='rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground'>
                    <p>Seeded local emails: {localDemoEmails.join(', ')}</p>
                    <p>Seeded local password: pagequest-local</p>
                </div>

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
