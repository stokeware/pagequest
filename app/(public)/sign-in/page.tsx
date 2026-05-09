import { Suspense } from 'react'

import { SignInForm } from '@/components/public/sign-in-form'
import { PublicShell } from '@/components/public/public-shell'
import { getAuthUiConfig } from '@/lib/auth/config'

export default function SignInPage() {
    const authUiConfig = getAuthUiConfig()
    const description =
        authUiConfig.mode === 'auth0'
            ? 'Hosted sign-in runs through Auth0, while local development keeps the seeded credentials flow available for CI and routine testing.'
            : 'This route uses the local Auth.js credentials flow for development, CI, and seeded demo data.'

    return (
        <PublicShell
            eyebrow='Authentication'
            title='Sign in before the next chapter begins.'
            description={description}
        >
            <Suspense fallback={null}>
                <SignInForm
                    authMode={authUiConfig.mode}
                    localDemoEmails={authUiConfig.localDemoEmails}
                    localPassphraseHint={authUiConfig.localPassphraseHint}
                    providerLabel={authUiConfig.providerLabel}
                />
            </Suspense>
        </PublicShell>
    )
}
