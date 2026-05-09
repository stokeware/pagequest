import type { Locator, Page } from '@playwright/test'
import { devices, expect, test } from '@playwright/test'

const iPhone13 = devices['iPhone 13']
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

async function expectTouchTargets(locator: Locator, minimumSize = 44) {
    const count = await locator.count()

    expect(count).toBeGreaterThan(0)

    for (let index = 0; index < count; index += 1) {
        const box = await locator.nth(index).boundingBox()

        expect(box).not.toBeNull()
        expect(box!.height).toBeGreaterThanOrEqual(minimumSize)
        expect(box!.width).toBeGreaterThanOrEqual(minimumSize)
    }
}

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

    test('keeps public touch targets above the mobile minimum', async ({
        page,
    }) => {
        await page.goto('/sign-in')

        await expectTouchTargets(
            page
                .getByRole('navigation', { name: 'Public navigation' })
                .getByRole('link')
        )
        await expectTouchTargets(page.getByRole('button', { name: 'Sign in' }))
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

    test('keeps competitor header navigation targets large enough', async ({
        page,
    }) => {
        await signInWithLocalCredentials({
            email: 'alice@pagequest.local',
            page,
            startPath: '/dashboard',
        })

        await expect(page).toHaveURL(/\/dashboard$/)

        await expectTouchTargets(
            page
                .getByRole('navigation', { name: 'Authenticated navigation' })
                .getByRole('link')
        )
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

    test('keeps admin header navigation targets large enough', async ({
        page,
    }) => {
        await signInWithLocalCredentials({
            email: 'admin@pagequest.local',
            page,
            startPath: '/admin',
        })

        await expect(page).toHaveURL(/\/admin$/)

        await expectTouchTargets(
            page
                .getByRole('navigation', { name: 'Authenticated navigation' })
                .getByRole('link')
        )
    })
})
