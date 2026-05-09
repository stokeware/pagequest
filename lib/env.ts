export type EnvSource = Partial<Record<string, string | undefined>>

export type AuthMode = 'local' | 'entra'

export type EmailDeliveryMode = 'azure-communication-services' | 'smtp'

export type EnvironmentTarget = 'local' | 'production'

export type EnvironmentValidationResult = {
    appUrl: string
    authMode: AuthMode
    emailMode: EmailDeliveryMode
    nextAuthUrl: string
    target: EnvironmentTarget
}

const defaultLocalAppUrl = 'http://127.0.0.1:3000'
const placeholderNextAuthSecret = 'replace-with-a-long-random-string'
const loopbackHosts = new Set(['0.0.0.0', '127.0.0.1', 'localhost'])

export function readOptionalEnv(
    name: string,
    env: EnvSource = process.env
): string | null {
    const value = env[name]?.trim()

    return value ? value : null
}

export function readRequiredEnv(
    name: string,
    env: EnvSource = process.env,
    scope?: string
): string {
    const value = readOptionalEnv(name, env)

    if (!value) {
        const scopePrefix = scope ? `${scope} ` : ''

        throw new Error(
            `Missing required ${scopePrefix}environment variable: ${name}`
        )
    }

    return value
}

export function readEnumEnv<TValue extends string>(
    name: string,
    env: EnvSource,
    supportedValues: readonly TValue[],
    fallback: TValue
): TValue {
    const value = readOptionalEnv(name, env)

    if (!value) {
        return fallback
    }

    if (supportedValues.includes(value as TValue)) {
        return value as TValue
    }

    throw new Error(
        `Environment variable ${name} must be one of: ${supportedValues.join(', ')}`
    )
}

export function readBooleanEnv(
    name: string,
    env: EnvSource,
    fallback = false
): boolean {
    const value = readOptionalEnv(name, env)

    if (!value) {
        return fallback
    }

    if (value === 'true') {
        return true
    }

    if (value === 'false') {
        return false
    }

    throw new Error(
        `Environment variable ${name} must be set to "true" or "false".`
    )
}

export function readIntegerEnv(
    name: string,
    env: EnvSource,
    fallback: number
): number {
    const value = readOptionalEnv(name, env)

    if (!value) {
        return fallback
    }

    const parsedValue = Number.parseInt(value, 10)

    if (!Number.isInteger(parsedValue)) {
        throw new Error(`Environment variable ${name} must be a valid integer.`)
    }

    return parsedValue
}

function parseAbsoluteUrl(name: string, value: string): URL {
    let parsedUrl: URL

    try {
        parsedUrl = new URL(value)
    } catch {
        throw new Error(`Environment variable ${name} must be an absolute URL.`)
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error(
            `Environment variable ${name} must use the http or https protocol.`
        )
    }

    return parsedUrl
}

function normalizeUrl(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value
}

export function getAppUrl(env: EnvSource = process.env): string {
    const configuredAppUrl = readOptionalEnv('APP_URL', env)
    const configuredNextAuthUrl = readOptionalEnv('NEXTAUTH_URL', env)
    const candidateUrl =
        configuredAppUrl ?? configuredNextAuthUrl ?? defaultLocalAppUrl

    return normalizeUrl(
        parseAbsoluteUrl(
            configuredAppUrl
                ? 'APP_URL'
                : configuredNextAuthUrl
                  ? 'NEXTAUTH_URL'
                  : 'APP_URL',
            candidateUrl
        ).toString()
    )
}

function isLoopbackUrl(value: string): boolean {
    return loopbackHosts.has(new URL(value).hostname)
}

function collectError(errors: string[], error: unknown) {
    errors.push(error instanceof Error ? error.message : String(error))
}

