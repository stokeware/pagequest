import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PrismaClient, Prisma } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const localDatabaseUrl =
    'postgresql://pagequest:pagequest@127.0.0.1:5433/pagequest?schema=public'

const legacySslModeAliases = new Set(['prefer', 'require', 'verify-ca'])

function normalizeConnectionString(connectionString) {
    try {
        const url = new URL(connectionString)

        if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
            return connectionString
        }

        if (url.searchParams.get('uselibpqcompat') === 'true') {
            return connectionString
        }

        const sslMode = url.searchParams.get('sslmode')

        if (!sslMode || !legacySslModeAliases.has(sslMode)) {
            return connectionString
        }

        url.searchParams.set('sslmode', 'verify-full')

        return url.toString()
    } catch {
        return connectionString
    }
}

const adapter = new PrismaPg(
    normalizeConnectionString(process.env.DATABASE_URL ?? localDatabaseUrl)
)
const prisma = new PrismaClient({ adapter })

const campaignScoring = {
    pointsPerBook: new Prisma.Decimal(25),
    pointsPerPage: new Prisma.Decimal(1),
    pointsPerAudiobookMinute: new Prisma.Decimal('0.75'),
    pointsPerChallengeCompletion: new Prisma.Decimal(40),
}

const adminUser = {
    email: 'admin@pagequest.local',
    name: 'Morgan Questmaster',
    timezone: 'America/Chicago',
}

const competitorUsers = [
    {
        email: 'alice@pagequest.local',
        name: 'Alice Redwood',
        timezone: 'America/Chicago',
    },
    {
        email: 'ben@pagequest.local',
        name: 'Ben Sparrow',
        timezone: 'America/New_York',
    },
    {
        email: 'clara@pagequest.local',
        name: 'Clara Winters',
        timezone: 'America/Los_Angeles',
    },
]

const pendingInviteUser = {
    email: 'future-reader@pagequest.local',
    name: 'Future Reader',
    timezone: 'America/Chicago',
}

const campaignWindow = {
    startAt: new Date('2026-05-01T05:00:00.000Z'),
    endAt: new Date('2026-06-01T04:59:59.000Z'),
}

const challengeDefinitions = [
    {
        key: 'biography',
        title: 'Read a Biography',
        pointValue: new Prisma.Decimal(40),
        sortOrder: 1,
    },
    {
        key: 'recommended',
        title: 'Friend Recommendation',
        pointValue: new Prisma.Decimal(50),
        sortOrder: 2,
    },
]

const participantSeed = {
    'alice@pagequest.local': {
        invitationStatus: 'ACCEPTED',
        invitationSentAt: new Date('2026-04-22T15:00:00.000Z'),
        invitationAcceptedAt: new Date('2026-04-23T13:00:00.000Z'),
        joinedAt: new Date('2026-04-23T13:05:00.000Z'),
        entries: [
            {
                type: 'BOOK_COMPLETION',
                value: 1,
                activityDate: new Date('2026-05-03T19:30:00.000Z'),
                bookTitle: 'The Golden Compass',
                bookAuthor: 'Philip Pullman',
                notes: 'Finished during a rainy weekend sprint.',
            },
            {
                type: 'PAGES_READ',
                value: 120,
                activityDate: new Date('2026-05-05T02:15:00.000Z'),
                bookTitle: 'A Wrinkle in Time',
                bookAuthor: "Madeleine L'Engle",
                notes: 'Late-night reading session.',
            },
            {
                type: 'AUDIOBOOK_MINUTES',
                value: 90,
                activityDate: new Date('2026-05-08T11:00:00.000Z'),
                bookTitle: 'The Hobbit',
                bookAuthor: 'J.R.R. Tolkien',
                notes: 'Listened during a road trip.',
            },
            {
                type: 'CHALLENGE_COMPLETION',
                value: 1,
                activityDate: new Date('2026-05-09T16:45:00.000Z'),
                notes: 'Completed the biography challenge with a memoir pick.',
                challengeKey: 'biography',
                challengeReviewState: 'AUTO_APPROVED',
                awardedPoints: new Prisma.Decimal(40),
                evidenceText: 'Finished a memoir by Tara Westover.',
            },
        ],
    },
    'ben@pagequest.local': {
        invitationStatus: 'ACCEPTED',
        invitationSentAt: new Date('2026-04-22T15:10:00.000Z'),
        invitationAcceptedAt: new Date('2026-04-24T00:20:00.000Z'),
        joinedAt: new Date('2026-04-24T00:30:00.000Z'),
        entries: [
            {
                type: 'PAGES_READ',
                value: 210,
                activityDate: new Date('2026-05-04T01:00:00.000Z'),
                bookTitle: 'The Lightning Thief',
                bookAuthor: 'Rick Riordan',
                notes: 'Powered through a big chunk in one day.',
            },
            {
                type: 'AUDIOBOOK_MINUTES',
                value: 45,
                activityDate: new Date('2026-05-06T12:30:00.000Z'),
                bookTitle: 'Treasure Island',
                bookAuthor: 'Robert Louis Stevenson',
                notes: 'Morning walk audiobook minutes.',
            },
            {
                type: 'CHALLENGE_COMPLETION',
                value: 1,
                activityDate: new Date('2026-05-07T22:15:00.000Z'),
                notes: 'Took a recommendation from Clara.',
                challengeKey: 'recommended',
                challengeReviewState: 'APPROVED',
                awardedPoints: new Prisma.Decimal(50),
                evidenceText:
                    'Read a recommendation from Clara after book club.',
                reviewNotes: 'Verified by admin against recommendation list.',
            },
        ],
    },
    'clara@pagequest.local': {
        invitationStatus: 'ACCEPTED',
        invitationSentAt: new Date('2026-04-22T15:20:00.000Z'),
        invitationAcceptedAt: new Date('2026-04-22T17:45:00.000Z'),
        joinedAt: new Date('2026-04-22T17:50:00.000Z'),
        entries: [
            {
                type: 'BOOK_COMPLETION',
                value: 1,
                activityDate: new Date('2026-05-02T21:00:00.000Z'),
                bookTitle: 'Anne of Green Gables',
                bookAuthor: 'L. M. Montgomery',
                notes: 'First finished book of the season.',
            },
            {
                type: 'PAGES_READ',
                value: 80,
                activityDate: new Date('2026-05-10T04:15:00.000Z'),
                bookTitle: 'Inkheart',
                bookAuthor: 'Cornelia Funke',
                notes: 'Read before bed all week.',
            },
        ],
    },
}

