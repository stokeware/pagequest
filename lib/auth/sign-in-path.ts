function normalizeQueryValue(value: string | null | undefined) {
    const normalizedValue = value?.trim()

    return normalizedValue ? normalizedValue : null
}

export function buildPasswordSignInPath({
    callbackUrl,
    email,
    invitation,
}: {
    callbackUrl?: string | null
    email?: string | null
    invitation?: 'created' | null
}) {
    const params = new URLSearchParams()
    const normalizedCallbackUrl = normalizeQueryValue(callbackUrl)
    const normalizedEmail = normalizeQueryValue(email)

    if (normalizedCallbackUrl) {
        params.set('callbackUrl', normalizedCallbackUrl)
    }

    if (normalizedEmail) {
        params.set('email', normalizedEmail)
    }

    if (invitation === 'created') {
        params.set('invitation', invitation)
    }

    const query = params.toString()

    return query ? `/sign-in?${query}` : '/sign-in'
}
