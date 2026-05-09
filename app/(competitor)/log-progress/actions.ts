'use server'

import { revalidatePath } from 'next/cache'

import { requireAuthenticatedActionUser } from '@/lib/auth/session'
import type { LogProgressFormValues } from '@/lib/log-progress'
import {
    recordLogProgressEntry,
    resolveLogProgressMutationErrorCode,
} from '@/lib/log-progress-service'
import { prisma } from '@/lib/prisma'

type SubmitLogProgressInput = {
    questParticipantId: string | null
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

export async function submitLogProgressAction(
    input: SubmitLogProgressInput
): Promise<SubmitLogProgressResult> {
    const actor = await requireAuthenticatedActionUser('COMPETITOR')

    if (!input.questParticipantId) {
        return {
            detail: 'missing-quest-participant',
            message:
                'A quest profile is required before you can save reading progress.',
            outcome: 'error',
        }
    }

    try {
        const result = await prisma.$transaction((transaction) =>
            recordLogProgressEntry(transaction, {
                actorUserId: actor.id,
                formValues: input.values,
                now: new Date(),
                questParticipantId: input.questParticipantId,
            })
        )

        revalidatePath('/dashboard')
        revalidatePath('/history')
        revalidatePath('/leaderboard')
        revalidatePath('/log-progress')

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

function resolveLogProgressErrorMessage(error: unknown) {
    const errorCode = resolveLogProgressMutationErrorCode(error)

    switch (errorCode) {
        case 'duplicate-one-time-challenge-completion':
            return 'That one-time challenge has already been credited for this quest participant.'
        case 'invalid-entry':
            return error instanceof Error
                ? error.message
                : 'The entry is invalid.'
        case 'participant-access-denied':
        case 'participant-not-found':
        case 'participant-removed':
        case 'quest-challenge-not-found':
            return error instanceof Error
                ? error.message
                : 'The selected quest entry could not be saved.'
        default:
            return 'Something went wrong while saving the entry. Try again.'
    }
}
