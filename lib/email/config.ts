import {
    getAppUrl,
    type EnvSource,
    readBooleanEnv,
    readIntegerEnv,
    readRequiredEnv,
} from '@/lib/env'

export type EmailDeliveryMode = 'smtp'

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

export function getEmailDeliveryMode(
    env: EnvSource = process.env
): EmailDeliveryMode {
    const mode = env.PAGEQUEST_EMAIL_DELIVERY_MODE?.trim()

    if (!mode || mode === 'smtp') {
        return 'smtp'
    }

    throw new Error(
        'Environment variable PAGEQUEST_EMAIL_DELIVERY_MODE must be set to "smtp" when provided.'
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
