import { prisma } from '@/lib/prisma'
import { defineJob, type JobDefinition } from '@/lib/jobs/runner'
import { synchronizeDerivedCampaignStatuses } from '@/lib/campaign-status'
import { getEmailDeliveryConfig } from '@/lib/email/config'
import {
    sendCampaignStartReminderEmail,
    sendInactivityNudgeEmail,
} from '@/lib/email/templates'
import {
    buildCampaignStartReminderIdempotencyKey,
    buildInactivityNudgeIdempotencyKey,
    claimNotificationDelivery,
    completeNotificationDelivery,
    failNotificationDelivery,
} from '@/lib/jobs/notification-deliveries'

const DAY_IN_MS = 24 * 60 * 60 * 1000
const HOUR_IN_MS = 60 * 60 * 1000

export const DEFAULT_CAMPAIGN_START_REMINDER_LOOKBACK_HOURS = 24
export const DEFAULT_INACTIVITY_THRESHOLD_DAYS = 3
export const DEFAULT_INACTIVITY_CADENCE_DAYS = 3

export type CampaignStartReminderRecord = {
    campaignId: string
    campaignName: string
    campaignStartAt: Date
    participantId: string
    recipientEmail: string
}

export type CampaignStartReminderCandidate = CampaignStartReminderRecord & {
    idempotencyKey: string
}

export type InactivityNudgeRecord = {
    campaignCreatedAt: Date
    campaignEndsAt: Date
    campaignId: string
    campaignName: string
    joinedAt: Date | null
    lastActivityAt: Date | null
    participantId: string
    recipientEmail: string
}

export type InactivityNudgeCandidate = InactivityNudgeRecord & {
    cadenceWindow: number
    daysSinceLastEntry: number
    idempotencyKey: string
    inactivityAnchor: Date
}

export type ReminderJobPayload = {
    campaignStartReminderLookbackHours?: number
    continueOnError?: boolean
    inactivityCadenceDays?: number
    inactivityThresholdDays?: number
}

export type ReminderJobResult = {
    campaignStatusUpdates: Array<{
        id: string
        nextStatus: string
        previousStatus: string
    }>
    campaignStart: {
        candidates: number
        failed: number
        sent: number
        skipped: number
    }
    inactivity: {
        candidates: number
        failed: number
        sent: number
        skipped: number
    }
}

type ReminderJobDependencies = {
    appUrl?: string
    notificationStore?: typeof prisma
    participantStore?: typeof prisma
    sendCampaignStartReminderEmail?: typeof sendCampaignStartReminderEmail
    sendInactivityNudgeEmail?: typeof sendInactivityNudgeEmail
    synchronizeCampaignStatuses?: typeof synchronizeDerivedCampaignStatuses
}

function buildDashboardUrl(appUrl: string) {
    return new URL('/dashboard', appUrl).toString()
}

function buildLeaderboardUrl(appUrl: string) {
    return new URL('/leaderboard', appUrl).toString()
}

function buildLogProgressUrl(appUrl: string) {
    return new URL('/log-progress', appUrl).toString()
}

function countWholeDaysBetween(now: Date, anchor: Date) {
    return Math.floor((now.getTime() - anchor.getTime()) / DAY_IN_MS)
}

async function loadCampaignStartReminderRecords(
    store: typeof prisma,
    now: Date,
    lookbackHours: number
) {
    const lookbackStart = new Date(now.getTime() - lookbackHours * HOUR_IN_MS)

    return store.campaignParticipant
        .findMany({
            select: {
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        startAt: true,
                    },
                },
                id: true,
                user: {
                    select: {
                        email: true,
                    },
                },
            },
            where: {
                campaign: {
                    startAt: {
                        gte: lookbackStart,
                        lte: now,
                    },
                    status: 'ACTIVE',
                },
                removedAt: null,
                user: {
                    email: {
                        not: '',
                    },
                },
            },
        })
        .then((participants) =>
            participants.map((participant) => ({
                campaignId: participant.campaign.id,
                campaignName: participant.campaign.name,
                campaignStartAt: participant.campaign.startAt,
                participantId: participant.id,
                recipientEmail: participant.user.email,
            }))
        )
}

