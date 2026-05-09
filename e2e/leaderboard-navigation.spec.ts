import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { prisma } from '../lib/prisma'

const localAuthPassphrase =
    process.env.LOCAL_AUTH_PASSPHRASE ?? 'pagequest-local'

const competitorEmail = 'alice@pagequest.local'

test.describe('leaderboard navigation and refresh', () => {
    test.describe.configure({ mode: 'serial' })

    test('updates standings after a new entry and opens participant detail pages', async ({
        page,
    }) => {
        const notes = `phase8-leaderboard-${Date.now()}`
        const beforeStandings = await loadActiveStandings()
        const beforeParticipant = beforeStandings.find(
            (participant) => participant.email === competitorEmail
        )

        expect(beforeParticipant).toBeDefined()

        const leaderPoints = Math.max(
            ...beforeStandings.map((participant) =>
                Number(participant.totalPoints)
            )
        )
        const pagesToRead = Math.max(
            Math.floor(
                leaderPoints - Number(beforeParticipant?.totalPoints ?? '0')
            ) + 1,
            1
        )

        await signInWithLocalCredentials({
            email: competitorEmail,
            page,
            startPath: '/log-progress',
        })

        const entryForm = page.locator('form')
        await page.getByRole('tab', { name: 'Pages read' }).click()
        await entryForm.locator('#value').fill(String(pagesToRead))
        await entryForm.locator('#activityDate').fill('2026-05-08')
        await entryForm.locator('#bookTitle').fill('The Wind in the Willows')
        await entryForm.locator('#bookAuthor').fill('Kenneth Grahame')
        await entryForm.locator('#notes').fill(notes)
        await entryForm.getByRole('button', { name: 'Save entry' }).click()

        await expect(page.getByText('Entry saved')).toBeVisible()

        const afterParticipant = await loadActiveParticipant(competitorEmail)
        expect(afterParticipant.totalPages).toBe(
            (beforeParticipant?.totalPages ?? 0) + pagesToRead
        )
        expect(Number(afterParticipant.totalPoints)).toBeGreaterThan(
            leaderPoints
        )

        await page.getByRole('link', { name: 'Leaderboard' }).first().click()
        await expect(page).toHaveURL(/\/leaderboard$/)
        await expect(page.getByText('Standings')).toBeVisible()

        const aliceRow = page.getByRole('link', {
            name: /Open details for Alice Redwood/i,
        })

        await expect(aliceRow).toContainText('#1')
        await expect(aliceRow).toContainText(
            formatPointsLabel(afterParticipant.totalPoints)
        )

        await aliceRow.click()

        await expect(page).toHaveURL(/\/leaderboard\//)
        await expect(
            page.getByText('Alice Redwood', { exact: true })
        ).toBeVisible()
        await expect(page.getByText(`Note: ${notes}`)).toBeVisible()

        await page.getByRole('button', { name: 'Open my history' }).click()

        await expect(page).toHaveURL(/\/history/)
        await expect(
            page.getByRole('main').getByText('My history', { exact: true })
        ).toBeVisible()
        await expect(page.getByText(`Note: ${notes}`)).toBeVisible()
    })
})

async function signInWithLocalCredentials({
    email,
    page,
    startPath,
}: {
    email: string
    page: Page
    startPath: string
}) {
    await page.goto(startPath)
    const signInForm = page.locator('form')

    await expect(page.getByLabel('Email address')).toBeEnabled()
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Shared passphrase').fill(localAuthPassphrase)
    await signInForm.getByRole('button', { name: 'Sign in' }).click()
}

async function loadActiveStandings() {
    const participants = await prisma.questParticipant.findMany({
        orderBy: [
            {
                totalPoints: 'desc',
            },
            {
                totalPages: 'desc',
            },
            {
                totalAudiobookMinutes: 'desc',
            },
            {
                totalBooks: 'desc',
            },
            {
                createdAt: 'asc',
            },
        ],
        select: {
            totalPages: true,
            totalPoints: true,
            user: {
                select: {
                    email: true,
                },
            },
        },
        where: {
            quest: {
                status: 'ACTIVE',
            },
            removedAt: null,
        },
    })

    return participants.map((participant) => ({
        email: participant.user.email,
        totalPages: participant.totalPages,
        totalPoints: participant.totalPoints.toString(),
    }))
}

async function loadActiveParticipant(email: string) {
    const participant = await prisma.questParticipant.findFirst({
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            totalPages: true,
            totalPoints: true,
        },
        where: {
            quest: {
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
        totalPages: participant?.totalPages ?? 0,
        totalPoints: participant?.totalPoints.toString() ?? '0',
    }
}

function formatPointsLabel(value: string) {
    return `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(Number(value))} points`
}
