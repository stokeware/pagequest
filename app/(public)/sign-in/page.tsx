import { Suspense } from 'react'

import { SignInForm } from '@/components/public/sign-in-form'
import { PublicShell } from '@/components/public/public-shell'
import { getAuthUiConfig } from '@/lib/auth/config'

export default function SignInPage() {
    const authUiConfig = getAuthUiConfig()

    return (
        <PublicShell headerVariant='brand-only' contentVariant='default'>
            <h1 className='sr-only'>Sign in</h1>
            <Suspense fallback={null}>
                <SignInForm localDemoEmails={authUiConfig.localDemoEmails} />
            </Suspense>
        </PublicShell>
    )
}
