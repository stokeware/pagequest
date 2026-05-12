import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const localAuthPassword = process.env.LOCAL_AUTH_PASSWORD ?? 'pagequest-local'

const competitorEmail = 'ben@pagequest.local'

type ActiveStandingRow = {
    email: string
    totalPages: number
    totalPoints: Prisma.Decimal | number | string
}

type ActiveParticipantRow = {
    totalPages: number
    totalPoints: Prisma.Decimal | number | string
}

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
            startPath: '/campaign-board',
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

        const benRow = page.getByRole('link', {
            name: /Open details for Ben Sparrow/i,
        })

        await expect(benRow).toContainText('#1')
        await expect(benRow).toContainText(
            formatPointsLabel(afterParticipant.totalPoints)
        )

        await benRow.click()

        await expect(page).toHaveURL(/\/leaderboard\//)
        await expect(
            page.getByText('Ben Sparrow', { exact: true })
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
    await page.getByLabel('Password').fill(localAuthPassword)
    await signInForm.getByRole('button', { name: 'Sign in' }).click()
}

async function loadActiveStandings() {
    const participants = await prisma.$queryRaw<ActiveStandingRow[]>(Prisma.sql`
        SELECT
            "User"."email" AS "email",
            "CampaignParticipant"."totalPages" AS "totalPages",
            "CampaignParticipant"."totalPoints" AS "totalPoints"
        FROM "CampaignParticipant"
        INNER JOIN "Campaign"
            ON "Campaign"."id" = "CampaignParticipant"."campaignId"
        INNER JOIN "User"
            ON "User"."id" = "CampaignParticipant"."userId"
        WHERE "Campaign"."status" = 'ACTIVE'
            AND "CampaignParticipant"."removedAt" IS NULL
        ORDER BY
            "CampaignParticipant"."totalPoints" DESC,
            "CampaignParticipant"."totalPages" DESC,
            "CampaignParticipant"."totalAudiobookMinutes" DESC,
            "CampaignParticipant"."totalBooks" DESC,
            "CampaignParticipant"."createdAt" ASC
    `)

    return participants.map((participant) => ({
        email: participant.email,
        totalPages: participant.totalPages,
        totalPoints: participant.totalPoints.toString(),
    }))
}

async function loadActiveParticipant(email: string) {
    const [participant] = await prisma.$queryRaw<ActiveParticipantRow[]>(
        Prisma.sql`
            SELECT
                "CampaignParticipant"."totalPages" AS "totalPages",
                "CampaignParticipant"."totalPoints" AS "totalPoints"
            FROM "CampaignParticipant"
            INNER JOIN "Campaign"
                ON "Campaign"."id" = "CampaignParticipant"."campaignId"
            INNER JOIN "User"
                ON "User"."id" = "CampaignParticipant"."userId"
            WHERE "Campaign"."status" = 'ACTIVE'
                AND "CampaignParticipant"."removedAt" IS NULL
                AND "User"."email" = ${email}
            ORDER BY "CampaignParticipant"."createdAt" DESC
            LIMIT 1
        `
    )

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
