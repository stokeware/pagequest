'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminActionUser } from '@/lib/auth/session'
import {
    assertQuestChallengeNotAssigned,
    assertSingleActiveQuest,
    QuestAdminError,
    parseQuestChallengeAssignmentFormValues,
    parseQuestFormValues,
    prepareQuestChallengeAssignmentValues,
    prepareQuestArchiveValues,
    prepareQuestCreateValues,
    prepareQuestDuplicateValues,
    prepareQuestPublishValues,
    prepareQuestUpdateValues,
} from '@/lib/quest-admin'
import { prisma } from '@/lib/prisma'

const adminQuestsPath = '/admin/quests'

function buildRedirectUrl({
    detail,
    outcome,
    selectedQuestId,
}: {
    detail?: string
    outcome: string
    selectedQuestId?: string
}) {
    const params = new URLSearchParams({
        outcome,
    })

    if (detail) {
        params.set('detail', detail)
    }

    if (selectedQuestId) {
        params.set('selectedQuestId', selectedQuestId)
    }

    return `${adminQuestsPath}?${params.toString()}`
}

function finishAction({
    detail,
    outcome,
    selectedQuestId,
}: {
    detail?: string
    outcome: string
    selectedQuestId?: string
}): never {
    revalidatePath(adminQuestsPath)
    redirect(
        buildRedirectUrl({
            detail,
            outcome,
            selectedQuestId,
        })
    )
}

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

async function loadQuest(questId: string) {
    return prisma.quest.findUnique({
        select: {
            archivedAt: true,
            description: true,
            endAt: true,
            entryDeleteWindowMinutes: true,
            entryEditWindowMinutes: true,
            id: true,
            name: true,
            pointsPerAudiobookMinute: true,
            pointsPerBook: true,
            pointsPerChallengeCompletion: true,
            pointsPerPage: true,
            publishedAt: true,
            startAt: true,
            timezone: true,
            visibility: true,
        },
        where: {
            id: questId,
        },
    })
}

async function loadActiveQuestConflict({
    excludeQuestId,
    now,
}: {
    excludeQuestId?: string
    now: Date
}) {
    return prisma.quest.findFirst({
        select: {
            id: true,
            name: true,
        },
        where: {
            archivedAt: null,
            endAt: {
                gte: now,
            },
            id: excludeQuestId
                ? {
                      not: excludeQuestId,
                  }
                : undefined,
            publishedAt: {
                not: null,
            },
            startAt: {
                lte: now,
            },
        },
    })
}

function resolveQuestErrorCode(error: unknown) {
    if (error instanceof QuestAdminError) {
        return error.code
    }

    return 'unexpected-error'
}

function isRedirectSignal(error: unknown) {
    if (typeof error !== 'object' || error === null) {
        return false
    }

    const digest = 'digest' in error ? error.digest : null

    return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

export async function createQuestAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const now = new Date()

    try {
        const formValues = parseQuestFormValues(formData)
        const values = prepareQuestCreateValues(formValues, now)
        const activeQuest = await loadActiveQuestConflict({
            now,
        })

        assertSingleActiveQuest({
            activeQuest,
            nextStatus: values.status,
        })

        const createdQuest = await prisma.$transaction(async (transaction) => {
            const quest = await transaction.quest.create({
                data: {
                    ...values,
                    createdByUserId: actor.id,
                },
                select: {
                    id: true,
                    status: true,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'quest.created',
                    actorUserId: actor.id,
                    entityId: quest.id,
                    entityType: 'Quest',
                    metadata: {
                        status: quest.status,
                    },
                    questId: quest.id,
                },
            })

            return quest
        })

        finishAction({
            outcome: 'created',
            selectedQuestId: createdQuest.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveQuestErrorCode(error),
            outcome: 'error',
        })
    }
}

export async function updateQuestAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const now = new Date()
    const questId = getStringField(formData, 'questId')

    if (!questId) {
        finishAction({
            detail: 'missing-quest',
            outcome: 'error',
        })
    }

    const quest = await loadQuest(questId)

    if (!quest) {
        finishAction({
            detail: 'quest-not-found',
            outcome: 'error',
        })
    }

    if (quest.archivedAt) {
        finishAction({
            detail: 'quest-not-editable',
            outcome: 'error',
            selectedQuestId: quest.id,
        })
    }

    try {
        const formValues = parseQuestFormValues(formData)
        const values = prepareQuestUpdateValues({
            archivedAt: quest.archivedAt,
            formValues,
            now,
            publishedAt: quest.publishedAt,
        })
        const activeQuest = await loadActiveQuestConflict({
            excludeQuestId: quest.id,
            now,
        })

        assertSingleActiveQuest({
            activeQuest,
            nextStatus: values.status,
            questId: quest.id,
        })

        await prisma.$transaction(async (transaction) => {
            await transaction.quest.update({
                data: values,
                where: {
                    id: quest.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'quest.updated',
                    actorUserId: actor.id,
                    entityId: quest.id,
                    entityType: 'Quest',
                    metadata: {
                        status: values.status,
                    },
                    questId: quest.id,
                },
            })
        })

        finishAction({
            outcome: 'updated',
            selectedQuestId: quest.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveQuestErrorCode(error),
            outcome: 'error',
            selectedQuestId: quest.id,
        })
    }
}

