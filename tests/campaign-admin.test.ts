import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
    assertSingleActiveQuest,
    assertCampaignChallengeNotAssigned,
    buildCampaignScoringPreviewItems,
    describeCampaignLifecycle,
    getCampaignStatusLabel,
    getCampaignVisibilityLabel,
    parseCampaignChallengeAssignmentFormValues,
    prepareCampaignChallengeAssignmentValues,
    CampaignAdminError,
    parseCampaignFormValues,
    prepareCampaignArchiveValues,
    prepareCampaignCreateValues,
    prepareCampaignDuplicateValues,
    prepareCampaignPublishValues,
    prepareCampaignUpdateValues,
    resolveEpicReadPageMultiplier,
} from '@/lib/campaign-admin'

function buildCampaignFormData(overrides?: Record<string, string>) {
    const formData = new FormData()
    const fields = {
        description: 'A playful spring reading sprint.',
        endAt: '2026-05-30T20:00',
        entryDeleteWindowMinutes: '60',
        entryEditWindowMinutes: '120',
        name: 'Spring Story Sprint',
        pointsPerAudiobookMinute: '0.75',
        pointsPerBook: '12',
        pointsPerChallengeCompletion: '20',
        pointsPerPage: '1.5',
        epicReadPageMultiplier: '',
        startAt: '2026-05-01T08:00',
        timezone: 'America/Chicago',
        visibility: 'INVITE_ONLY',
        ...overrides,
    }

    Object.entries(fields).forEach(([key, value]) => {
        formData.set(key, value)
    })

    return formData
}

function buildCampaignChallengeAssignmentFormData(
    overrides?: Record<string, string>
) {
    const formData = new FormData()
    const fields = {
        challengeId: 'challenge-1',
        pointValueOverride: '15',
        sortOrder: '3',
        ...overrides,
    }

    Object.entries(fields).forEach(([key, value]) => {
        formData.set(key, value)
    })

    return formData
}

