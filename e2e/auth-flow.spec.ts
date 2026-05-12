import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const localAuthPassword = process.env.LOCAL_AUTH_PASSWORD ?? 'pagequest-local'

async function signInWithPassword({
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

test.describe('password auth flow', () => {
    test('shows a user-friendly error when password sign-in fails', async ({
        page,
    }) => {
        await page.goto('/sign-in')

        await expect(page.getByLabel('Email address')).toBeEnabled()
        await page.getByLabel('Email address').fill('alice@pagequest.local')
        await page.getByLabel('Password').fill('not-the-password')
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
                    'Sign-in failed. Check your email and password and try again.'
                )
        ).toBeVisible()
    })

    test('signs a competitor in from a protected route and signs out cleanly', async ({
        page,
    }) => {
        await signInWithPassword({
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
            page.getByRole('link', { name: 'Page Quest' })
        ).toBeVisible()
        await expect(
            page.getByRole('button', { name: 'Sign in' })
        ).toBeVisible()

        await page.goto('/dashboard')
        await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fdashboard/)
    })

    test('lets an admin reach the admin shell through the protected route callback', async ({
        page,
    }) => {
        await signInWithPassword({
            email: 'admin@pagequest.local',
            page,
            startPath: '/admin',
        })

        await expect(page).toHaveURL(/\/admin\/campaigns$/)
        await expect(page.getByLabel('Campaign name').first()).toBeVisible()
        await expect(
            page.getByRole('button', { name: 'Log out' })
        ).toBeVisible()
    })

    test('redirects signed-in competitors away from admin routes', async ({
        page,
    }) => {
        await signInWithPassword({
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
        await signInWithPassword({
            email: 'admin@pagequest.local',
            page,
            startPath: '/sign-in',
        })

        await expect(page).toHaveURL(/\/admin\/campaigns$/)
        await expect(page.getByLabel('Campaign name').first()).toBeVisible()
        await expect(
            page.getByRole('button', { name: 'Log out' })
        ).toBeVisible()
    })
})
