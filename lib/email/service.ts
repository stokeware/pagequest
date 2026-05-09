import nodemailer from 'nodemailer'

import {
    getAzureCommunicationServicesEmailConfig,
    getEmailDeliveryMode,
    getSmtpEmailDeliveryConfig,
    type EmailDeliveryMode,
} from '@/lib/email/config'

export type EmailAddress = {
    address: string
    displayName?: string
}

export type EmailDeliveryMessage = {
    content: {
        html: string
        plainText: string
        subject: string
    }
    recipients: {
        to: EmailAddress[]
    }
    senderAddress: string
}

export type EmailDeliveryResult = {
    id: string | null
    mode: EmailDeliveryMode
}

function formatAddress(address: EmailAddress) {
    if (address.displayName) {
        return `${address.displayName} <${address.address}>`
    }

    return address.address
}

async function sendWithSmtp(message: EmailDeliveryMessage) {
    const config = getSmtpEmailDeliveryConfig()
    const transporter = nodemailer.createTransport({
        auth: config.user
            ? {
                  pass: config.password ?? '',
                  user: config.user,
              }
            : undefined,
        host: config.host,
        port: config.port,
        secure: config.secure,
    })

    const result = await transporter.sendMail({
        from: message.senderAddress,
        html: message.content.html,
        subject: message.content.subject,
        text: message.content.plainText,
        to: message.recipients.to.map(formatAddress).join(', '),
    })

    return {
        id: result.messageId ?? null,
        mode: 'smtp',
    } satisfies EmailDeliveryResult
}

async function sendWithAzureCommunicationServices(
    message: EmailDeliveryMessage
) {
    getAzureCommunicationServicesEmailConfig()

    throw new Error(
        `Azure Communication Services delivery is not wired yet. The current email payload already matches the Azure contract for ${message.content.subject}.`
    )
}

export async function sendEmail(message: EmailDeliveryMessage) {
    const mode = getEmailDeliveryMode()

    return mode === 'azure-communication-services'
        ? sendWithAzureCommunicationServices(message)
        : sendWithSmtp(message)
}
