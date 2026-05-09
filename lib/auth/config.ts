const defaultLocalAuthPassphrase = 'pagequest-local'

export const localDemoEmails = [
    'admin@pagequest.local',
    'alice@pagequest.local',
    'ben@pagequest.local',
    'clara@pagequest.local',
    'future-reader@pagequest.local',
] as const

export type AuthMode = 'local' | 'entra'

type EnvSource = Partial<Record<string, string | undefined>>

export type EntraExternalIdConfig = {
    clientId: string
    clientSecret: string
    issuer: string
    scope: string
}

function readRequiredEnv(name: string, env: EnvSource): string {
    const value = env[name]?.trim()

    if (!value) {
        throw new Error(`Missing required auth environment variable: ${name}`)
    }

    return value
}

export function getAuthMode(env: EnvSource = process.env): AuthMode {
    const configuredMode = env.PAGEQUEST_AUTH_MODE?.trim().toLowerCase()

    return configuredMode === 'entra' ? 'entra' : 'local'
}

export function getLocalAuthPassphrase(env: EnvSource = process.env): string {
    return env.LOCAL_AUTH_PASSPHRASE?.trim() || defaultLocalAuthPassphrase
}

export function getEntraExternalIdConfig(
    env: EnvSource = process.env
): EntraExternalIdConfig {
    return {
        clientId: readRequiredEnv('ENTRA_EXTERNAL_ID_CLIENT_ID', env),
        clientSecret: readRequiredEnv('ENTRA_EXTERNAL_ID_CLIENT_SECRET', env),
        issuer: readRequiredEnv('ENTRA_EXTERNAL_ID_ISSUER', env),
        scope:
            env.ENTRA_EXTERNAL_ID_SCOPE?.trim() ||
            'openid profile email offline_access',
    }
}

export function getAuthUiConfig(env: EnvSource = process.env) {
    const mode = getAuthMode(env)

    return {
        localDemoEmails,
        localPassphraseHint:
            mode === 'local' ? getLocalAuthPassphrase(env) : null,
        mode,
        providerLabel:
            mode === 'entra'
                ? 'Microsoft Entra External ID'
                : 'Local development sign-in',
    }
}
