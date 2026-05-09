import { devices, expect, test } from '@playwright/test'

const iPhone13 = devices['iPhone 13']

test.describe('desktop core layouts', () => {
    test('keeps public navigation visible on the sign-in route', async ({
        page,
    }) => {
        await page.goto('/sign-in')

        await expect(
            page.getByRole('navigation', { name: 'Public navigation' })
        ).toBeVisible()
        await expect(
            page.getByRole('heading', {
                name: 'Sign in before the next chapter begins.',
            })
        ).toBeVisible()
    })

    test('redirects signed-out competitor routes back to sign in', async ({
        page,
    }) => {
        await page.goto('/dashboard')

        await expect(
            page.getByRole('heading', {
                name: 'Sign in before the next chapter begins.',
            })
        ).toBeVisible()
        await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fdashboard/)
    })

    test('redirects signed-out admin routes back to sign in', async ({
        page,
    }) => {
        await page.goto('/admin')

        await expect(
            page.getByRole('heading', {
                name: 'Sign in before the next chapter begins.',
            })
        ).toBeVisible()
        await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fadmin/)
    })
})

test.describe('mobile core layouts', () => {
    test.use({
        viewport: iPhone13.viewport,
        deviceScaleFactor: iPhone13.deviceScaleFactor,
        hasTouch: iPhone13.hasTouch,
        isMobile: iPhone13.isMobile,
        userAgent: iPhone13.userAgent,
    })

    test('keeps the public navigation readable on mobile', async ({ page }) => {
        await page.goto('/sign-in')

        await expect(
            page.getByRole('heading', {
                name: 'Sign in before the next chapter begins.',
            })
        ).toBeVisible()
        await expect(
            page.getByRole('navigation', { name: 'Public navigation' })
        ).toBeVisible()
    })

    test('redirects signed-out competitor routes on mobile', async ({
        page,
    }) => {
        await page.goto('/dashboard')

        await expect(
            page.getByRole('heading', {
                name: 'Sign in before the next chapter begins.',
            })
        ).toBeVisible()
        await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fdashboard/)
    })

    test('redirects signed-out admin routes on mobile', async ({ page }) => {
        await page.goto('/admin')

        await expect(
            page.getByRole('heading', {
                name: 'Sign in before the next chapter begins.',
            })
        ).toBeVisible()
        await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fadmin/)
    })
})
