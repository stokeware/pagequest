'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminActionUser } from '@/lib/auth/session'
import {
    assertChallengeCanDelete,
    ChallengeAdminError,
    parseChallengeFormValues,
    prepareChallengeCreateValues,
    prepareChallengeUpdateValues,
} from '@/lib/challenge-admin'
import {
    ChallengeReviewError,
    parseChallengeReviewFormValues,
    prepareChallengeReviewDecisionValues,
    resolveChallengeCompletionDefaultPoints,
} from '@/lib/challenge-review'
import { prisma } from '@/lib/prisma'

const adminChallengesPath = '/admin/challenges'

function buildRedirectUrl({
    detail,
    outcome,
    selectedChallengeId,
    selectedCompletionId,
}: {
    detail?: string
    outcome: string
    selectedChallengeId?: string
    selectedCompletionId?: string
}) {
    const params = new URLSearchParams({
        outcome,
    })

    if (detail) {
        params.set('detail', detail)
    }

    if (selectedChallengeId) {
        params.set('selectedChallengeId', selectedChallengeId)
    }

    if (selectedCompletionId) {
        params.set('selectedCompletionId', selectedCompletionId)
    }

    return `${adminChallengesPath}?${params.toString()}`
}

function finishAction({
    detail,
    outcome,
    selectedChallengeId,
    selectedCompletionId,
}: {
    detail?: string
    outcome: string
    selectedChallengeId?: string
    selectedCompletionId?: string
}): never {
    revalidatePath(adminChallengesPath)
    redirect(
        buildRedirectUrl({
            detail,
            outcome,
            selectedChallengeId,
            selectedCompletionId,
        })
    )
}

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

async function loadChallenge(challengeId: string) {
    return prisma.challenge.findUnique({
        select: {
            _count: {
                select: {
                    challengeCompletions: true,
                    campaignChallenges: true,
                },
            },
            availability: true,
            category: true,
            description: true,
            evidencePrompt: true,
            id: true,
            pointValue: true,
            requiresReview: true,
            title: true,
        },
        where: {
            id: challengeId,
        },
    })
}

function resolveChallengeErrorCode(error: unknown) {
    if (error instanceof ChallengeReviewError) {
        return error.code
    }

    if (error instanceof ChallengeAdminError) {
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

export async function createChallengeAction(formData: FormData) {
    const actor = await requireAdminActionUser()

    try {
        const formValues = parseChallengeFormValues(formData)
        const values = prepareChallengeCreateValues(formValues)

        const createdChallenge = await prisma.$transaction(
            async (transaction) => {
                const challenge = await transaction.challenge.create({
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
                        action: 'challenge.created',
                        actorUserId: actor.id,
                        challengeId: challenge.id,
                        entityId: challenge.id,
                        entityType: 'Challenge',
                        metadata: {
                            availability: values.availability,
                            requiresReview: values.requiresReview,
                        },
                    },
                })

                return challenge
            }
        )

        finishAction({
            outcome: 'created',
            selectedChallengeId: createdChallenge.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveChallengeErrorCode(error),
            outcome: 'error',
        })
    }
}

export async function updateChallengeAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const challengeId = getStringField(formData, 'challengeId')

    if (!challengeId) {
        finishAction({
            detail: 'missing-challenge',
            outcome: 'error',
        })
    }

    const challenge = await loadChallenge(challengeId)

    if (!challenge) {
        finishAction({
            detail: 'challenge-not-found',
            outcome: 'error',
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
                    metadata: {
                        availability: values.availability,
                        requiresReview: values.requiresReview,
                    },
                },
            })
        })

        finishAction({
            outcome: 'updated',
            selectedChallengeId: challenge.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveChallengeErrorCode(error),
            outcome: 'error',
            selectedChallengeId: challenge.id,
        })
    }
}

