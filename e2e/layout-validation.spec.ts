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

    test('shows the competitor sidebar and hides the mobile dock', async ({
        page,
    }) => {
        await page.goto('/dashboard')

        await expect(
            page.getByRole('navigation', {
                name: 'Competitor experience navigation',
            })
        ).toBeVisible()
        await expect(
            page.getByRole('navigation', {
                name: 'Competitor mobile navigation',
            })
        ).toBeHidden()
    })

    test('shows the admin rail and hides the compact mobile header nav', async ({
        page,
    }) => {
        await page.goto('/admin')

        await expect(
            page.getByRole('navigation', {
                name: 'Administrator experience navigation',
            })
        ).toBeVisible()
        await expect(
            page.getByRole('navigation', {
                name: 'Administrator quick navigation',
            })
        ).toBeHidden()
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

    test('switches competitor routes to the bottom navigation pattern', async ({
        page,
    }) => {
        await page.goto('/dashboard')

        await expect(
            page.getByRole('navigation', {
                name: 'Competitor mobile navigation',
            })
        ).toBeVisible()
        await expect(
            page.getByRole('navigation', {
                name: 'Competitor experience navigation',
            })
        ).toBeHidden()
    })

    test('switches admin routes to the compact header navigation pattern', async ({
        page,
    }) => {
        await page.goto('/admin')

        await expect(
            page.getByRole('navigation', {
                name: 'Administrator quick navigation',
            })
        ).toBeVisible()
        await expect(
            page.getByRole('navigation', {
                name: 'Administrator experience navigation',
            })
        ).toBeHidden()
    })
})
