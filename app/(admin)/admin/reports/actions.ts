'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminActionUser } from '@/lib/auth/session'
import type { LogProgressFormValues } from '@/lib/log-progress'
import {
    resolveLogProgressMutationErrorCode,
    updateReadingEntryAsAdmin,
} from '@/lib/log-progress-service'
import { prisma } from '@/lib/prisma'

const adminReportsPath = '/admin/reports'

function buildRedirectUrl({
    detail,
    outcome,
    questId,
    selectedReadingEntryId,
}: {
    detail?: string
    outcome: string
    questId?: string
    selectedReadingEntryId?: string
}) {
    const params = new URLSearchParams({ outcome })

    if (detail) {
        params.set('detail', detail)
    }

    if (questId) {
        params.set('questId', questId)
    }

    if (selectedReadingEntryId) {
        params.set('selectedReadingEntryId', selectedReadingEntryId)
    }

    return `${adminReportsPath}?${params.toString()}`
}

function finishAction({
    detail,
    outcome,
    questId,
    selectedReadingEntryId,
}: {
    detail?: string
    outcome: string
    questId?: string
    selectedReadingEntryId?: string
}): never {
    revalidatePath(adminReportsPath)
    revalidatePath('/dashboard')
    revalidatePath('/history')
    revalidatePath('/leaderboard')
    revalidatePath('/log-progress')

    redirect(
        buildRedirectUrl({
            detail,
            outcome,
            questId,
            selectedReadingEntryId,
        })
    )
}

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

function parseAdminReadingEntryFormValues(
    formData: FormData
): LogProgressFormValues {
    return {
        activityDate: getStringField(formData, 'activityDate'),
        bookAuthor: getStringField(formData, 'bookAuthor'),
        bookTitle: getStringField(formData, 'bookTitle'),
        challengeId: '',
        notes: getStringField(formData, 'notes'),
        type: getStringField(formData, 'type') as LogProgressFormValues['type'],
        value: getStringField(formData, 'value'),
    }
}

export async function updateAdminReadingEntryAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const questId = getStringField(formData, 'questId')
    const readingEntryId = getStringField(formData, 'readingEntryId')

    if (!questId) {
        finishAction({
            detail: 'missing-quest',
            outcome: 'error',
        })
    }

    if (!readingEntryId) {
        finishAction({
            detail: 'reading-entry-not-found',
            outcome: 'error',
            questId,
        })
    }

    try {
        const values = parseAdminReadingEntryFormValues(formData)
        const result = await prisma.$transaction((transaction) =>
            updateReadingEntryAsAdmin(transaction, {
                actorUserId: actor.id,
                formValues: values,
                now: new Date(),
                readingEntryId,
            })
        )

        finishAction({
            outcome: 'entry-updated',
            questId: result.questId,
            selectedReadingEntryId: result.readingEntryId,
        })
    } catch (error) {
        finishAction({
            detail: resolveLogProgressMutationErrorCode(error),
            outcome: 'error',
            questId,
            selectedReadingEntryId: readingEntryId,
        })
    }
}