async function loadInactivityNudgeRecords(store: typeof prisma) {
    return store.campaignParticipant
        .findMany({
            select: {
                campaign: {
                    select: {
                        createdAt: true,
                        endAt: true,
                        id: true,
                        name: true,
                    },
                },
                id: true,
                joinedAt: true,
                lastActivityAt: true,
                user: {
                    select: {
                        email: true,
                    },
                },
            },
            where: {
                campaign: {
                    status: 'ACTIVE',
                },
                removedAt: null,
                user: {
                    email: {
                        not: '',
                    },
                },
            },
        })
        .then((participants) =>
            participants.map((participant) => ({
                campaignCreatedAt: participant.campaign.createdAt,
                campaignEndsAt: participant.campaign.endAt,
                campaignId: participant.campaign.id,
                campaignName: participant.campaign.name,
                joinedAt: participant.joinedAt,
                lastActivityAt: participant.lastActivityAt,
                participantId: participant.id,
                recipientEmail: participant.user.email,
            }))
        )
}

export function selectCampaignStartReminderCandidates(
    records: CampaignStartReminderRecord[],
    now: Date,
    lookbackHours = DEFAULT_CAMPAIGN_START_REMINDER_LOOKBACK_HOURS
) {
    const lookbackStart = now.getTime() - lookbackHours * HOUR_IN_MS

    return records.flatMap((record) => {
        const startTime = record.campaignStartAt.getTime()

        if (startTime > now.getTime() || startTime < lookbackStart) {
            return []
        }

        return [
            {
                ...record,
                idempotencyKey: buildCampaignStartReminderIdempotencyKey({
                    campaignId: record.campaignId,
                    campaignParticipantId: record.participantId,
                    startAt: record.campaignStartAt,
                }),
            } satisfies CampaignStartReminderCandidate,
        ]
    })
}

export function selectInactivityNudgeCandidates(
    records: InactivityNudgeRecord[],
    now: Date,
    {
        cadenceDays = DEFAULT_INACTIVITY_CADENCE_DAYS,
        thresholdDays = DEFAULT_INACTIVITY_THRESHOLD_DAYS,
    }: {
        cadenceDays?: number
        thresholdDays?: number
    } = {}
) {
    return records.flatMap((record) => {
        if (record.campaignEndsAt.getTime() <= now.getTime()) {
            return []
        }

        const inactivityAnchor =
            record.lastActivityAt ?? record.joinedAt ?? record.campaignCreatedAt

        if (inactivityAnchor.getTime() > now.getTime()) {
            return []
        }

        const daysSinceLastEntry = countWholeDaysBetween(now, inactivityAnchor)

        if (daysSinceLastEntry < thresholdDays) {
            return []
        }

        const cadenceWindow = Math.floor(
            (daysSinceLastEntry - thresholdDays) / cadenceDays
        )

        return [
            {
                ...record,
                cadenceWindow,
                daysSinceLastEntry,
                idempotencyKey: buildInactivityNudgeIdempotencyKey({
                    campaignId: record.campaignId,
                    campaignParticipantId: record.participantId,
                    cadenceWindow,
                    inactivityAnchor,
                }),
                inactivityAnchor,
            } satisfies InactivityNudgeCandidate,
        ]
    })
}

export async function runCampaignStatusSynchronizationJob(
    now = new Date(),
    dependencies: ReminderJobDependencies = {}
) {
    const synchronizeCampaignStatuses =
        dependencies.synchronizeCampaignStatuses ??
        synchronizeDerivedCampaignStatuses

    return synchronizeCampaignStatuses(now)
}

