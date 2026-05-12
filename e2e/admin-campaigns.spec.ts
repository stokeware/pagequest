import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { prisma } from '../lib/prisma'

const localAuthPassword = process.env.LOCAL_AUTH_PASSWORD ?? 'pagequest-local'

async function signInToAdminCampaigns(page: Page) {
    await page.goto('/admin/campaigns')

    await expect(page.getByLabel('Email address')).toBeEnabled()
    await page.getByLabel('Email address').fill('admin@pagequest.local')
    await page.getByLabel('Password').fill(localAuthPassword)
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/admin\/campaigns$/)
}

test.describe('admin campaign challenge deletion', () => {
    test.describe.configure({ mode: 'serial' })

    test('creates and deletes a campaign challenge from the admin table', async ({
        page,
    }) => {
        const challengeTitle = `delete-me-${Date.now()}`

        await signInToAdminCampaigns(page)

        const challengeForm = page.locator(
            'form[id$="-campaign-challenges-form"]'
        )
        const campaignId = await challengeForm
            .locator('input[name="campaignId"]')
            .inputValue()

        await challengeForm
            .locator('input[name="newTitle"]')
            .fill(challengeTitle)
        await challengeForm.locator('input[name="newPointValue"]').fill('12')
        await challengeForm
            .locator('input[name="newPageMinuteMultiplier"]')
            .fill('1')
        await challengeForm
            .getByRole('button', { name: 'Save changes' })
            .click()

        await expect(page.getByText('Challenge created.')).toBeVisible()

        const createdChallenge = await prisma.challenge.findFirst({
            select: {
                id: true,
            },
            where: {
                campaignId,
                title: challengeTitle,
            },
        })

        expect(createdChallenge).not.toBeNull()

        const deleteButton = page.locator(
            `button[form="${createdChallenge?.id}-delete-form"]`
        )

        await expect(deleteButton).toBeVisible()
        await deleteButton.click()

        const dialog = page.getByRole('dialog', { name: 'Delete challenge?' })
        await expect(dialog).toBeVisible()
        await dialog.getByRole('button', { name: 'Delete challenge' }).click()

        await expect(page.getByText('Challenge deleted.')).toBeVisible()
        await expect(deleteButton).toHaveCount(0)

        const deletedChallenge = await prisma.challenge.findFirst({
            select: {
                id: true,
            },
            where: {
                campaignId,
                title: challengeTitle,
            },
        })

        expect(deletedChallenge).toBeNull()

        const auditLog = await prisma.auditLog.findFirst({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                action: true,
                challengeId: true,
                entityId: true,
            },
            where: {
                action: 'challenge.deleted',
                campaignId,
                entityId: createdChallenge?.id,
            },
        })

        expect(auditLog).not.toBeNull()
        expect(auditLog).toMatchObject({
            action: 'challenge.deleted',
            challengeId: null,
            entityId: createdChallenge?.id,
        })
    })
})