describe('campaign admin helpers', () => {
    it('parses campaign form values and normalizes optional fields', () => {
        const values = parseCampaignFormValues(
            buildCampaignFormData({
                description: '   ',
                name: '  Spring Story Sprint  ',
            })
        )

        expect(values.name).toBe('Spring Story Sprint')
        expect(values.description).toBeNull()
        expect(values.timezone).toBe('America/Chicago')
        expect(values.pointsPerBook.toString()).toBe('12')
        expect(values.pointsPerPage.toString()).toBe('1.5')
        expect(values.entryEditWindowMinutes).toBe(120)
        expect(values.entryDeleteWindowMinutes).toBe(60)
        expect(values.challengeCategoryBonuses).toBe(Prisma.DbNull)
    })

    it('normalizes date-only values to noon utc and stores epic read bonus', () => {
        const values = parseCampaignFormValues(
            buildCampaignFormData({
                endAt: '2026-05-30',
                epicReadPageMultiplier: '2.5',
                startAt: '2026-05-01',
            })
        )

        expect(values.startAt.toISOString()).toBe('2026-05-01T12:00:00.000Z')
        expect(values.endAt.toISOString()).toBe('2026-05-30T12:00:00.000Z')
        expect(values.challengeCategoryBonuses).toEqual({
            epicReadPageMultiplier: '2.5',
        })
        expect(
            resolveEpicReadPageMultiplier(
                values.challengeCategoryBonuses as Prisma.JsonObject
            )?.toString()
        ).toBe('2.5')
    })

    it('rejects an invalid campaign window', () => {
        expect(() =>
            parseCampaignFormValues(
                buildCampaignFormData({
                    endAt: '2026-05-01T08:00',
                    startAt: '2026-05-30T20:00',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<CampaignAdminError>>({
                code: 'invalid-campaign-window',
            })
        )
    })

    it('rejects negative scoring rule values', () => {
        expect(() =>
            parseCampaignFormValues(
                buildCampaignFormData({
                    pointsPerPage: '-1',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<CampaignAdminError>>({
                code: 'invalid-points-per-page',
            })
        )
    })

    it('prepares create and update values with derived statuses', () => {
        const formValues = parseCampaignFormValues(buildCampaignFormData())
        const createdValues = prepareCampaignCreateValues(
            formValues,
            new Date('2026-04-01T12:00:00.000Z')
        )
        const updatedValues = prepareCampaignUpdateValues({
            archivedAt: null,
            formValues,
            now: new Date('2026-04-25T12:00:00.000Z'),
            publishedAt: new Date('2026-04-20T09:00:00.000Z'),
        })

        expect(createdValues.status).toBe('DRAFT')
        expect(createdValues.publishedAt).toBeNull()
        expect(updatedValues.status).toBe('SCHEDULED')
        expect(updatedValues.publishedAt?.toISOString()).toBe(
            '2026-04-20T09:00:00.000Z'
        )
    })

    it('prepares publish and archive values from lifecycle state', () => {
        const publishedValues = prepareCampaignPublishValues({
            now: new Date('2026-05-05T12:00:00.000Z'),
            campaign: {
                archivedAt: null,
                endAt: new Date('2026-05-30T20:00:00.000Z'),
                publishedAt: null,
                startAt: new Date('2026-05-01T08:00:00.000Z'),
            },
        })
        const archivedValues = prepareCampaignArchiveValues({
            now: new Date('2026-05-10T12:00:00.000Z'),
            campaign: {
                archivedAt: null,
                endAt: new Date('2026-05-30T20:00:00.000Z'),
                publishedAt: new Date('2026-04-20T09:00:00.000Z'),
                startAt: new Date('2026-05-01T08:00:00.000Z'),
            },
        })

        expect(publishedValues.status).toBe('ACTIVE')
        expect(publishedValues.publishedAt?.toISOString()).toBe(
            '2026-05-05T12:00:00.000Z'
        )
        expect(archivedValues.status).toBe('ARCHIVED')
        expect(archivedValues.archivedAt?.toISOString()).toBe(
            '2026-05-10T12:00:00.000Z'
        )
    })

    it('prepares a duplicate campaign as a draft copy', () => {
        const duplicatedValues = prepareCampaignDuplicateValues(
            {
                challengeCategoryBonuses: {
                    epicReadPageMultiplier: '3',
                },
                description: 'A playful sprint.',
                endAt: new Date('2026-05-30T20:00:00.000Z'),
                entryDeleteWindowMinutes: 60,
                entryEditWindowMinutes: 120,
                name: 'Spring Story Sprint',
                pointsPerAudiobookMinute: new Prisma.Decimal('0.75'),
                pointsPerBook: new Prisma.Decimal('12'),
                pointsPerChallengeCompletion: new Prisma.Decimal('20'),
                pointsPerPage: new Prisma.Decimal('1.5'),
                startAt: new Date('2026-05-01T08:00:00.000Z'),
                timezone: 'America/Chicago',
                visibility: 'INVITE_ONLY',
            },
            new Date('2026-04-01T12:00:00.000Z')
        )

        expect(duplicatedValues.name).toBe('Spring Story Sprint Copy')
        expect(duplicatedValues.status).toBe('DRAFT')
        expect(duplicatedValues.publishedAt).toBeNull()
        expect(duplicatedValues.archivedAt).toBeNull()
        expect(duplicatedValues.pointsPerChallengeCompletion.toString()).toBe(
            '20'
        )
        expect(duplicatedValues.challengeCategoryBonuses).toEqual({
            epicReadPageMultiplier: '3',
        })
    })

    it('describes status and visibility for the configuration surface', () => {
        expect(getCampaignStatusLabel('SCHEDULED')).toBe('Scheduled')
        expect(getCampaignVisibilityLabel('INVITE_ONLY')).toBe('Invite only')
        expect(
            describeCampaignLifecycle({
                archivedAt: null,
                endAt: new Date('2026-05-30T20:00:00.000Z'),
                publishedAt: new Date('2026-04-20T09:00:00.000Z'),
                startAt: new Date('2026-05-01T08:00:00.000Z'),
                status: 'SCHEDULED',
            })
        ).toContain(
            'Published campaigns stay scheduled until the start window opens'
        )
    })

    it('builds scoring preview items for all campaign entry types', () => {
        const previewItems = buildCampaignScoringPreviewItems(
            parseCampaignFormValues(buildCampaignFormData())
        )

        expect(previewItems).toHaveLength(4)
        expect(previewItems[0]).toMatchObject({
            description: 'One completed book',
            title: 'Books',
        })
        expect(previewItems[1]?.points.toString()).toBe('150')
        expect(previewItems[2]?.points.toString()).toBe('45')
        expect(previewItems[3]).toMatchObject({
            description: 'One challenge completion',
            title: 'Challenges',
        })
    })

    it('blocks a second campaign from becoming active', () => {
        expect(() =>
            assertSingleActiveQuest({
                activeQuest: {
                    id: 'campaign-1',
                    name: 'Spring Story Sprint',
                },
                nextStatus: 'ACTIVE',
                campaignId: 'campaign-2',
            })
        ).toThrowError(
            expect.objectContaining<Partial<CampaignAdminError>>({
                code: 'active-campaign-conflict',
            })
        )

        expect(() =>
            assertSingleActiveQuest({
                activeQuest: {
                    id: 'campaign-1',
                    name: 'Spring Story Sprint',
                },
                nextStatus: 'ACTIVE',
                campaignId: 'campaign-1',
            })
        ).not.toThrow()
    })

    it('parses campaign challenge assignment values and allows blank overrides', () => {
        const values = parseCampaignChallengeAssignmentFormValues(
            buildCampaignChallengeAssignmentFormData({
                pointValueOverride: '',
                sortOrder: '5',
            })
        )

        expect(values).toEqual({
            challengeId: 'challenge-1',
            pointValueOverride: null,
            sortOrder: 5,
        })
        expect(prepareCampaignChallengeAssignmentValues(values)).toEqual({
            challengeId: 'challenge-1',
            isActive: true,
            pointValueOverride: null,
            sortOrder: 5,
        })
    })

    it('rejects invalid campaign challenge assignment fields', () => {
        expect(() =>
            parseCampaignChallengeAssignmentFormValues(
                buildCampaignChallengeAssignmentFormData({
                    sortOrder: '-1',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<CampaignAdminError>>({
                code: 'invalid-challenge-sort-order',
            })
        )

        expect(() =>
            parseCampaignChallengeAssignmentFormValues(
                buildCampaignChallengeAssignmentFormData({
                    pointValueOverride: '-2',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<CampaignAdminError>>({
                code: 'invalid-challenge-point-override',
            })
        )
    })

    it('blocks duplicate challenge assignments on the same campaign', () => {
        expect(() =>
            assertCampaignChallengeNotAssigned({
                challengeId: 'challenge-1',
                existingChallengeIds: ['challenge-1', 'challenge-2'],
            })
        ).toThrowError(
            expect.objectContaining<Partial<CampaignAdminError>>({
                code: 'duplicate-campaign-challenge',
            })
        )

        expect(() =>
            assertCampaignChallengeNotAssigned({
                challengeId: 'challenge-3',
                existingChallengeIds: ['challenge-1', 'challenge-2'],
            })
        ).not.toThrow()
    })
})