function calculateParticipantTotals(entries) {
    const totals = {
        totalBooks: 0,
        totalPages: 0,
        totalAudiobookMinutes: 0,
        totalChallenges: 0,
        totalPoints: new Prisma.Decimal(0),
        lastActivityAt: null,
    }

    for (const entry of entries) {
        if (
            !totals.lastActivityAt ||
            entry.activityDate > totals.lastActivityAt
        ) {
            totals.lastActivityAt = entry.activityDate
        }

        if (entry.type === 'BOOK_COMPLETION') {
            totals.totalBooks += entry.value
            totals.totalPoints = totals.totalPoints.plus(
                campaignScoring.pointsPerBook.mul(entry.value)
            )
        }

        if (entry.type === 'PAGES_READ') {
            totals.totalPages += entry.value
            totals.totalPoints = totals.totalPoints.plus(
                campaignScoring.pointsPerPage.mul(entry.value)
            )
        }

        if (entry.type === 'AUDIOBOOK_MINUTES') {
            totals.totalAudiobookMinutes += entry.value
            totals.totalPoints = totals.totalPoints.plus(
                campaignScoring.pointsPerAudiobookMinute.mul(entry.value)
            )
        }

        if (entry.type === 'CHALLENGE_COMPLETION') {
            totals.totalChallenges += entry.value
            totals.totalPoints = totals.totalPoints.plus(
                entry.awardedPoints ??
                    campaignScoring.pointsPerChallengeCompletion.mul(
                        entry.value
                    )
            )
        }
    }

    return totals
}

async function resetDatabase() {
    await prisma.auditLog.deleteMany()
    await prisma.notificationDelivery.deleteMany()
    await prisma.challengeCompletion.deleteMany()
    await prisma.readingEntry.deleteMany()
    await prisma.invitation.deleteMany()
    await prisma.participantChallengeSource.deleteMany()
    await prisma.campaignParticipant.deleteMany()
    await prisma.challenge.deleteMany()
    await prisma.roleAssignment.deleteMany()
    await prisma.campaign.deleteMany()
    await prisma.user.deleteMany()
}

