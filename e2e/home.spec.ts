import { expect, test } from '@playwright/test'

test('renders the home screen', async ({ page }) => {
    await page.goto('/')

    await expect(
        page.getByRole('heading', {
            name: 'A storybook home for family reading campaigns.',
        })
    ).toBeVisible()

    await expect(page.getByRole('link', { name: 'How it works' })).toBeVisible()
    await expect(page.getByText('Track every kind of reading')).toBeVisible()
})
