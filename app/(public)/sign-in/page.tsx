import { Suspense } from 'react'

import { SignInForm } from '@/components/public/sign-in-form'
import { PublicShell } from '@/components/public/public-shell'

export default function SignInPage() {
    return (
        <PublicShell headerVariant='brand-only' contentVariant='default'>
            <h1 className='sr-only'>Sign in</h1>
            <Suspense fallback={null}>
                <SignInForm />
            </Suspense>
        </PublicShell>
    )
}
