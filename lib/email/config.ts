import {
    getAppUrl,
    type EnvSource,
    readBooleanEnv,
    readEnumEnv,
    readIntegerEnv,
    readRequiredEnv,
} from '@/lib/env'

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

export function getEmailDeliveryMode(
    env: EnvSource = process.env
): EmailDeliveryMode {
    return readEnumEnv(
        'PAGEQUEST_EMAIL_DELIVERY_MODE',
        env,
        ['azure-communication-services', 'smtp'],
        'smtp'
    )
}

export function getEmailDeliveryConfig(
    env: EnvSource = process.env
): EmailDeliveryConfig {
    return {
        appUrl: getAppUrl(env),
        fromAddress: readRequiredEnv('EMAIL_FROM', env, 'email'),
        mode: getEmailDeliveryMode(env),
    }
}

export function getSmtpEmailDeliveryConfig(
    env: EnvSource = process.env
): SmtpEmailDeliveryConfig {
    const baseConfig = getEmailDeliveryConfig(env)

    return {
        ...baseConfig,
        host: readRequiredEnv('SMTP_HOST', env, 'email'),
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
            env,
            'email'
        ),
    }
}