export async function runReminderEmailJob(
    now = new Date(),
    payload: ReminderJobPayload = {},
    dependencies: ReminderJobDependencies = {}
): Promise<ReminderJobResult> {
    const participantStore = dependencies.participantStore ?? prisma
    const notificationStore = dependencies.notificationStore ?? prisma
    const sendStartReminder =
        dependencies.sendCampaignStartReminderEmail ??
        sendCampaignStartReminderEmail
    const sendNudge =
        dependencies.sendInactivityNudgeEmail ?? sendInactivityNudgeEmail
    const appUrl = dependencies.appUrl ?? getEmailDeliveryConfig().appUrl
    const campaignStartReminderLookbackHours =
        payload.campaignStartReminderLookbackHours ??
        DEFAULT_CAMPAIGN_START_REMINDER_LOOKBACK_HOURS
    const inactivityThresholdDays =
        payload.inactivityThresholdDays ?? DEFAULT_INACTIVITY_THRESHOLD_DAYS
    const inactivityCadenceDays =
        payload.inactivityCadenceDays ?? DEFAULT_INACTIVITY_CADENCE_DAYS
    const continueOnError = payload.continueOnError ?? true
    const campaignStatusUpdates = await runCampaignStatusSynchronizationJob(
        now,
        dependencies
    )
    const campaignStartCandidates = selectCampaignStartReminderCandidates(
        await loadCampaignStartReminderRecords(
            participantStore,
            now,
            campaignStartReminderLookbackHours
        ),
        now,
        campaignStartReminderLookbackHours
    )
    const inactivityCandidates = selectInactivityNudgeCandidates(
        await loadInactivityNudgeRecords(participantStore),
        now,
        {
            cadenceDays: inactivityCadenceDays,
            thresholdDays: inactivityThresholdDays,
        }
    )
    const result: ReminderJobResult = {
        campaignStart: {
            candidates: campaignStartCandidates.length,
            failed: 0,
            sent: 0,
            skipped: 0,
        },
        campaignStatusUpdates,
        inactivity: {
            candidates: inactivityCandidates.length,
            failed: 0,
            sent: 0,
            skipped: 0,
        },
    }

    for (const candidate of campaignStartCandidates) {
        const claim = await claimNotificationDelivery(notificationStore, {
            campaignId: candidate.campaignId,
            campaignParticipantId: candidate.participantId,
            idempotencyKey: candidate.idempotencyKey,
            kind: 'campaign-start-reminder',
            metadata: {
                campaignName: candidate.campaignName,
                campaignStartAt: candidate.campaignStartAt.toISOString(),
            },
            now,
            recipientEmail: candidate.recipientEmail,
            scheduledFor: candidate.campaignStartAt,
        })

        if (claim.status !== 'claimed' || !claim.deliveryId) {
            result.campaignStart.skipped += 1
            continue
        }

        try {
            const delivery = await sendStartReminder({
                campaignName: candidate.campaignName,
                dashboardUrl: buildDashboardUrl(appUrl),
                logProgressUrl: buildLogProgressUrl(appUrl),
                recipientEmail: candidate.recipientEmail,
                startAt: candidate.campaignStartAt,
            })

            await completeNotificationDelivery(notificationStore, {
                deliveryId: claim.deliveryId,
                now,
                providerMessageId: delivery.id,
            })
            result.campaignStart.sent += 1
        } catch (error) {
            await failNotificationDelivery(notificationStore, {
                deliveryId: claim.deliveryId,
                now,
            })
            result.campaignStart.failed += 1

            if (!continueOnError) {
                throw error
            }
        }
    }

    for (const candidate of inactivityCandidates) {
        const claim = await claimNotificationDelivery(notificationStore, {
            campaignId: candidate.campaignId,
            campaignParticipantId: candidate.participantId,
            idempotencyKey: candidate.idempotencyKey,
            kind: 'inactivity-nudge',
            metadata: {
                cadenceWindow: candidate.cadenceWindow,
                daysSinceLastEntry: candidate.daysSinceLastEntry,
                inactivityAnchor: candidate.inactivityAnchor.toISOString(),
            },
            now,
            recipientEmail: candidate.recipientEmail,
        })

        if (claim.status !== 'claimed' || !claim.deliveryId) {
            result.inactivity.skipped += 1
            continue
        }

        try {
            const delivery = await sendNudge({
                campaignEndsAt: candidate.campaignEndsAt,
                campaignName: candidate.campaignName,
                daysSinceLastEntry: candidate.daysSinceLastEntry,
                leaderboardUrl: buildLeaderboardUrl(appUrl),
                logProgressUrl: buildLogProgressUrl(appUrl),
                recipientEmail: candidate.recipientEmail,
            })

            await completeNotificationDelivery(notificationStore, {
                deliveryId: claim.deliveryId,
                now,
                providerMessageId: delivery.id,
            })
            result.inactivity.sent += 1
        } catch (error) {
            await failNotificationDelivery(notificationStore, {
                deliveryId: claim.deliveryId,
                now,
            })
            result.inactivity.failed += 1

            if (!continueOnError) {
                throw error
            }
        }
    }

    return result
}

export function createCampaignLifecycleJobDefinitions(
    dependencies: ReminderJobDependencies = {}
): JobDefinition[] {
    return [
        defineJob({
            description:
                'Synchronize campaign statuses from their published date windows.',
            handler: ({ context }) =>
                runCampaignStatusSynchronizationJob(context.now, dependencies),
            name: 'campaigns.sync-derived-statuses',
        }),
        defineJob<ReminderJobPayload, ReminderJobResult>({
            description:
                'Send campaign start reminders and inactivity nudges with idempotent delivery tracking.',
            handler: ({ context, payload }) =>
                runReminderEmailJob(context.now, payload, dependencies),
            name: 'notifications.send-reminders',
        }),
    ]
}