export function validateEnvironment({
    env = process.env,
    target = 'local',
}: {
    env?: EnvSource
    target?: EnvironmentTarget
} = {}): EnvironmentValidationResult {
    const errors: string[] = []

    if (!readOptionalEnv('DATABASE_URL', env)) {
        errors.push('Missing required environment variable: DATABASE_URL')
    }

    if (!readOptionalEnv('DIRECT_URL', env)) {
        errors.push('Missing required environment variable: DIRECT_URL')
    }

    let appUrl = defaultLocalAppUrl
    let nextAuthUrl = defaultLocalAppUrl

    const configuredAppUrl = readOptionalEnv('APP_URL', env)
    const configuredNextAuthUrl = readOptionalEnv('NEXTAUTH_URL', env)

    try {
        appUrl = getAppUrl(env)
    } catch (error) {
        collectError(errors, error)
    }

    if (configuredNextAuthUrl) {
        try {
            nextAuthUrl = normalizeUrl(
                parseAbsoluteUrl(
                    'NEXTAUTH_URL',
                    configuredNextAuthUrl
                ).toString()
            )
        } catch (error) {
            collectError(errors, error)
        }
    } else {
        nextAuthUrl = appUrl
    }

    if (configuredAppUrl && configuredNextAuthUrl && appUrl !== nextAuthUrl) {
        errors.push('APP_URL and NEXTAUTH_URL must match when both are set.')
    }

    const nextAuthSecret = readOptionalEnv('NEXTAUTH_SECRET', env)

    if (!nextAuthSecret) {
        errors.push('Missing required environment variable: NEXTAUTH_SECRET')
    }

    let authMode: AuthMode = 'local'

    try {
        authMode = readEnumEnv(
            'PAGEQUEST_AUTH_MODE',
            env,
            ['local', 'entra'],
            'local'
        )
    } catch (error) {
        collectError(errors, error)
    }

    let emailMode: EmailDeliveryMode = 'smtp'

    try {
        emailMode = readEnumEnv(
            'PAGEQUEST_EMAIL_DELIVERY_MODE',
            env,
            ['azure-communication-services', 'smtp'],
            'smtp'
        )
    } catch (error) {
        collectError(errors, error)
    }

    try {
        readRequiredEnv('EMAIL_FROM', env)
    } catch (error) {
        collectError(errors, error)
    }

    if (authMode === 'entra') {
        try {
            readRequiredEnv('ENTRA_EXTERNAL_ID_CLIENT_ID', env)
            readRequiredEnv('ENTRA_EXTERNAL_ID_CLIENT_SECRET', env)
            const issuer = readRequiredEnv('ENTRA_EXTERNAL_ID_ISSUER', env)
            const parsedIssuer = parseAbsoluteUrl(
                'ENTRA_EXTERNAL_ID_ISSUER',
                issuer
            )

            if (parsedIssuer.protocol !== 'https:') {
                errors.push(
                    'Environment variable ENTRA_EXTERNAL_ID_ISSUER must use https.'
                )
            }
        } catch (error) {
            collectError(errors, error)
        }
    }

    if (emailMode === 'smtp') {
        try {
            readRequiredEnv('SMTP_HOST', env)
            const port = readIntegerEnv('SMTP_PORT', env, 1025)

            if (port < 1 || port > 65535) {
                errors.push(
                    'Environment variable SMTP_PORT must be between 1 and 65535.'
                )
            }

            readBooleanEnv('SMTP_SECURE', env, false)
        } catch (error) {
            collectError(errors, error)
        }
    }

    if (emailMode === 'azure-communication-services') {
        try {
            readRequiredEnv(
                'AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING',
                env
            )
        } catch (error) {
            collectError(errors, error)
        }
    }

    if (target === 'production') {
        if (!configuredAppUrl) {
            errors.push('Missing required environment variable: APP_URL')
        }

        if (!configuredNextAuthUrl) {
            errors.push('Missing required environment variable: NEXTAUTH_URL')
        }

        if (authMode !== 'entra') {
            errors.push(
                'PAGEQUEST_AUTH_MODE must be set to "entra" for production.'
            )
        }

        if (emailMode !== 'azure-communication-services') {
            errors.push(
                'PAGEQUEST_EMAIL_DELIVERY_MODE must be set to "azure-communication-services" for production.'
            )
        }

        if (nextAuthSecret) {
            if (nextAuthSecret === placeholderNextAuthSecret) {
                errors.push(
                    'NEXTAUTH_SECRET must be replaced before production deployment.'
                )
            }

            if (nextAuthSecret.length < 32) {
                errors.push(
                    'NEXTAUTH_SECRET must be at least 32 characters long for production.'
                )
            }
        }

        if (
            !errors.includes(
                'Missing required environment variable: APP_URL'
            ) &&
            isLoopbackUrl(appUrl)
        ) {
            errors.push(
                'APP_URL must not point to a loopback host in production.'
            )
        }

        if (
            !errors.includes(
                'Missing required environment variable: NEXTAUTH_URL'
            ) &&
            isLoopbackUrl(nextAuthUrl)
        ) {
            errors.push(
                'NEXTAUTH_URL must not point to a loopback host in production.'
            )
        }
    }

    if (errors.length > 0) {
        throw new Error(
            [
                'Environment validation failed:',
                ...errors.map((error) => `- ${error}`),
            ].join('\n')
        )
    }

    return {
        appUrl,
        authMode,
        emailMode,
        nextAuthUrl,
        target,
    }
}