async function seed() {
    await resetDatabase()

    const admin = await prisma.user.create({
        data: {
            ...adminUser,
            emailVerified: new Date('2026-04-20T12:00:00.000Z'),
            lastSignedInAt: new Date('2026-05-08T13:30:00.000Z'),
            roleAssignments: {
                create: [{ role: 'ADMIN' }],
            },
        },
    })

    const competitors = []

    for (const competitorUser of competitorUsers) {
        const competitor = await prisma.user.create({
            data: {
                ...competitorUser,
                emailVerified: new Date('2026-04-21T15:00:00.000Z'),
                lastSignedInAt: new Date('2026-05-08T12:00:00.000Z'),
                roleAssignments: {
                    create: [{ role: 'COMPETITOR' }],
                },
            },
        })

        competitors.push(competitor)
    }

    const pendingCompetitor = await prisma.user.create({
        data: {
            ...pendingInviteUser,
            emailVerified: new Date('2026-05-08T14:05:00.000Z'),
            roleAssignments: {
                create: [{ role: 'COMPETITOR' }],
            },
        },
    })

    const campaign = await prisma.campaign.create({
        data: {
            name: 'Spring Story Sprint 2026',
            description:
                'A month-long family reading campaign with books, pages, audiobook minutes, and bonus challenges.',
            timezone: 'America/Chicago',
            startAt: campaignWindow.startAt,
            endAt: campaignWindow.endAt,
            status: 'ACTIVE',
            visibility: 'INVITE_ONLY',
            pointsPerBook: campaignScoring.pointsPerBook,
            pointsPerPage: campaignScoring.pointsPerPage,
            pointsPerAudiobookMinute: campaignScoring.pointsPerAudiobookMinute,
            pointsPerChallengeCompletion:
                campaignScoring.pointsPerChallengeCompletion,
            challengeCategoryBonuses: {
                community: 1.25,
            },
            entryEditWindowMinutes: 180,
            entryDeleteWindowMinutes: 60,
            publishedAt: new Date('2026-04-22T14:30:00.000Z'),
            createdByUserId: admin.id,
        },
    })

    const challengesByKey = {}

    await prisma.challenge.createMany({
        data: [
            {
                campaignId: campaign.id,
                createdByUserId: admin.id,
                kind: 'RECOMMENDATION_TEMPLATE',
                pageMinuteMultiplier: new Prisma.Decimal(0),
                pointValue: new Prisma.Decimal(0),
                title: 'Recommendation',
            },
            {
                campaignId: campaign.id,
                createdByUserId: admin.id,
                kind: 'PERSONAL_GOAL_TEMPLATE',
                pageMinuteMultiplier: new Prisma.Decimal(0),
                pointValue: new Prisma.Decimal(0),
                title: 'Personal Goal',
            },
        ],
    })

    for (const definition of challengeDefinitions) {
        const challenge = await prisma.challenge.create({
            data: {
                campaignId: campaign.id,
                createdByUserId: admin.id,
                kind: 'ADMIN',
                pageMinuteMultiplier: new Prisma.Decimal(0),
                title: definition.title,
                pointValue: definition.pointValue,
            },
        })

        challengesByKey[definition.key] = {
            challenge,
        }
    }

    for (const competitor of competitors) {
        const config = participantSeed[competitor.email]
        const totals = calculateParticipantTotals(config.entries)

        const participant = await prisma.campaignParticipant.create({
            data: {
                campaignId: campaign.id,
                userId: competitor.id,
                joinedAt: config.joinedAt,
                totalBooks: totals.totalBooks,
                totalPages: totals.totalPages,
                totalAudiobookMinutes: totals.totalAudiobookMinutes,
                totalChallenges: totals.totalChallenges,
                totalPoints: totals.totalPoints,
                lastActivityAt: totals.lastActivityAt,
            },
        })

        const invitation = await prisma.invitation.create({
            data: {
                campaignId: campaign.id,
                email: competitor.email,
                status: config.invitationStatus,
                tokenHash: `seed-token-${competitor.email}`,
                expiresAt: new Date('2026-05-15T05:00:00.000Z'),
                lastSentAt: config.invitationSentAt,
                acceptedAt: config.invitationAcceptedAt,
                invitedByUserId: admin.id,
                acceptedByUserId: competitor.id,
                acceptedParticipantId: participant.id,
            },
        })

        await prisma.auditLog.create({
            data: {
                actorUserId: admin.id,
                campaignId: campaign.id,
                invitationId: invitation.id,
                entityType: 'Invitation',
                entityId: invitation.id,
                action: 'seed.invited',
                metadata: {
                    email: competitor.email,
                    status: config.invitationStatus,
                },
            },
        })

        for (const entryConfig of config.entries) {
            const readingEntry = await prisma.readingEntry.create({
                data: {
                    campaignParticipantId: participant.id,
                    type: entryConfig.type,
                    value: entryConfig.value,
                    activityDate: entryConfig.activityDate,
                    bookTitle: entryConfig.bookTitle,
                    bookAuthor: entryConfig.bookAuthor,
                    notes: entryConfig.notes,
                    createdByUserId: competitor.id,
                    updatedByUserId: competitor.id,
                },
            })

            if (entryConfig.type === 'CHALLENGE_COMPLETION') {
                const challengeRef = challengesByKey[entryConfig.challengeKey]

                await prisma.challengeCompletion.create({
                    data: {
                        readingEntryId: readingEntry.id,
                        campaignParticipantId: participant.id,
                        challengeId: challengeRef.challenge.id,
                        reviewState: entryConfig.challengeReviewState,
                        evidenceText: entryConfig.evidenceText,
                        reviewNotes: entryConfig.reviewNotes,
                        awardedPoints: entryConfig.awardedPoints,
                        reviewedAt:
                            entryConfig.challengeReviewState === 'APPROVED' ||
                            entryConfig.challengeReviewState === 'AUTO_APPROVED'
                                ? entryConfig.activityDate
                                : null,
                        reviewedByUserId:
                            entryConfig.challengeReviewState === 'APPROVED'
                                ? admin.id
                                : null,
                    },
                })
            }
        }
    }

    await prisma.invitation.create({
        data: {
            campaignId: campaign.id,
            email: pendingCompetitor.email,
            status: 'PENDING',
            tokenHash: `seed-token-${pendingCompetitor.email}`,
            expiresAt: new Date('2026-05-15T05:00:00.000Z'),
            lastSentAt: new Date('2026-05-08T14:00:00.000Z'),
            invitedByUserId: admin.id,
        },
    })

    console.log(
        'Seeded Page Quest demo data: 1 admin, 1 active campaign, 3 joined competitors, and 1 pending invite user.'
    )
}

seed()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
