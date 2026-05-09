import { type EnvSource, readEnumEnv, readRequiredEnv } from '@/lib/env'

const defaultLocalAuthPassphrase = 'pagequest-local'

export const localDemoEmails = [
    'admin@pagequest.local',
    'alice@pagequest.local',
    'ben@pagequest.local',
    'clara@pagequest.local',
    'future-reader@pagequest.local',
] as const

export type AuthMode = 'local' | 'entra'

export type EntraExternalIdConfig = {
    clientId: string
    clientSecret: string
    issuer: string
    scope: string
}

export function getAuthMode(env: EnvSource = process.env): AuthMode {
    return readEnumEnv('PAGEQUEST_AUTH_MODE', env, ['local', 'entra'], 'local')
}

export function getLocalAuthPassphrase(env: EnvSource = process.env): string {
    return env.LOCAL_AUTH_PASSPHRASE?.trim() || defaultLocalAuthPassphrase
}

export function getEntraExternalIdConfig(
    env: EnvSource = process.env
): EntraExternalIdConfig {
    return {
        clientId: readRequiredEnv('ENTRA_EXTERNAL_ID_CLIENT_ID', env, 'auth'),
        clientSecret: readRequiredEnv(
            'ENTRA_EXTERNAL_ID_CLIENT_SECRET',
            env,
            'auth'
        ),
        issuer: readRequiredEnv('ENTRA_EXTERNAL_ID_ISSUER', env, 'auth'),
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
