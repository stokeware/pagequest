'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { useState, useSyncExternalStore, useTransition } from 'react'

import {
    Button,
    ErrorState,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import {
    getHostedAuthRequest,
    getHostedAuthSignInOptions,
    type HostedAuthFlow,
} from '@/lib/auth/hosted-sign-in'
import { getSignedInLandingPath } from '@/lib/auth/access'
import type { AuthMode } from '@/lib/auth/config'

type SignInFormProps = {
    authMode: AuthMode
    localDemoEmails: readonly string[]
    localPassphraseHint: string | null
    providerLabel: string
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
    providerLabel,
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
    const hostedAuthRequest = getHostedAuthRequest(searchParams)
    const callbackUrl = hostedAuthRequest.callbackUrl
    const isHostedSignup = hostedAuthRequest.flow === 'signup'

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

        const session = await getSession()
        const redirectPath = getSignedInLandingPath({
            callbackUrl: result.url ?? callbackUrl,
            grantedRoles: Array.isArray(session?.user?.roles)
                ? session.user.roles
                : [],
            isAuthenticated: Boolean(session?.user),
        })

        router.push(redirectPath ?? callbackUrl)
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

    function handleHostedSignIn(flow: HostedAuthFlow = hostedAuthRequest.flow) {
        setErrorMessage(null)

        startTransition(async () => {
            await signIn(
                authMode,
                getHostedAuthSignInOptions({
                    callbackUrl,
                    flow,
                    loginHint: hostedAuthRequest.loginHint,
                })
            )
        })
    }

    if (authMode !== 'local') {
        return (
            <FormCard
                title={isHostedSignup ? 'Welcome to Page Quest' : 'Sign in'}
                description={
                    isHostedSignup
                        ? 'Create your account to accept the invitation. Auth0 will ask you to choose a password and then return you to Page Quest.'
                        : 'Use the hosted Auth0 identity flow configured for this environment.'
                }
            >
                {hostedAuthRequest.loginHint ? (
                    <FormField
                        label='Email address'
                        htmlFor='hosted-auth-email'
                        hint='This email is prefilled so the hosted flow returns to the correct invitation.'
                    >
                        <Input
                            id='hosted-auth-email'
                            value={hostedAuthRequest.loginHint}
                            readOnly
                        />
                    </FormField>
                ) : null}

                <FormActions
                    note={
                        isHostedSignup
                            ? 'If this email is new, choose a password in Auth0. If the account already exists, you can switch to sign-in on the next screen.'
                            : 'The local credentials form stays disabled whenever the app runs in hosted auth mode, so preview deploys may still require a stable Auth0 callback URL for full sign-in validation.'
                    }
                >
                    <Button
                        onClick={() => handleHostedSignIn()}
                        disabled={isPending}
                    >
                        {isHostedSignup
                            ? 'Create account'
                            : `Continue with ${providerLabel}`}
                    </Button>

                    {isHostedSignup ? (
                        <Button
                            variant='outline'
                            onClick={() => handleHostedSignIn('login')}
                            disabled={isPending}
                        >
                            I already have an account
                        </Button>
                    ) : null}
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
