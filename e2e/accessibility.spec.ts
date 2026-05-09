import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = [
    ['public home', '/'],
    ['public sign-in', '/sign-in'],
    ['competitor dashboard', '/dashboard'],
    ['admin overview', '/admin'],
] as const

for (const [label, route] of routes) {
    test(`${label} has no serious accessibility violations`, async ({
        page,
    }) => {
        await page.goto(route)

        const results = await new AxeBuilder({ page }).analyze()
        const seriousViolations = results.violations.filter((violation) =>
            ['critical', 'serious'].includes(violation.impact ?? '')
        )

        expect(seriousViolations).toEqual([])
    })
}

const skipLinkRoutes = [
    ['public home', '/'],
    ['competitor dashboard', '/dashboard'],
    ['admin overview', '/admin'],
] as const

for (const [label, route] of skipLinkRoutes) {
    test(`${label} exposes a working skip link`, async ({ page }) => {
        await page.goto(route)
        await page.keyboard.press('Tab')

        const skipLink = page.getByRole('link', {
            name: 'Skip to main content',
        })

        await expect(skipLink).toBeFocused()
        await page.keyboard.press('Enter')

        await expect(page.locator('main')).toBeFocused()
    })
}
