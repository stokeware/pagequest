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
    test('shows a user-friendly error when local sign-in fails', async ({
        page,
    }) => {
        await page.goto('/sign-in')

        await expect(page.getByLabel('Email address')).toBeEnabled()
        await page.getByLabel('Email address').fill('alice@pagequest.local')
        await page.getByLabel('Shared passphrase').fill('not-the-passphrase')
        await page
            .locator('form')
            .getByRole('button', { name: 'Sign in' })
            .click()

        await expect(page).toHaveURL(/\/sign-in$/)
        await expect(
            page.getByRole('alert').getByText('Sign-in failed.')
        ).toBeVisible()
        await expect(
            page
                .getByRole('alert')
                .getByText(
                    'Sign-in failed. Use one of the seeded local emails and the shared passphrase.'
                )
        ).toBeVisible()
    })

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
            page
                .getByRole('navigation', { name: 'Authenticated navigation' })
                .getByRole('link', { name: 'Dashboard' })
        ).toBeVisible()
        await expect(
            page.getByRole('button', { name: 'Log out' })
        ).toBeVisible()

        await page.getByRole('button', { name: 'Log out' }).click()

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
        await expect(page.getByText('Planned admin entry points')).toBeVisible()
        await expect(
            page.getByRole('button', { name: 'Log out' })
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

        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
            page
                .getByRole('navigation', { name: 'Authenticated navigation' })
                .getByRole('link', { name: 'Dashboard' })
        ).toBeVisible()

        await page.goto('/admin')

        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
            page
                .getByRole('navigation', { name: 'Authenticated navigation' })
                .getByRole('link', { name: 'Dashboard' })
        ).toBeVisible()
    })

    test('lands an admin on the admin shell when signing in from the public sign-in page', async ({
        page,
    }) => {
        await signInWithLocalCredentials({
            email: 'admin@pagequest.local',
            page,
            startPath: '/sign-in',
        })

        await expect(page).toHaveURL(/\/admin$/)
        await expect(page.getByText('Planned admin entry points')).toBeVisible()
        await expect(
            page.getByRole('button', { name: 'Log out' })
        ).toBeVisible()
    })
})
