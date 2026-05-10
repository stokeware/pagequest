'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminActionUser } from '@/lib/auth/session'
import {
    assertCampaignChallengeNotAssigned,
    assertSingleActiveQuest,
    CampaignAdminError,
    parseCampaignChallengeAssignmentFormValues,
    parseCampaignFormValues,
    prepareCampaignChallengeAssignmentValues,
    prepareCampaignArchiveValues,
    prepareCampaignCreateValues,
    prepareCampaignDuplicateValues,
    prepareCampaignPublishValues,
    prepareCampaignUpdateValues,
} from '@/lib/campaign-admin'
import {
    ChallengeAdminError,
    parseChallengeFormValues,
    prepareChallengeCreateValues,
    prepareChallengeUpdateValues,
} from '@/lib/challenge-admin'
import { prisma } from '@/lib/prisma'

const adminCampaignsPath = '/admin/campaigns'

function buildRedirectUrl({
    detail,
    outcome,
    selectedCampaignId,
}: {
    detail?: string
    outcome: string
    selectedCampaignId?: string
}) {
    const params = new URLSearchParams({
        outcome,
    })

    if (detail) {
        params.set('detail', detail)
    }

    if (selectedCampaignId) {
        params.set('selectedCampaignId', selectedCampaignId)
    }

    return `${adminCampaignsPath}?${params.toString()}`
}

function finishAction({
    detail,
    outcome,
    selectedCampaignId,
}: {
    detail?: string
    outcome: string
    selectedCampaignId?: string
}): never {
    revalidatePath(adminCampaignsPath)
    redirect(
        buildRedirectUrl({
            detail,
            outcome,
            selectedCampaignId,
        })
    )
}

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

async function loadQuest(campaignId: string) {
    return prisma.campaign.findUnique({
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
            id: campaignId,
        },
    })
}

