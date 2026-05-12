import {
    Prisma,
    PrismaClient,
    type ChallengeKind,
    type ParticipantChallengeSourceKind,
} from '@prisma/client'

type PrismaChallengeClient = PrismaClient | Prisma.TransactionClient

type DecimalValue =
    | Prisma.Decimal
    | { toString(): string }
    | number
    | string
    | null
    | undefined

export const recommendationTemplateTitle = 'Recommendation'
export const personalGoalTemplateTitle = 'Personal Goal'

export function normalizeChallengeBookTitle(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildRecommendationChallengeTitle(
    participantLabel: string,
    bookTitle: string
) {
    const normalizedParticipantLabel = participantLabel.trim() || 'Reader'
    const normalizedBookTitle = bookTitle.trim()

    return `${normalizedParticipantLabel}'s Recommendation: ${normalizedBookTitle}`
}

export function buildPersonalGoalChallengeTitle(
    participantLabel: string,
    campaignParticipantId: string
) {
    const normalizedParticipantLabel = participantLabel.trim() || 'Reader'

    return `${normalizedParticipantLabel}'s Personal Goal (${campaignParticipantId})`
}

export function getParticipantChallengeLabel({
    email,
    name,
}: {
    email: string
    name: string | null
}) {
    const trimmedName = name?.trim()

    if (trimmedName) {
        return trimmedName
    }

    const localPart = email.split('@')[0]?.trim()

    return localPart && localPart.length > 0 ? localPart : 'Reader'
}

export function resolveChallengePointValue(challenge: {
    kind: ChallengeKind
    pointValue: DecimalValue
    templateChallenge?: {
        pointValue: DecimalValue
    } | null
}) {
    if (
        isTemplateBackedChallengeKind(challenge.kind) &&
        challenge.templateChallenge
    ) {
        return decimalToString(challenge.templateChallenge.pointValue)
    }

    return decimalToString(challenge.pointValue)
}

export function resolveChallengePageMinuteMultiplier(challenge: {
    kind: ChallengeKind
    pageMinuteMultiplier: DecimalValue
    templateChallenge?: {
        pageMinuteMultiplier: DecimalValue
    } | null
}) {
    if (
        isTemplateBackedChallengeKind(challenge.kind) &&
        challenge.templateChallenge
    ) {
        return decimalToString(challenge.templateChallenge.pageMinuteMultiplier)
    }

    return decimalToString(challenge.pageMinuteMultiplier)
}

export function formatChallengeTableValue(value: DecimalValue) {
    const numericValue = Number(decimalToString(value))

    if (!Number.isFinite(numericValue) || numericValue === 0) {
        return ''
    }

    return Number.isInteger(numericValue)
        ? numericValue.toString()
        : numericValue.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')
}

export function sortChallengesForCompetitorView<
    T extends {
        kind: ChallengeKind
        title: string
    },
>(challenges: T[]) {
    return [...challenges].sort((left, right) => {
        const leftRank = getCompetitorChallengeRank(left.kind)
        const rightRank = getCompetitorChallengeRank(right.kind)

        if (leftRank !== rightRank) {
            return leftRank - rightRank
        }

        return left.title.localeCompare(right.title, undefined, {
            sensitivity: 'base',
        })
    })
}

export function filterChallengesForCompetitorView<
    T extends {
        isActive: boolean
        kind: ChallengeKind
        ownerParticipantId: string | null
    },
>(challenges: T[], campaignParticipantId: string | null | undefined) {
    return challenges.filter((challenge) => {
        if (!challenge.isActive) {
            return false
        }

        if (!isPersonalGoalChallengeKind(challenge.kind)) {
            return true
        }

        return challenge.ownerParticipantId === (campaignParticipantId ?? null)
    })
}

export function isRecommendationChallengeKind(kind: ChallengeKind) {
    return kind === 'RECOMMENDATION_INSTANCE'
}

export function isPersonalGoalChallengeKind(kind: ChallengeKind) {
    return kind === 'PERSONAL_GOAL_INSTANCE'
}

export function isTemplateChallengeKind(kind: ChallengeKind) {
    return (
        kind === 'RECOMMENDATION_TEMPLATE' || kind === 'PERSONAL_GOAL_TEMPLATE'
    )
}

export async function ensureCampaignChallengeTemplates(
    prismaClient: PrismaChallengeClient,
    campaignId: string
) {
    const [recommendationTemplate, personalGoalTemplate] = await Promise.all([
        prismaClient.challenge.upsert({
            create: {
                campaignId,
                kind: 'RECOMMENDATION_TEMPLATE',
                pageMinuteMultiplier: new Prisma.Decimal(0),
                pointValue: new Prisma.Decimal(0),
                title: recommendationTemplateTitle,
            },
            update: {
                campaignId,
                isActive: true,
                kind: 'RECOMMENDATION_TEMPLATE',
            },
            where: {
                campaignId_title: {
                    campaignId,
                    title: recommendationTemplateTitle,
                },
            },
        }),
        prismaClient.challenge.upsert({
            create: {
                campaignId,
                kind: 'PERSONAL_GOAL_TEMPLATE',
                pageMinuteMultiplier: new Prisma.Decimal(0),
                pointValue: new Prisma.Decimal(0),
                title: personalGoalTemplateTitle,
            },
            update: {
                campaignId,
                isActive: true,
                kind: 'PERSONAL_GOAL_TEMPLATE',
            },
            where: {
                campaignId_title: {
                    campaignId,
                    title: personalGoalTemplateTitle,
                },
            },
        }),
    ])

    return {
        personalGoalTemplate,
        recommendationTemplate,
    }
}

export async function syncParticipantChallengeSources(
    prismaClient: PrismaChallengeClient,
    {
        campaignId,
        campaignParticipantId,
        participantLabel,
        personalGoalTitle,
        recommendationTitle,
    }: {
        campaignId: string
        campaignParticipantId: string
        participantLabel: string
        personalGoalTitle: string
        recommendationTitle: string
    }
) {
    const templates = await ensureCampaignChallengeTemplates(
        prismaClient,
        campaignId
    )
    const trimmedPersonalGoalTitle = personalGoalTitle.trim()
    const trimmedRecommendationTitle = recommendationTitle.trim()
    const normalizedPersonalGoalTitle = normalizeChallengeBookTitle(
        trimmedPersonalGoalTitle
    )
    const normalizedRecommendationTitle = normalizeChallengeBookTitle(
        trimmedRecommendationTitle
    )

    const personalGoalChallenge = await prismaClient.challenge.upsert({
        create: {
            campaignId,
            kind: 'PERSONAL_GOAL_INSTANCE',
            normalizedSourceBookTitle: normalizedPersonalGoalTitle || null,
            ownerParticipantId: campaignParticipantId,
            pageMinuteMultiplier: new Prisma.Decimal(0),
            pointValue: new Prisma.Decimal(0),
            sourceBookTitle: trimmedPersonalGoalTitle || null,
            templateChallengeId: templates.personalGoalTemplate.id,
            title: buildPersonalGoalChallengeTitle(
                participantLabel,
                campaignParticipantId
            ),
        },
        update: {
            campaignId,
            isActive: true,
            normalizedSourceBookTitle: normalizedPersonalGoalTitle || null,
            sourceBookTitle: trimmedPersonalGoalTitle || null,
            templateChallengeId: templates.personalGoalTemplate.id,
            title: buildPersonalGoalChallengeTitle(
                participantLabel,
                campaignParticipantId
            ),
        },
        where: {
            ownerParticipantId_kind: {
                kind: 'PERSONAL_GOAL_INSTANCE',
                ownerParticipantId: campaignParticipantId,
            },
        },
    })

    await prismaClient.participantChallengeSource.upsert({
        create: {
            bookTitle: trimmedPersonalGoalTitle,
            campaignParticipantId,
            generatedChallengeId: personalGoalChallenge.id,
            kind: 'PERSONAL_GOAL',
            normalizedBookTitle: normalizedPersonalGoalTitle,
        },
        update: {
            bookTitle: trimmedPersonalGoalTitle,
            generatedChallengeId: personalGoalChallenge.id,
            normalizedBookTitle: normalizedPersonalGoalTitle,
        },
        where: {
            campaignParticipantId_kind: {
                campaignParticipantId,
                kind: 'PERSONAL_GOAL',
            },
        },
    })

    const recommendationChallenge = await prismaClient.challenge.upsert({
        create: {
            campaignId,
            isActive: trimmedRecommendationTitle.length > 0,
            kind: 'RECOMMENDATION_INSTANCE',
            normalizedSourceBookTitle: normalizedRecommendationTitle || null,
            ownerParticipantId: campaignParticipantId,
            pageMinuteMultiplier: new Prisma.Decimal(0),
            pointValue: new Prisma.Decimal(0),
            sourceBookTitle: trimmedRecommendationTitle || null,
            templateChallengeId: templates.recommendationTemplate.id,
            title:
                trimmedRecommendationTitle.length > 0
                    ? buildRecommendationChallengeTitle(
                          participantLabel,
                          trimmedRecommendationTitle
                      )
                    : buildRecommendationChallengeTitle(
                          participantLabel,
                          'TBD'
                      ),
        },
        update: {
            campaignId,
            isActive: trimmedRecommendationTitle.length > 0,
            normalizedSourceBookTitle: normalizedRecommendationTitle || null,
            sourceBookTitle: trimmedRecommendationTitle || null,
            templateChallengeId: templates.recommendationTemplate.id,
            title:
                trimmedRecommendationTitle.length > 0
                    ? buildRecommendationChallengeTitle(
                          participantLabel,
                          trimmedRecommendationTitle
                      )
                    : buildRecommendationChallengeTitle(
                          participantLabel,
                          'TBD'
                      ),
        },
        where: {
            ownerParticipantId_kind: {
                kind: 'RECOMMENDATION_INSTANCE',
                ownerParticipantId: campaignParticipantId,
            },
        },
    })

    if (trimmedRecommendationTitle.length > 0) {
        await prismaClient.participantChallengeSource.upsert({
            create: {
                bookTitle: trimmedRecommendationTitle,
                campaignParticipantId,
                generatedChallengeId: recommendationChallenge.id,
                kind: 'RECOMMENDATION',
                normalizedBookTitle: normalizedRecommendationTitle,
            },
            update: {
                bookTitle: trimmedRecommendationTitle,
                generatedChallengeId: recommendationChallenge.id,
                normalizedBookTitle: normalizedRecommendationTitle,
            },
            where: {
                campaignParticipantId_kind: {
                    campaignParticipantId,
                    kind: 'RECOMMENDATION',
                },
            },
        })
    } else {
        await prismaClient.participantChallengeSource.deleteMany({
            where: {
                campaignParticipantId,
                kind: 'RECOMMENDATION',
            },
        })
    }

    return {
        personalGoalChallenge,
        recommendationChallenge,
        templates,
    }
}

function getCompetitorChallengeRank(kind: ChallengeKind) {
    switch (kind) {
        case 'PERSONAL_GOAL_INSTANCE':
            return 0
        case 'RECOMMENDATION_INSTANCE':
            return 1
        case 'ADMIN':
            return 2
        default:
            return 3
    }
}

function isTemplateBackedChallengeKind(kind: ChallengeKind) {
    return (
        kind === 'RECOMMENDATION_INSTANCE' || kind === 'PERSONAL_GOAL_INSTANCE'
    )
}

function decimalToString(value: DecimalValue) {
    if (value == null) {
        return '0'
    }

    return value.toString()
}

export const participantChallengeSourceKinds: Record<
    ParticipantChallengeSourceKind,
    ParticipantChallengeSourceKind
> = {
    PERSONAL_GOAL: 'PERSONAL_GOAL',
    RECOMMENDATION: 'RECOMMENDATION',
}
