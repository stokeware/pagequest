'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState, useSyncExternalStore, useTransition } from 'react'

import {
    Button,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import type { AuthMode } from '@/lib/auth/config'

type SignInFormProps = {
    authMode: AuthMode
    localDemoEmails: readonly string[]
    localPassphraseHint: string | null
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

export function SignInForm({
    authMode,
    localDemoEmails,
    localPassphraseHint,
}: SignInFormProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const isHydrated = useSyncExternalStore(
        subscribeToHydration,
        getClientHydrationSnapshot,
        getServerHydrationSnapshot
    )

    const callbackUrl = searchParams.get('callbackUrl') ?? '/'

    async function handleLocalSubmit(formData: FormData) {
        const email = String(formData.get('email') ?? '').trim()
        const password = String(formData.get('password') ?? '').trim()

        const result = await signIn('credentials', {
            callbackUrl,
            email,
            password,
            redirect: false,
        })

        if (!result || result.error) {
            setErrorMessage(
                'Sign-in failed. Use one of the seeded local emails and the shared passphrase.'
            )

            return
        }

        router.push(result.url ?? callbackUrl)
        router.refresh()
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setErrorMessage(null)

        const formData = new FormData(event.currentTarget)

        startTransition(async () => {
            await handleLocalSubmit(formData)
        })
    }

    function handleEntraSignIn() {
        setErrorMessage(null)

        startTransition(async () => {
            await signIn('microsoft-entra-external-id', {
                callbackUrl,
            })
        })
    }

    if (authMode === 'entra') {
        return (
            <FormCard
                title='Sign in'
                description='Use the hosted identity flow configured for Microsoft Entra External ID.'
            >
                <FormActions note='The local credentials form stays disabled whenever the app runs in Entra mode.'>
                    <Button onClick={handleEntraSignIn} disabled={isPending}>
                        Continue with Microsoft Entra External ID
                    </Button>
                </FormActions>
            </FormCard>
        )
    }

    return (
        <FormCard
            title='Sign in'
            description='Use one of the seeded local readers or an invited account before continuing into a private campaign.'
        >
            <form onSubmit={handleSubmit} method='post' className='space-y-4'>
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

                <FormField label='Shared passphrase' htmlFor='password'>
                    <Input
                        id='password'
                        name='password'
                        type='password'
                        placeholder='Enter the local shared passphrase'
                        autoComplete='current-password'
                        disabled={!isHydrated || isPending}
                        required
                    />
                </FormField>

                <div className='rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground'>
                    <p>Local demo emails: {localDemoEmails.join(', ')}</p>
                    <p>Shared passphrase: {localPassphraseHint}</p>
                </div>

                {errorMessage ? (
                    <p className='text-sm font-medium text-destructive'>
                        {errorMessage}
                    </p>
                ) : null}

                <FormActions note='This local mode keeps Auth.js active without requiring a hosted identity tenant during routine development.'>
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