async function loadEditableCampaign(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
        select: {
            archivedAt: true,
            id: true,
        },
        where: {
            id: campaignId,
        },
    })

    if (!campaign) {
        finishAction({
            detail: 'campaign-not-found',
            outcome: 'error',
        })
    }

    if (campaign.archivedAt) {
        finishAction({
            detail: 'campaign-not-editable',
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }

    return campaign
}

async function loadActiveCampaignConflict({
    excludeCampaignId,
    now,
}: {
    excludeCampaignId?: string
    now: Date
}) {
    return prisma.campaign.findFirst({
        select: {
            id: true,
            name: true,
        },
        where: {
            archivedAt: null,
            endAt: {
                gte: now,
            },
            id: excludeCampaignId
                ? {
                      not: excludeCampaignId,
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

function resolveCampaignErrorCode(error: unknown) {
    if (error instanceof ChallengeAdminError) {
        return error.code
    }

    if (error instanceof CampaignAdminError) {
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

export async function createCampaignAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const now = new Date()

    try {
        const formValues = parseCampaignFormValues(formData)
        const values = prepareCampaignCreateValues(formValues, now)
        const activeQuest = await loadActiveCampaignConflict({
            now,
        })

        assertSingleActiveQuest({
            activeQuest,
            nextStatus: values.status,
        })

        const createdQuest = await prisma.$transaction(async (transaction) => {
            const campaign = await transaction.campaign.create({
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
                    action: 'campaign.created',
                    actorUserId: actor.id,
                    entityId: campaign.id,
                    entityType: 'Campaign',
                    metadata: {
                        status: campaign.status,
                    },
                    campaignId: campaign.id,
                },
            })

            return campaign
        })

        finishAction({
            outcome: 'created',
            selectedCampaignId: createdQuest.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
        })
    }
}

export async function updateCampaignAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const now = new Date()
    const campaignId = getStringField(formData, 'campaignId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    const campaign = await loadQuest(campaignId)

    if (!campaign) {
        finishAction({
            detail: 'campaign-not-found',
            outcome: 'error',
        })
    }

    if (campaign.archivedAt) {
        finishAction({
            detail: 'campaign-not-editable',
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }

    try {
        const formValues = parseCampaignFormValues(formData)
        const values = prepareCampaignUpdateValues({
            archivedAt: campaign.archivedAt,
            formValues,
            now,
            publishedAt: campaign.publishedAt,
        })
        const activeQuest = await loadActiveCampaignConflict({
            excludeCampaignId: campaign.id,
            now,
        })

        assertSingleActiveQuest({
            activeQuest,
            nextStatus: values.status,
            campaignId: campaign.id,
        })

        await prisma.$transaction(async (transaction) => {
            await transaction.campaign.update({
                data: values,
                where: {
                    id: campaign.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'campaign.updated',
                    actorUserId: actor.id,
                    entityId: campaign.id,
                    entityType: 'Campaign',
                    metadata: {
                        status: values.status,
                    },
                    campaignId: campaign.id,
                },
            })
        })

        finishAction({
            outcome: 'updated',
            selectedCampaignId: campaign.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }
}

export async function publishCampaignAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const now = new Date()
    const campaignId = getStringField(formData, 'campaignId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    const campaign = await loadQuest(campaignId)

    if (!campaign) {
        finishAction({
            detail: 'campaign-not-found',
            outcome: 'error',
        })
    }

    try {
        const values = prepareCampaignPublishValues({
            now,
            campaign,
        })
        const activeQuest = await loadActiveCampaignConflict({
            excludeCampaignId: campaign.id,
            now,
        })

        assertSingleActiveQuest({
            activeQuest,
            nextStatus: values.status,
            campaignId: campaign.id,
        })

        await prisma.$transaction(async (transaction) => {
            await transaction.campaign.update({
                data: values,
                where: {
                    id: campaign.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'campaign.published',
                    actorUserId: actor.id,
                    entityId: campaign.id,
                    entityType: 'Campaign',
                    metadata: {
                        publishedAt: values.publishedAt?.toISOString() ?? null,
                        status: values.status,
                    },
                    campaignId: campaign.id,
                },
            })
        })

        finishAction({
            outcome: 'published',
            selectedCampaignId: campaign.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }
}

export async function archiveCampaignAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const campaignId = getStringField(formData, 'campaignId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    const campaign = await loadQuest(campaignId)

    if (!campaign) {
        finishAction({
            detail: 'campaign-not-found',
            outcome: 'error',
        })
    }

    try {
        const values = prepareCampaignArchiveValues({
            now: new Date(),
            campaign,
        })

        await prisma.$transaction(async (transaction) => {
            await transaction.campaign.update({
                data: values,
                where: {
                    id: campaign.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'campaign.archived',
                    actorUserId: actor.id,
                    entityId: campaign.id,
                    entityType: 'Campaign',
                    metadata: {
                        archivedAt: values.archivedAt?.toISOString() ?? null,
                        status: values.status,
                    },
                    campaignId: campaign.id,
                },
            })
        })

        finishAction({
            outcome: 'archived',
            selectedCampaignId: campaign.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }
}

export async function duplicateCampaignAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const campaignId = getStringField(formData, 'campaignId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    const campaign = await loadQuest(campaignId)

    if (!campaign) {
        finishAction({
            detail: 'campaign-not-found',
            outcome: 'error',
        })
    }

    try {
        const values = prepareCampaignDuplicateValues(campaign)

        const duplicatedQuest = await prisma.$transaction(
            async (transaction) => {
                const createdQuest = await transaction.campaign.create({
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
                        action: 'campaign.duplicated',
                        actorUserId: actor.id,
                        entityId: createdQuest.id,
                        entityType: 'Campaign',
                        metadata: {
                            sourceCampaignId: campaign.id,
                        },
                        campaignId: createdQuest.id,
                    },
                })

                return createdQuest
            }
        )

        finishAction({
            outcome: 'duplicated',
            selectedCampaignId: duplicatedQuest.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }
}

export async function assignCampaignChallengeAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const campaignId = getStringField(formData, 'campaignId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    const campaign = await prisma.campaign.findUnique({
        select: {
            archivedAt: true,
            id: true,
            campaignChallenges: {
                select: {
                    challengeId: true,
                },
            },
        },
        where: {
            id: campaignId,
        },
    })

    if (!campaign) {
        finishAction({
            detail: 'campaign-not-found',
            outcome: 'error',
        })
    }

    if (campaign.archivedAt) {
        finishAction({
            detail: 'campaign-not-editable',
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }

    try {
        const formValues = parseCampaignChallengeAssignmentFormValues(formData)
        const values = prepareCampaignChallengeAssignmentValues(formValues)
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
            throw new CampaignAdminError(
                'challenge-not-found',
                'That challenge record is no longer available.'
            )
        }

        assertCampaignChallengeNotAssigned({
            challengeId: values.challengeId,
            existingChallengeIds: campaign.campaignChallenges.map(
                (assignment) => assignment.challengeId
            ),
        })

        await prisma.$transaction(async (transaction) => {
            const assignment = await transaction.campaignChallenge.create({
                data: {
                    ...values,
                    campaignId: campaign.id,
                },
                select: {
                    id: true,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'campaign.challenge-assigned',
                    actorUserId: actor.id,
                    challengeId: challenge.id,
                    entityId: assignment.id,
                    entityType: 'CampaignChallenge',
                    metadata: {
                        challengeTitle: challenge.title,
                        pointValueOverride:
                            values.pointValueOverride?.toString() ?? null,
                        sortOrder: values.sortOrder,
                    },
                    campaignId: campaign.id,
                },
            })
        })

        revalidatePath('/admin/challenges')
        finishAction({
            outcome: 'challenge-assigned',
            selectedCampaignId: campaign.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }
}

export async function createCampaignChallengeAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const campaignId = getStringField(formData, 'campaignId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    const campaign = await loadEditableCampaign(campaignId)

    try {
        const formValues = parseChallengeFormValues(formData)
        const values = prepareChallengeCreateValues(formValues)
        const nextSortOrder = await prisma.campaignChallenge.count({
            where: {
                campaignId: campaign.id,
            },
        })

        await prisma.$transaction(async (transaction) => {
            const challenge = await transaction.challenge.create({
                data: {
                    ...values,
                    createdByUserId: actor.id,
                },
                select: {
                    id: true,
                    title: true,
                },
            })

            const assignment = await transaction.campaignChallenge.create({
                data: {
                    campaignId: campaign.id,
                    challengeId: challenge.id,
                    isActive: true,
                    pointValueOverride: null,
                    sortOrder: nextSortOrder,
                },
                select: {
                    id: true,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'challenge.created',
                    actorUserId: actor.id,
                    challengeId: challenge.id,
                    entityId: challenge.id,
                    entityType: 'Challenge',
                    metadata: {},
                    campaignId: campaign.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'campaign.challenge-assigned',
                    actorUserId: actor.id,
                    challengeId: challenge.id,
                    entityId: assignment.id,
                    entityType: 'CampaignChallenge',
                    metadata: {
                        challengeTitle: challenge.title,
                        pointValueOverride: null,
                        sortOrder: nextSortOrder,
                    },
                    campaignId: campaign.id,
                },
            })
        })

        revalidatePath('/admin/challenges')
        finishAction({
            outcome: 'challenge-created',
            selectedCampaignId: campaign.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }
}

export async function updateCampaignChallengeAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const campaignId = getStringField(formData, 'campaignId')
    const challengeId = getStringField(formData, 'challengeId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    if (!challengeId) {
        finishAction({
            detail: 'missing-challenge',
            outcome: 'error',
            selectedCampaignId: campaignId,
        })
    }

    const campaign = await loadEditableCampaign(campaignId)
    const challenge = await prisma.challenge.findFirst({
        select: {
            id: true,
        },
        where: {
            campaignChallenges: {
                some: {
                    campaignId: campaign.id,
                },
            },
            id: challengeId,
        },
    })

    if (!challenge) {
        finishAction({
            detail: 'challenge-not-found',
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }

    try {
        const formValues = parseChallengeFormValues(formData)
        const values = prepareChallengeUpdateValues(formValues)

        await prisma.$transaction(async (transaction) => {
            await transaction.challenge.update({
                data: values,
                where: {
                    id: challenge.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action: 'challenge.updated',
                    actorUserId: actor.id,
                    challengeId: challenge.id,
                    entityId: challenge.id,
                    entityType: 'Challenge',
                    metadata: {},
                    campaignId: campaign.id,
                },
            })
        })

        revalidatePath('/admin/challenges')
        finishAction({
            outcome: 'challenge-updated',
            selectedCampaignId: campaign.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }
}

export async function deleteCampaignChallengeAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const campaignId = getStringField(formData, 'campaignId')
    const campaignChallengeId = getStringField(formData, 'campaignChallengeId')

    if (!campaignId) {
        finishAction({
            detail: 'missing-campaign',
            outcome: 'error',
        })
    }

    if (!campaignChallengeId) {
        finishAction({
            detail: 'missing-challenge',
            outcome: 'error',
            selectedCampaignId: campaignId,
        })
    }

    const campaign = await loadEditableCampaign(campaignId)
    const assignment = await prisma.campaignChallenge.findFirst({
        select: {
            challenge: {
                select: {
                    _count: {
                        select: {
                            challengeCompletions: true,
                            campaignChallenges: true,
                        },
                    },
                    id: true,
                    title: true,
                },
            },
            id: true,
        },
        where: {
            campaignId: campaign.id,
            id: campaignChallengeId,
        },
    })

    if (!assignment) {
        finishAction({
            detail: 'challenge-not-found',
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }

    if (assignment.challenge._count.challengeCompletions > 0) {
        finishAction({
            detail: 'challenge-in-use',
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }

    const deleteEntireChallenge =
        assignment.challenge._count.campaignChallenges <= 1

    try {
        await prisma.$transaction(async (transaction) => {
            if (deleteEntireChallenge) {
                await transaction.challenge.delete({
                    where: {
                        id: assignment.challenge.id,
                    },
                })
            } else {
                await transaction.campaignChallenge.delete({
                    where: {
                        id: assignment.id,
                    },
                })
            }

            await transaction.auditLog.create({
                data: {
                    action: deleteEntireChallenge
                        ? 'challenge.deleted'
                        : 'campaign.challenge-removed',
                    actorUserId: actor.id,
                    challengeId: assignment.challenge.id,
                    entityId: assignment.id,
                    entityType: 'CampaignChallenge',
                    metadata: {
                        challengeTitle: assignment.challenge.title,
                        deletedChallenge: deleteEntireChallenge,
                    },
                    campaignId: campaign.id,
                },
            })
        })

        revalidatePath('/admin/challenges')
        finishAction({
            outcome: 'challenge-deleted',
            selectedCampaignId: campaign.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveCampaignErrorCode(error),
            outcome: 'error',
            selectedCampaignId: campaign.id,
        })
    }
}
