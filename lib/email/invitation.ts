import { getEmailDeliveryConfig } from '@/lib/email/config'
import { sendEmail, type EmailDeliveryMessage } from '@/lib/email/service'

type InvitationEmailInput = {
    expiresAt: Date
    invitationUrl: string
    campaignName: string
    recipientEmail: string
}

function formatExpiryDate(value: Date) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(value)
}

export function buildInvitationEmailMessage({
    expiresAt,
    invitationUrl,
    campaignName,
    recipientEmail,
}: InvitationEmailInput): EmailDeliveryMessage {
    const config = getEmailDeliveryConfig()
    const formattedExpiry = formatExpiryDate(expiresAt)
    const subject = `You're invited to join ${campaignName} on Page Quest`
    const plainText = [
        `You've been invited to join ${campaignName} on Page Quest.`,
        '',
        `Use this secure link to sign in and accept your invitation: ${invitationUrl}`,
        '',
        `This link is reserved for ${recipientEmail} and expires on ${formattedExpiry}.`,
        '',
        'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n')
    const html = [
        `<p>You've been invited to join <strong>${campaignName}</strong> on Page Quest.</p>`,
        `<p><a href="${invitationUrl}">Open your secure invitation link</a></p>`,
        `<p>This link is reserved for <strong>${recipientEmail}</strong> and expires on ${formattedExpiry}.</p>`,
        '<p>If you were not expecting this invitation, you can ignore this email.</p>',
    ].join('')

    return {
        content: {
            html,
            plainText,
            subject,
        },
        recipients: {
            to: [{ address: recipientEmail }],
        },
        senderAddress: config.fromAddress,
    }
}

export async function sendInvitationEmail(input: InvitationEmailInput) {
    return sendEmail(buildInvitationEmailMessage(input))
}
