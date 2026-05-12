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
    campaignId,
    selectedReadingEntryId,
}: {
    detail?: string
    outcome: string
    campaignId?: string
    selectedReadingEntryId?: string
}) {
    const params = new URLSearchParams({ outcome })

    if (detail) {
        params.set('detail', detail)
    }

    if (campaignId) {
        params.set('campaignId', campaignId)
    }

    if (selectedReadingEntryId) {
        params.set('selectedReadingEntryId', selectedReadingEntryId)
    }

    return `${adminReportsPath}?${params.toString()}`
}

function finishAction({
    detail,
    outcome,
    campaignId,
    selectedReadingEntryId,
}: {
    detail?: string
    outcome: string
    campaignId?: string
    selectedReadingEntryId?: string
}): never {
    revalidatePath(adminReportsPath)
    revalidatePath('/dashboard')
    revalidatePath('/leaderboard')
    revalidatePath('/campaign-board')

    redirect(
        buildRedirectUrl({
            detail,
            outcome,
            campaignId,
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
    const campaignId = getStringField(formData, 'campaignId')
    const readingEntryId = getStringField(formData, 'readingEntryId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    if (!readingEntryId) {
        finishAction({
            detail: 'reading-entry-not-found',
            outcome: 'error',
            campaignId,
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
            campaignId: result.campaignId,
            selectedReadingEntryId: result.readingEntryId,
        })
    } catch (error) {
        finishAction({
            detail: resolveLogProgressMutationErrorCode(error),
            outcome: 'error',
            campaignId,
            selectedReadingEntryId: readingEntryId,
        })
    }
}
