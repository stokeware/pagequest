'use server'

import { revalidatePath } from 'next/cache'

import { requireAuthenticatedActionUser } from '@/lib/auth/session'
import {
    getParticipantChallengeLabel,
    syncParticipantChallengeSources,
} from '@/lib/challenge-config'
import type { LogProgressFormValues } from '@/lib/log-progress'
import {
    recordLogProgressEntry,
    resolveLogProgressMutationErrorCode,
} from '@/lib/log-progress-service'
import { prisma } from '@/lib/prisma'

import {
    campaignWorkspaceAuditAction,
    normalizeCampaignWorkspaceRowCompletions,
    parseCampaignWorkspaceState,
    type CampaignWorkspaceState,
} from './workspace-state'

type SubmitLogProgressInput = {
    campaignParticipantId: string | null
    values: LogProgressFormValues
}

type SubmitLogProgressResult =
    | {
          message: string
          outcome: 'success'
      }
    | {
          detail: string
          message: string
          outcome: 'error'
      }

export type SaveCampaignWorkspaceInput = {
    campaignParticipantId: string | null
    workspaceState: CampaignWorkspaceState
}

type SaveCampaignWorkspaceResult =
    | {
          message: string
          outcome: 'success'
          workspaceState: CampaignWorkspaceState
      }
    | {
          detail: string
          message: string
          outcome: 'error'
      }
    | {
          detail: string
          message: string
          outcome: 'error'
      }

export async function submitLogProgressAction(
    input: SubmitLogProgressInput
): Promise<SubmitLogProgressResult> {
    const actor = await requireAuthenticatedActionUser('COMPETITOR')

    if (!input.campaignParticipantId) {
        return {
            detail: 'missing-campaign-participant',
            message:
                'A campaign profile is required before you can save reading progress.',
            outcome: 'error',
        }
    }

    const campaignParticipantId = input.campaignParticipantId

    try {
        const result = await prisma.$transaction((transaction) =>
            recordLogProgressEntry(transaction, {
                actorUserId: actor.id,
                formValues: input.values,
                now: new Date(),
                campaignParticipantId,
            })
        )

        revalidatePath('/dashboard')
        revalidatePath('/leaderboard')
        revalidatePath('/campaign-board')

        return {
            message: `Totals refreshed to ${result.totals.totalPoints.toString()} points across ${result.totals.totalBooks} books, ${result.totals.totalPages} pages, ${result.totals.totalAudiobookMinutes} audiobook minutes, and ${result.totals.totalChallenges} challenges.`,
            outcome: 'success',
        }
    } catch (error) {
        return {
            detail: resolveLogProgressMutationErrorCode(error),
            message: resolveLogProgressErrorMessage(error),
            outcome: 'error',
        }
    }
}

export async function saveCampaignWorkspaceAction(
    input: SaveCampaignWorkspaceInput
): Promise<SaveCampaignWorkspaceResult> {
    const actor = await requireAuthenticatedActionUser('COMPETITOR')

    if (!input.campaignParticipantId) {
        return {
            detail: 'missing-campaign-participant',
            message:
                'A campaign profile is required before you can save campaign workspace changes.',
            outcome: 'error',
        }
    }

    const participant = await prisma.campaignParticipant.findUnique({
        select: {
            campaignId: true,
            id: true,
            removedAt: true,
            userId: true,
            user: {
                select: {
                    email: true,
                    name: true,
                },
            },
        },
        where: {
            id: input.campaignParticipantId,
        },
    })

    if (!participant) {
        return {
            detail: 'participant-not-found',
            message: 'That campaign workspace is no longer available.',
            outcome: 'error',
        }
    }

    if (participant.removedAt) {
        return {
            detail: 'participant-removed',
            message: 'This campaign participation is no longer active.',
            outcome: 'error',
        }
    }

    if (participant.userId !== actor.id) {
        return {
            detail: 'participant-access-denied',
            message: 'You can only save your own campaign workspace.',
            outcome: 'error',
        }
    }

    const parsedWorkspaceState = parseCampaignWorkspaceState(
        input.workspaceState
    )
    const workspaceState = await prisma.$transaction(async (transaction) => {
        await syncParticipantChallengeSources(transaction, {
            campaignId: participant.campaignId,
            campaignParticipantId: participant.id,
            participantLabel: getParticipantChallengeLabel(participant.user),
            personalGoalTitle: parsedWorkspaceState.personalGoalTitle,
            recommendationTitle: parsedWorkspaceState.recommendationTitle,
        })

        const nextWorkspaceState = {
            ...parsedWorkspaceState,
            progressRows: normalizeCampaignWorkspaceRowCompletions({
                rows: parsedWorkspaceState.progressRows.filter(
                    (row) =>
                        row.rowType === 'PERSONAL_GOAL' ||
                        row.bookName.length > 0
                ),
            }),
        }

        await transaction.auditLog.create({
            data: {
                action: campaignWorkspaceAuditAction,
                actorUserId: actor.id,
                campaignId: participant.campaignId,
                campaignParticipantId: participant.id,
                entityId: participant.id,
                entityType: 'CampaignParticipant',
                metadata: nextWorkspaceState,
            },
        })

        return nextWorkspaceState
    })

    revalidatePath('/campaign-board')

    return {
        message: 'Campaign changes saved.',
        outcome: 'success',
        workspaceState,
    }
}

function resolveLogProgressErrorMessage(error: unknown) {
    const errorCode = resolveLogProgressMutationErrorCode(error)

    switch (errorCode) {
        case 'duplicate-one-time-challenge-completion':
            return 'That one-time challenge has already been credited for this campaign participant.'
        case 'invalid-entry':
            return error instanceof Error
                ? error.message
                : 'The entry is invalid.'
        case 'participant-access-denied':
        case 'participant-not-found':
        case 'participant-removed':
        case 'campaign-challenge-not-found':
            return error instanceof Error
                ? error.message
                : 'The selected campaign entry could not be saved.'
        default:
            return 'Something went wrong while saving the entry. Try again.'
    }
}
