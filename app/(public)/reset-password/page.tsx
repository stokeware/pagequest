import {
    FormActions,
    FormCard,
    FormField,
    Input,
    Button,
    ErrorState,
} from '@/components/ui'
import { PublicShell } from '@/components/public/public-shell'

import { requestPasswordResetAction } from './actions'

type ResetPasswordPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type ResetPasswordRequestCardProps = {
    defaultEmail: string
    errorMessage: string | null
    sent: boolean
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0]?.trim() || null
    }

    return value?.trim() || null
}

export function ResetPasswordRequestCard({
    defaultEmail,
    errorMessage,
    sent,
}: ResetPasswordRequestCardProps) {
    return (
        <FormCard
            title={
                <span className='text-3xl tracking-tight'>Reset password</span>
            }
        >
            <form action={requestPasswordResetAction} className='ui-form-shell'>
                {sent ? (
                    <div className='rounded-lg border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'>
                        If a Page Quest account matches that email, a reset link
                        is on the way.
                    </div>
                ) : null}

                <FormField label='Email address' htmlFor='password-reset-email'>
                    <Input
                        id='password-reset-email'
                        name='email'
                        type='email'
                        inputMode='email'
                        autoComplete='email'
                        defaultValue={defaultEmail}
                        placeholder='reader@example.com'
                        required
                    />
                </FormField>

                {errorMessage ? (
                    <ErrorState
                        eyebrow='Password reset error'
                        title='Password reset email could not be sent.'
                        description={errorMessage}
                    />
                ) : null}

                <FormActions>
                    <Button nativeButton type='submit'>
                        Send email
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}

export default async function ResetPasswordPage({
    searchParams,
}: ResetPasswordPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const defaultEmail =
        getFirstSearchParamValue(resolvedSearchParams.email) ?? ''
    const errorMessage = getFirstSearchParamValue(resolvedSearchParams.error)
    const sent =
        getFirstSearchParamValue(resolvedSearchParams.outcome) === 'sent'

    return (
        <PublicShell headerVariant='brand-only' contentVariant='default'>
            <h1 className='sr-only'>Reset password</h1>
            <ResetPasswordRequestCard
                defaultEmail={defaultEmail}
                errorMessage={errorMessage}
                sent={sent}
            />
        </PublicShell>
    )
}
