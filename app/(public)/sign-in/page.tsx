import { SignInForm } from '@/components/public/sign-in-form'
import { PublicShell } from '@/components/public/public-shell'
import { getAuthUiConfig } from '@/lib/auth/config'

export default function SignInPage() {
    const authUiConfig = getAuthUiConfig()

    return (
        <PublicShell
            eyebrow='Authentication'
            title='Sign in before the next chapter begins.'
            description={`This route now runs through Auth.js using ${authUiConfig.providerLabel.toLowerCase()}.`}
        >
            <SignInForm
                authMode={authUiConfig.mode}
                localDemoEmails={authUiConfig.localDemoEmails}
                localPassphraseHint={authUiConfig.localPassphraseHint}
            />
        </PublicShell>
    )
}
