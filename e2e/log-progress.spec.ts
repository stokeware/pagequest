import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { prisma } from '../lib/prisma'

const localAuthPassword = process.env.LOCAL_AUTH_PASSWORD ?? 'pagequest-local'

const competitorEmail = 'alice@pagequest.local'

test.describe('log progress mobile flow', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({
        viewport: {
            height: 844,
            width: 390,
        },
    })

    test('saves a mobile book completion entry and recalculates totals', async ({
        page,
    }) => {
        const notes = `phase7-book-${Date.now()}`
        const before = await loadParticipantState(competitorEmail)

        await signInToLogProgress(page)
        const entryForm = page.locator('form')

        await entryForm.locator('#value').fill('1')
        await entryForm.locator('#activityDate').fill('2026-05-08')
        await entryForm.locator('#bookTitle').fill('The Secret Garden')
        await entryForm.locator('#bookAuthor').fill('Frances Hodgson Burnett')
        await entryForm.locator('#notes').fill(notes)
        await entryForm.getByRole('button', { name: 'Save entry' }).click()

        await expect(page.getByText('Entry saved')).toBeVisible()
        await expect(
            page.getByText(/Book completion for 2026-05-08 saved/i)
        ).toBeVisible()

        const entry = await prisma.readingEntry.findFirst({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                activityDate: true,
                bookAuthor: true,
                bookTitle: true,
                id: true,
                notes: true,
                value: true,
            },
            where: {
                notes,
                campaignParticipantId: before.id,
                type: 'BOOK_COMPLETION',
            },
        })

        expect(entry).not.toBeNull()
        expect(entry?.value).toBe(1)
        expect(entry?.bookTitle).toBe('The Secret Garden')
        expect(entry?.bookAuthor).toBe('Frances Hodgson Burnett')
        expect(entry?.activityDate.toISOString()).toContain('2026-05-08')

        const after = await loadParticipantState(competitorEmail)
        expect(after.totalBooks).toBe(before.totalBooks + 1)
        expect(after.totalPages).toBe(before.totalPages)
        expect(after.totalAudiobookMinutes).toBe(before.totalAudiobookMinutes)
        expect(after.totalChallenges).toBe(before.totalChallenges)
        expectPointDelta(before.totalPoints, after.totalPoints, 25)

        const auditActions = await loadAuditActions(entry?.id ?? '')
        expect(auditActions).toEqual(['reading-entry.created'])
    })

    test('saves a mobile pages entry and recalculates totals', async ({
        page,
    }) => {
        const notes = `phase7-pages-${Date.now()}`
        const before = await loadParticipantState(competitorEmail)

        await signInToLogProgress(page)
        const entryForm = page.locator('form')

        await page.getByRole('tab', { name: 'Pages read' }).click()
        await entryForm.locator('#value').fill('37')
        await entryForm.locator('#activityDate').fill('2026-05-08')
        await entryForm.locator('#bookTitle').fill('The Giver')
        await entryForm.locator('#bookAuthor').fill('Lois Lowry')
        await entryForm.locator('#notes').fill(notes)
        await entryForm.getByRole('button', { name: 'Save entry' }).click()

        await expect(page.getByText('Entry saved')).toBeVisible()
        await expect(
            page.getByText(/Pages read for 2026-05-08 saved/i)
        ).toBeVisible()

        const entry = await prisma.readingEntry.findFirst({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                bookAuthor: true,
                bookTitle: true,
                id: true,
                notes: true,
                value: true,
            },
            where: {
                notes,
                campaignParticipantId: before.id,
                type: 'PAGES_READ',
            },
        })

        expect(entry).not.toBeNull()
        expect(entry?.value).toBe(37)
        expect(entry?.bookTitle).toBe('The Giver')
        expect(entry?.bookAuthor).toBe('Lois Lowry')

        const after = await loadParticipantState(competitorEmail)
        expect(after.totalBooks).toBe(before.totalBooks)
        expect(after.totalPages).toBe(before.totalPages + 37)
        expect(after.totalAudiobookMinutes).toBe(before.totalAudiobookMinutes)
        expect(after.totalChallenges).toBe(before.totalChallenges)
        expectPointDelta(before.totalPoints, after.totalPoints, 37)

        const auditActions = await loadAuditActions(entry?.id ?? '')
        expect(auditActions).toEqual(['reading-entry.created'])
    })

    test('saves a mobile audiobook entry and recalculates totals', async ({
        page,
    }) => {
        const notes = `phase7-audio-${Date.now()}`
        const before = await loadParticipantState(competitorEmail)

        await signInToLogProgress(page)
        const entryForm = page.locator('form')

        await page.getByRole('tab', { name: 'Audiobook minutes' }).click()
        await entryForm.locator('#value').fill('44')
        await entryForm.locator('#activityDate').fill('2026-05-08')
        await entryForm.locator('#bookTitle').fill('Because of Winn-Dixie')
        await entryForm.locator('#bookAuthor').fill('Kate DiCamillo')
        await entryForm.locator('#notes').fill(notes)
        await entryForm.getByRole('button', { name: 'Save entry' }).click()

        await expect(page.getByText('Entry saved')).toBeVisible()
        await expect(
            page.getByText(/Audiobook minutes for 2026-05-08 saved/i)
        ).toBeVisible()

        const entry = await prisma.readingEntry.findFirst({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                bookAuthor: true,
                bookTitle: true,
                id: true,
                notes: true,
                value: true,
            },
            where: {
                notes,
                campaignParticipantId: before.id,
                type: 'AUDIOBOOK_MINUTES',
            },
        })

        expect(entry).not.toBeNull()
        expect(entry?.value).toBe(44)
        expect(entry?.bookTitle).toBe('Because of Winn-Dixie')
        expect(entry?.bookAuthor).toBe('Kate DiCamillo')

        const after = await loadParticipantState(competitorEmail)
        expect(after.totalBooks).toBe(before.totalBooks)
        expect(after.totalPages).toBe(before.totalPages)
        expect(after.totalAudiobookMinutes).toBe(
            before.totalAudiobookMinutes + 44
        )
        expect(after.totalChallenges).toBe(before.totalChallenges)
        expectPointDelta(before.totalPoints, after.totalPoints, 33)

        const auditActions = await loadAuditActions(entry?.id ?? '')
        expect(auditActions).toEqual(['reading-entry.created'])
    })

    test('submits a mobile challenge completion and records pending review', async ({
        page,
    }) => {
        const notes = `phase7-challenge-${Date.now()}`
        const before = await loadParticipantState(competitorEmail)

        await signInToLogProgress(page)
        const entryForm = page.locator('form')

        await page.getByRole('tab', { name: 'Challenge completion' }).click()
        await entryForm.locator('#challengeId').selectOption({
            label: 'Friend Recommendation',
        })
        await entryForm.locator('#activityDate').fill('2026-05-08')
        await entryForm.locator('#notes').fill(notes)
        await entryForm.getByRole('button', { name: 'Save entry' }).click()

        await expect(page.getByText('Entry saved')).toBeVisible()
        await expect(
            page.getByText(
                /Challenge completion for Friend Recommendation saved/i
            )
        ).toBeVisible()

        const entry = await prisma.readingEntry.findFirst({
            include: {
                challengeCompletion: {
                    select: {
                        id: true,
                        reviewState: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            where: {
                notes,
                campaignParticipantId: before.id,
                type: 'CHALLENGE_COMPLETION',
            },
        })

        expect(entry).not.toBeNull()
        expect(entry?.value).toBe(1)
        expect(entry?.challengeCompletion?.reviewState).toBe('PENDING')

        const after = await loadParticipantState(competitorEmail)
        expect(after.totalBooks).toBe(before.totalBooks)
        expect(after.totalPages).toBe(before.totalPages)
        expect(after.totalAudiobookMinutes).toBe(before.totalAudiobookMinutes)
        expect(after.totalChallenges).toBe(before.totalChallenges)
        expectPointDelta(before.totalPoints, after.totalPoints, 0)

        const auditActions = await loadAuditActions(entry?.id ?? '')
        expect(auditActions).toEqual([
            'reading-entry.created',
            'challenge-completion.submitted',
        ])
    })
})

async function signInToLogProgress(page: Page) {
    await page.goto('/campaign-board')
    const signInForm = page.locator('form')

    await expect(page.getByLabel('Email address')).toBeEnabled()
    await page.getByLabel('Email address').fill(competitorEmail)
    await page.getByLabel('Password').fill(localAuthPassword)
    await signInForm.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/campaign-board$/)
    await expect(page.getByText('Campaign context')).toBeVisible()
}

async function loadParticipantState(email: string) {
    const participant = await prisma.campaignParticipant.findFirst({
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            id: true,
            totalAudiobookMinutes: true,
            totalBooks: true,
            totalChallenges: true,
            totalPages: true,
            totalPoints: true,
        },
        where: {
            campaign: {
                status: 'ACTIVE',
            },
            removedAt: null,
            user: {
                email,
            },
        },
    })

    expect(participant).not.toBeNull()

    return {
        id: participant?.id ?? '',
        totalAudiobookMinutes: participant?.totalAudiobookMinutes ?? 0,
        totalBooks: participant?.totalBooks ?? 0,
        totalChallenges: participant?.totalChallenges ?? 0,
        totalPages: participant?.totalPages ?? 0,
        totalPoints: participant?.totalPoints.toString() ?? '0',
    }
}

async function loadAuditActions(readingEntryId: string) {
    const auditLogs = await prisma.auditLog.findMany({
        orderBy: {
            createdAt: 'asc',
        },
        select: {
            action: true,
        },
        where: {
            readingEntryId,
        },
    })

    return auditLogs.map(({ action }) => action)
}

function expectPointDelta(before: string, after: string, delta: number) {
    expect(Number(after) - Number(before)).toBeCloseTo(delta, 4)
}
