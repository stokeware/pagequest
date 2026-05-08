import { expect, test } from '@playwright/test'

test('renders the home screen', async ({ page }) => {
    await page.goto('/')

    await expect(
        page.getByRole('heading', {
            name: 'Page Quest is ready for implementation.',
        })
    ).toBeVisible()

    await expect(page.getByText('Next.js 16')).toBeVisible()
})