export async function deleteChallengeAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const challengeId = getStringField(formData, 'challengeId')

    if (!challengeId) {
        finishAction({
            detail: 'missing-challenge',
            outcome: 'error',
        })
    }

    const challenge = await loadChallenge(challengeId)

    if (!challenge) {
        finishAction({
            detail: 'challenge-not-found',
            outcome: 'error',
        })
    }

    try {
        assertChallengeCanDelete({
            challengeCompletions: challenge._count.challengeCompletions,
            campaignChallenges: challenge._count.campaignChallenges,
        })

        await prisma.$transaction(async (transaction) => {
            await transaction.auditLog.create({
                data: {
                    action: 'challenge.deleted',
                    actorUserId: actor.id,
                    challengeId: challenge.id,
                    entityId: challenge.id,
                    entityType: 'Challenge',
                    metadata: {
                        title: challenge.title,
                    },
                },
            })

            await transaction.challenge.delete({
                where: {
                    id: challenge.id,
                },
            })
        })

        finishAction({
            outcome: 'deleted',
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveChallengeErrorCode(error),
            outcome: 'error',
            selectedChallengeId: challenge.id,
        })
    }
}

export async function reviewChallengeCompletionAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const selectedChallengeId = getStringField(formData, 'selectedChallengeId')

    try {
        const reviewValues = parseChallengeReviewFormValues(formData)
        const completion = await prisma.challengeCompletion.findUnique({
            select: {
                challenge: {
                    select: {
                        id: true,
                        pointValue: true,
                        title: true,
                    },
                },
                id: true,
                campaignChallenge: {
                    select: {
                        pointValueOverride: true,
                    },
                },
                campaignParticipant: {
                    select: {
                        id: true,
                        campaign: {
                            select: {
                                id: true,
                                pointsPerChallengeCompletion: true,
                            },
                        },
                    },
                },
                reviewState: true,
            },
            where: {
                id: reviewValues.challengeCompletionId,
            },
        })

        if (!completion) {
            throw new ChallengeReviewError(
                'challenge-completion-not-found',
                'That challenge completion record is no longer available.'
            )
        }

        if (completion.reviewState !== 'PENDING') {
            throw new ChallengeReviewError(
                'challenge-review-resolved',
                'That challenge completion is no longer pending review.'
            )
        }

        const defaultAwardedPoints = resolveChallengeCompletionDefaultPoints({
            challengePointValue: completion.challenge.pointValue,
            campaignChallengePointValueOverride:
                completion.campaignChallenge?.pointValueOverride ?? null,
            campaignPointsPerChallengeCompletion:
                completion.campaignParticipant.campaign
                    .pointsPerChallengeCompletion,
        })
        const decisionValues = prepareChallengeReviewDecisionValues({
            decision: reviewValues.decision,
            defaultAwardedPoints,
            now: new Date(),
            awardedPointsOverride: reviewValues.awardedPointsOverride,
            reviewerUserId: actor.id,
            reviewNotes: reviewValues.reviewNotes,
        })

        await prisma.$transaction(async (transaction) => {
            await transaction.challengeCompletion.update({
                data: decisionValues,
                where: {
                    id: completion.id,
                },
            })

            await transaction.auditLog.create({
                data: {
                    action:
                        decisionValues.reviewState === 'APPROVED'
                            ? 'challenge-completion.approved'
                            : 'challenge-completion.rejected',
                    actorUserId: actor.id,
                    challengeCompletionId: completion.id,
                    challengeId: completion.challenge.id,
                    entityId: completion.id,
                    entityType: 'ChallengeCompletion',
                    metadata: {
                        awardedPoints: decisionValues.awardedPoints.toString(),
                        reviewNotes: decisionValues.reviewNotes,
                        reviewState: decisionValues.reviewState,
                    },
                    campaignId: completion.campaignParticipant.campaign.id,
                    campaignParticipantId: completion.campaignParticipant.id,
                },
            })
        })

        finishAction({
            outcome:
                decisionValues.reviewState === 'APPROVED'
                    ? 'review-approved'
                    : 'review-rejected',
            selectedChallengeId: selectedChallengeId || completion.challenge.id,
        })
    } catch (error) {
        if (isRedirectSignal(error)) {
            throw error
        }

        finishAction({
            detail: resolveChallengeErrorCode(error),
            outcome: 'error',
            selectedChallengeId: selectedChallengeId || undefined,
            selectedCompletionId: getStringField(
                formData,
                'challengeCompletionId'
            ),
        })
    }
}