export async function publishQuestAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const now = new Date()
    const questId = getStringField(formData, 'questId')

    if (!questId) {
        finishAction({
            detail: 'missing-quest',
            outcome: 'error',
        })
    }

    const quest = await loadQuest(questId)

    if (!quest) {
        finishAction({
            detail: 'quest-not-found',
            outcome: 'error',
        })
    }

    try {
        const values = prepareQuestPublishValues({
            now,
            quest,
        })
        const activeQuest = await loadActiveQuestConflict({
            excludeQuestId: quest.id,
            now,
        })

        assertSingleActiveQuest({
            activeQuest,
            nextStatus: values.status,
            questId: quest.id,
        })

        await prisma.$transaction(async (transaction) => {
            await transaction.quest.update({
                data: values,
                where: {
                    id: quest.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'quest.published',
                    actorUserId: actor.id,
                    entityId: quest.id,
                    entityType: 'Quest',
                    metadata: {
                        publishedAt: values.publishedAt?.toISOString() ?? null,
                        status: values.status,
                    },
                    questId: quest.id,
                },
            })
        })

        finishAction({
            outcome: 'published',
            selectedQuestId: quest.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveQuestErrorCode(error),
            outcome: 'error',
            selectedQuestId: quest.id,
        })
    }
}

export async function archiveQuestAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const questId = getStringField(formData, 'questId')

    if (!questId) {
        finishAction({
            detail: 'missing-quest',
            outcome: 'error',
        })
    }

    const quest = await loadQuest(questId)

    if (!quest) {
        finishAction({
            detail: 'quest-not-found',
            outcome: 'error',
        })
    }

    try {
        const values = prepareQuestArchiveValues({
            now: new Date(),
            quest,
        })

        await prisma.$transaction(async (transaction) => {
            await transaction.quest.update({
                data: values,
                where: {
                    id: quest.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'quest.archived',
                    actorUserId: actor.id,
                    entityId: quest.id,
                    entityType: 'Quest',
                    metadata: {
                        archivedAt: values.archivedAt?.toISOString() ?? null,
                        status: values.status,
                    },
                    questId: quest.id,
                },
            })
        })

        finishAction({
            outcome: 'archived',
            selectedQuestId: quest.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveQuestErrorCode(error),
            outcome: 'error',
            selectedQuestId: quest.id,
        })
    }
}

export async function duplicateQuestAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const questId = getStringField(formData, 'questId')

    if (!questId) {
        finishAction({
            detail: 'missing-quest',
            outcome: 'error',
        })
    }

    const quest = await loadQuest(questId)

    if (!quest) {
        finishAction({
            detail: 'quest-not-found',
            outcome: 'error',
        })
    }

    try {
        const values = prepareQuestDuplicateValues(quest)

        const duplicatedQuest = await prisma.$transaction(
            async (transaction) => {
                const createdQuest = await transaction.quest.create({
                    data: {
                        ...values,
                        createdByUserId: actor.id,
                    },
                    select: {
                        id: true,
                    },
                })

                await transaction.auditLog.create({
                    data: {
                        action: 'quest.duplicated',
                        actorUserId: actor.id,
                        entityId: createdQuest.id,
                        entityType: 'Quest',
                        metadata: {
                            sourceQuestId: quest.id,
                        },
                        questId: createdQuest.id,
                    },
                })

                return createdQuest
            }
        )

        finishAction({
            outcome: 'duplicated',
            selectedQuestId: duplicatedQuest.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveQuestErrorCode(error),
            outcome: 'error',
            selectedQuestId: quest.id,
        })
    }
}

export async function assignQuestChallengeAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const questId = getStringField(formData, 'questId')

    if (!questId) {
        finishAction({
            detail: 'missing-quest',
            outcome: 'error',
        })
    }

    const quest = await prisma.quest.findUnique({
        select: {
            archivedAt: true,
            id: true,
            questChallenges: {
                select: {
                    challengeId: true,
                },
            },
        },
        where: {
            id: questId,
        },
    })

    if (!quest) {
        finishAction({
            detail: 'quest-not-found',
            outcome: 'error',
        })
    }

    if (quest.archivedAt) {
        finishAction({
            detail: 'quest-not-editable',
            outcome: 'error',
            selectedQuestId: quest.id,
        })
    }

    try {
        const formValues = parseQuestChallengeAssignmentFormValues(formData)
        const values = prepareQuestChallengeAssignmentValues(formValues)
        const challenge = await prisma.challenge.findUnique({
            select: {
                id: true,
                title: true,
            },
            where: {
                id: values.challengeId,
            },
        })

        if (!challenge) {
            throw new QuestAdminError(
                'challenge-not-found',
                'That challenge record is no longer available.'
            )
        }

        assertQuestChallengeNotAssigned({
            challengeId: values.challengeId,
            existingChallengeIds: quest.questChallenges.map(
                (assignment) => assignment.challengeId
            ),
        })

        await prisma.$transaction(async (transaction) => {
            const assignment = await transaction.questChallenge.create({
                data: {
                    ...values,
                    questId: quest.id,
                },
                select: {
                    id: true,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'quest.challenge-assigned',
                    actorUserId: actor.id,
                    challengeId: challenge.id,
                    entityId: assignment.id,
                    entityType: 'QuestChallenge',
                    metadata: {
                        challengeTitle: challenge.title,
                        pointValueOverride:
                            values.pointValueOverride?.toString() ?? null,
                        sortOrder: values.sortOrder,
                    },
                    questId: quest.id,
                },
            })
        })

        revalidatePath('/admin/challenges')
        finishAction({
            outcome: 'challenge-assigned',
            selectedQuestId: quest.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveQuestErrorCode(error),
            outcome: 'error',
            selectedQuestId: quest.id,
        })
    }
}
