import { test, expect } from '@playwright/test';

test.describe('App — E2E smoke', () => {
  test('renders the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows the celebratory launch screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/is live!/i)).toBeVisible();
  });
});
