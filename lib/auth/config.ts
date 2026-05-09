import { type EnvSource, readEnumEnv, readRequiredEnv } from '@/lib/env'

const defaultLocalAuthPassphrase = 'pagequest-local'

export const localDemoEmails = [
    'admin@pagequest.local',
    'alice@pagequest.local',
    'ben@pagequest.local',
    'clara@pagequest.local',
    'future-reader@pagequest.local',
] as const

export type AuthMode = 'auth0' | 'entra' | 'local'

export type EntraExternalIdConfig = {
    clientId: string
    clientSecret: string
    issuer: string
    scope: string
}

export type Auth0Config = {
    audience: string | null
    clientId: string
    clientSecret: string
    issuer: string
    scope: string
}

export function getAuthMode(env: EnvSource = process.env): AuthMode {
    return readEnumEnv(
        'PAGEQUEST_AUTH_MODE',
        env,
        ['auth0', 'local', 'entra'],
        'local'
    )
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

export function getAuth0Config(env: EnvSource = process.env): Auth0Config {
    return {
        audience: env.AUTH0_AUDIENCE?.trim() || null,
        clientId: readRequiredEnv('AUTH0_CLIENT_ID', env, 'auth'),
        clientSecret: readRequiredEnv('AUTH0_CLIENT_SECRET', env, 'auth'),
        issuer: readRequiredEnv('AUTH0_ISSUER', env, 'auth'),
        scope: env.AUTH0_SCOPE?.trim() || 'openid profile email offline_access',
    }
}

export function getAuthUiConfig(env: EnvSource = process.env) {
    const mode = getAuthMode(env)
    const providerLabel =
        mode === 'auth0'
            ? 'Auth0'
            : mode === 'entra'
              ? 'Microsoft Entra External ID'
              : 'Local development sign-in'

    return {
        localDemoEmails,
        localPassphraseHint:
            mode === 'local' ? getLocalAuthPassphrase(env) : null,
        mode,
        providerLabel,
    }
}
