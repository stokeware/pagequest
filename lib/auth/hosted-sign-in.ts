export type HostedAuthFlow = 'login' | 'signup'

type SearchParamsLike = {
    get(name: string): string | null
}

function normalizeQueryValue(value: string | null | undefined) {
    const normalizedValue = value?.trim()

    return normalizedValue ? normalizedValue : null
}

export function getHostedAuthFlow(screenHint: string | null | undefined) {
    return normalizeQueryValue(screenHint)?.toLowerCase() === 'signup'
        ? 'signup'
        : 'login'
}

export function getHostedAuthRequest(searchParams: SearchParamsLike) {
    return {
        callbackUrl:
            normalizeQueryValue(searchParams.get('callbackUrl')) ?? '/',
        flow: getHostedAuthFlow(searchParams.get('screen_hint')),
        loginHint: normalizeQueryValue(searchParams.get('login_hint')),
    }
}

export function buildHostedAuthPath({
    callbackUrl,
    flow = 'login',
    loginHint,
}: {
    callbackUrl: string
    flow?: HostedAuthFlow
    loginHint?: string | null
}) {
    const params = new URLSearchParams({ callbackUrl })
    const normalizedLoginHint = normalizeQueryValue(loginHint)

    if (flow === 'signup') {
        params.set('screen_hint', 'signup')
    }

    if (normalizedLoginHint) {
        params.set('login_hint', normalizedLoginHint)
    }

    return `/sign-in?${params.toString()}`
}

export function getHostedAuthSignInOptions({
    callbackUrl,
    flow,
    loginHint,
}: {
    callbackUrl: string
    flow: HostedAuthFlow
    loginHint?: string | null
}) {
    const normalizedLoginHint = normalizeQueryValue(loginHint)

    return {
        ...(flow === 'signup' ? { screen_hint: 'signup' as const } : {}),
        ...(normalizedLoginHint ? { login_hint: normalizedLoginHint } : {}),
        callbackUrl,
    }
}
