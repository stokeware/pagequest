import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
    assertSingleActiveQuest,
    buildQuestScoringPreviewItems,
    describeQuestLifecycle,
    getQuestStatusLabel,
    getQuestVisibilityLabel,
    QuestAdminError,
    parseQuestFormValues,
    prepareQuestArchiveValues,
    prepareQuestCreateValues,
    prepareQuestDuplicateValues,
    prepareQuestPublishValues,
    prepareQuestUpdateValues,
} from '@/lib/quest-admin'

function buildQuestFormData(overrides?: Record<string, string>) {
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

describe('quest admin helpers', () => {
    it('parses quest form values and normalizes optional fields', () => {
        const values = parseQuestFormValues(
            buildQuestFormData({
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
    })

    it('rejects an invalid quest window', () => {
        expect(() =>
            parseQuestFormValues(
                buildQuestFormData({
                    endAt: '2026-05-01T08:00',
                    startAt: '2026-05-30T20:00',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<QuestAdminError>>({
                code: 'invalid-quest-window',
            })
        )
    })

    it('rejects negative scoring rule values', () => {
        expect(() =>
            parseQuestFormValues(
                buildQuestFormData({
                    pointsPerPage: '-1',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<QuestAdminError>>({
                code: 'invalid-points-per-page',
            })
        )
    })

    it('prepares create and update values with derived statuses', () => {
        const formValues = parseQuestFormValues(buildQuestFormData())
        const createdValues = prepareQuestCreateValues(
            formValues,
            new Date('2026-04-01T12:00:00.000Z')
        )
        const updatedValues = prepareQuestUpdateValues({
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
        const publishedValues = prepareQuestPublishValues({
            now: new Date('2026-05-05T12:00:00.000Z'),
            quest: {
                archivedAt: null,
                endAt: new Date('2026-05-30T20:00:00.000Z'),
                publishedAt: null,
                startAt: new Date('2026-05-01T08:00:00.000Z'),
            },
        })
        const archivedValues = prepareQuestArchiveValues({
            now: new Date('2026-05-10T12:00:00.000Z'),
            quest: {
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

    it('prepares a duplicate quest as a draft copy', () => {
        const duplicatedValues = prepareQuestDuplicateValues(
            {
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
    })

    it('describes status and visibility for the configuration surface', () => {
        expect(getQuestStatusLabel('SCHEDULED')).toBe('Scheduled')
        expect(getQuestVisibilityLabel('INVITE_ONLY')).toBe('Invite only')
        expect(
            describeQuestLifecycle({
                archivedAt: null,
                endAt: new Date('2026-05-30T20:00:00.000Z'),
                publishedAt: new Date('2026-04-20T09:00:00.000Z'),
                startAt: new Date('2026-05-01T08:00:00.000Z'),
                status: 'SCHEDULED',
            })
        ).toContain(
            'Published quests stay scheduled until the start window opens'
        )
    })

    it('builds scoring preview items for all quest entry types', () => {
        const previewItems = buildQuestScoringPreviewItems(
            parseQuestFormValues(buildQuestFormData())
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

    it('blocks a second quest from becoming active', () => {
        expect(() =>
            assertSingleActiveQuest({
                activeQuest: {
                    id: 'quest-1',
                    name: 'Spring Story Sprint',
                },
                nextStatus: 'ACTIVE',
                questId: 'quest-2',
            })
        ).toThrowError(
            expect.objectContaining<Partial<QuestAdminError>>({
                code: 'active-quest-conflict',
            })
        )

        expect(() =>
            assertSingleActiveQuest({
                activeQuest: {
                    id: 'quest-1',
                    name: 'Spring Story Sprint',
                },
                nextStatus: 'ACTIVE',
                questId: 'quest-1',
            })
        ).not.toThrow()
    })
})
