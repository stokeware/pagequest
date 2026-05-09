import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const localAuthPassphrase =
    process.env.LOCAL_AUTH_PASSPHRASE ?? 'pagequest-local'

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

test.describe('local auth flow', () => {
    test('signs a competitor in from a protected route and signs out cleanly', async ({
        page,
    }) => {
        await signInWithLocalCredentials({
            email: 'alice@pagequest.local',
            page,
            startPath: '/dashboard',
        })

        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
            page.getByRole('heading', {
                name: 'A focused reading hub for logging progress and checking the race.',
            })
        ).toBeVisible()
        await expect(
            page.getByText('Signed in as: Alice Redwood')
        ).toBeVisible()

        await page.getByRole('button', { name: 'Sign out' }).click()

        await expect(page).toHaveURL(/\/sign-in$/)
        await expect(
            page.getByRole('heading', {
                name: 'Sign in before the next chapter begins.',
            })
        ).toBeVisible()

        await page.goto('/dashboard')
        await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fdashboard/)
    })

    test('lets an admin reach the admin shell through the protected route callback', async ({
        page,
    }) => {
        await signInWithLocalCredentials({
            email: 'admin@pagequest.local',
            page,
            startPath: '/admin',
        })

        await expect(page).toHaveURL(/\/admin$/)
        await expect(
            page.getByRole('heading', {
                name: 'A control surface for running each campaign without losing the playful tone.',
            })
        ).toBeVisible()
        await expect(
            page.getByText('Signed in as: Morgan Questmaster')
        ).toBeVisible()
    })

    test('redirects signed-in competitors away from admin routes', async ({
        page,
    }) => {
        await signInWithLocalCredentials({
            email: 'alice@pagequest.local',
            page,
            startPath: '/sign-in',
        })

        await expect(page).toHaveURL(/\/$/)

        await page.goto('/admin')

        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
            page.getByRole('heading', {
                name: 'A focused reading hub for logging progress and checking the race.',
            })
        ).toBeVisible()
    })
})
