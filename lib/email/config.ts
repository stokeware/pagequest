type EnvSource = Partial<Record<string, string | undefined>>

export type EmailDeliveryMode = 'azure-communication-services' | 'smtp'

export type EmailDeliveryConfig = {
    appUrl: string
    fromAddress: string
    mode: EmailDeliveryMode
}

export type SmtpEmailDeliveryConfig = EmailDeliveryConfig & {
    host: string
    password: string | null
    port: number
    secure: boolean
    user: string | null
}

export type AzureCommunicationServicesEmailConfig = EmailDeliveryConfig & {
    connectionString: string
}

function readRequiredEnv(name: string, env: EnvSource) {
    const value = env[name]?.trim()

    if (!value) {
        throw new Error(`Missing required email environment variable: ${name}`)
    }

    return value
}

function readBooleanEnv(name: string, env: EnvSource) {
    return env[name]?.trim().toLowerCase() === 'true'
}

function readIntegerEnv(name: string, env: EnvSource, fallback: number) {
    const rawValue = env[name]?.trim()

    if (!rawValue) {
        return fallback
    }

    const parsedValue = Number.parseInt(rawValue, 10)

    if (!Number.isFinite(parsedValue)) {
        throw new Error(
            `Email environment variable ${name} must be a valid integer.`
        )
    }

    return parsedValue
}

export function getEmailDeliveryMode(
    env: EnvSource = process.env
): EmailDeliveryMode {
    const configuredMode =
        env.PAGEQUEST_EMAIL_DELIVERY_MODE?.trim().toLowerCase()

    return configuredMode === 'azure-communication-services'
        ? 'azure-communication-services'
        : 'smtp'
}

export function getEmailDeliveryConfig(
    env: EnvSource = process.env
): EmailDeliveryConfig {
    return {
        appUrl:
            env.APP_URL?.trim() ||
            env.NEXTAUTH_URL?.trim() ||
            'http://127.0.0.1:3000',
        fromAddress: readRequiredEnv('EMAIL_FROM', env),
        mode: getEmailDeliveryMode(env),
    }
}

export function getSmtpEmailDeliveryConfig(
    env: EnvSource = process.env
): SmtpEmailDeliveryConfig {
    const baseConfig = getEmailDeliveryConfig(env)

    return {
        ...baseConfig,
        host: readRequiredEnv('SMTP_HOST', env),
        password: env.SMTP_PASSWORD?.trim() || null,
        port: readIntegerEnv('SMTP_PORT', env, 1025),
        secure: readBooleanEnv('SMTP_SECURE', env),
        user: env.SMTP_USER?.trim() || null,
    }
}

export function getAzureCommunicationServicesEmailConfig(
    env: EnvSource = process.env
): AzureCommunicationServicesEmailConfig {
    const baseConfig = getEmailDeliveryConfig(env)

    return {
        ...baseConfig,
        connectionString: readRequiredEnv(
            'AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING',
            env
        ),
    }
}
