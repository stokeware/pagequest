import { getEmailDeliveryConfig } from '@/lib/email/config'
import { sendEmail, type EmailDeliveryMessage } from '@/lib/email/service'

export type InvitationEmailInput = {
    expiresAt: Date
    invitationUrl: string
    campaignName?: string | null
    recipientEmail: string
}

export type CampaignStartReminderEmailInput = {
    campaignName: string
    dashboardUrl: string
    logProgressUrl: string
    recipientEmail: string
    startAt: Date
}

export type InactivityNudgeEmailInput = {
    campaignEndsAt?: Date
    campaignName: string
    daysSinceLastEntry: number
    leaderboardUrl: string
    logProgressUrl: string
    recipientEmail: string
}

function formatBoundaryDate(value: Date) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(value)
}

function pluralizeDays(value: number) {
    return value === 1 ? 'day' : 'days'
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

function buildEmailMessage({
    htmlParts,
    plainTextLines,
    recipientEmail,
    subject,
}: {
    htmlParts: string[]
    plainTextLines: string[]
    recipientEmail: string
    subject: string
}): EmailDeliveryMessage {
    const config = getEmailDeliveryConfig()

    return {
        content: {
            html: htmlParts.join(''),
            plainText: plainTextLines.join('\n'),
            subject,
        },
        recipients: {
            to: [{ address: recipientEmail }],
        },
        senderAddress: config.fromAddress,
    }
}

export function buildInvitationEmailMessage({
    invitationUrl,
    campaignName,
    recipientEmail,
}: InvitationEmailInput): EmailDeliveryMessage {
    const safeRecipientEmail = escapeHtml(recipientEmail)
    const safeInvitationUrl = escapeHtml(invitationUrl)
    const normalizedCampaignName = campaignName?.trim() || null
    const invitationSummary = normalizedCampaignName
        ? `Your invitation unlocks ${normalizedCampaignName} and sets up your Page Quest account for future invite-only campaigns.`
        : 'Your invitation sets up your Page Quest account and unlocks Page Quest member access.'

    return buildEmailMessage({
        htmlParts: [
            '<p>Welcome to <strong>Page Quest</strong>.</p>',
            `<p>${escapeHtml(invitationSummary)}<\/p>`,
            `<p><a href="${safeInvitationUrl}">Open your secure invitation link</a></p>`,
            `<p>This link is reserved for <strong>${safeRecipientEmail}</strong>.</p>`,
            '<p>Use it to create a password or sign in with the invited email before accepting your invitation.</p>',
            '<p>If you were not expecting this invitation, you can ignore this email.</p>',
        ],
        plainTextLines: [
            'Welcome to Page Quest.',
            '',
            invitationSummary,
            '',
            `Use this secure link to create a password or sign in, then accept your invitation: ${invitationUrl}`,
            '',
            `This link is reserved for ${recipientEmail}.`,
            '',
            'If you were not expecting this invitation, you can ignore this email.',
        ],
        recipientEmail,
        subject: `You're invited to Page Quest`,
    })
}

export function buildCampaignStartReminderEmailMessage({
    campaignName,
    dashboardUrl,
    logProgressUrl,
    recipientEmail,
    startAt,
}: CampaignStartReminderEmailInput): EmailDeliveryMessage {
    const formattedStart = formatBoundaryDate(startAt)
    const safeCampaignName = escapeHtml(campaignName)
    const safeDashboardUrl = escapeHtml(dashboardUrl)
    const safeLogProgressUrl = escapeHtml(logProgressUrl)

    return buildEmailMessage({
        htmlParts: [
            `<p><strong>${safeCampaignName}</strong> is live on Page Quest.</p>`,
            `<p>Your reading campaign opened on ${escapeHtml(formattedStart)}. Your dashboard is ready with standings, recent activity, and challenges.</p>`,
            `<p><a href="${safeDashboardUrl}">Open your dashboard</a></p>`,
            `<p><a href="${safeLogProgressUrl}">Log your first reading update</a></p>`,
            '<p>If this reminder reached the wrong inbox, you can ignore it.</p>',
        ],
        plainTextLines: [
            `${campaignName} is live on Page Quest.`,
            '',
            `Your reading campaign opened on ${formattedStart}.`,
            '',
            `Open your dashboard to see the latest standings and challenges: ${dashboardUrl}`,
            '',
            `Log your first reading update here: ${logProgressUrl}`,
            '',
            'If this reminder reached the wrong inbox, you can ignore it.',
        ],
        recipientEmail,
        subject: `${campaignName} starts now on Page Quest`,
    })
}

export function buildInactivityNudgeEmailMessage({
    campaignEndsAt,
    campaignName,
    daysSinceLastEntry,
    leaderboardUrl,
    logProgressUrl,
    recipientEmail,
}: InactivityNudgeEmailInput): EmailDeliveryMessage {
    const safeCampaignName = escapeHtml(campaignName)
    const safeLeaderboardUrl = escapeHtml(leaderboardUrl)
    const safeLogProgressUrl = escapeHtml(logProgressUrl)
    const inactivitySummary = `${daysSinceLastEntry} ${pluralizeDays(daysSinceLastEntry)}`
    const campaignEndingLine = campaignEndsAt
        ? `The campaign wraps up on ${formatBoundaryDate(campaignEndsAt)}.`
        : null

    return buildEmailMessage({
        htmlParts: [
            `<p>It has been <strong>${escapeHtml(inactivitySummary)}</strong> since the last update for <strong>${safeCampaignName}</strong>.</p>`,
            '<p>If you have been reading but have not logged it yet, this is your nudge to jump back in.</p>',
            campaignEndingLine
                ? `<p>${escapeHtml(campaignEndingLine)}</p>`
                : '',
            `<p><a href="${safeLogProgressUrl}">Log today's reading progress</a></p>`,
            `<p><a href="${safeLeaderboardUrl}">Check the leaderboard</a></p>`,
        ],
        plainTextLines: [
            `It has been ${inactivitySummary} since the last update for ${campaignName}.`,
            '',
            'If you have been reading but have not logged it yet, this is your nudge to jump back in.',
            ...(campaignEndingLine ? ['', campaignEndingLine] : []),
            '',
            `Log today's reading progress: ${logProgressUrl}`,
            '',
            `Check the leaderboard: ${leaderboardUrl}`,
        ],
        recipientEmail,
        subject: `Keep your streak moving in ${campaignName}`,
    })
}

export async function sendInvitationEmail(input: InvitationEmailInput) {
    return sendEmail(buildInvitationEmailMessage(input))
}

export async function sendCampaignStartReminderEmail(
    input: CampaignStartReminderEmailInput
) {
    return sendEmail(buildCampaignStartReminderEmailMessage(input))
}

export async function sendInactivityNudgeEmail(
    input: InactivityNudgeEmailInput
) {
    return sendEmail(buildInactivityNudgeEmailMessage(input))
}
