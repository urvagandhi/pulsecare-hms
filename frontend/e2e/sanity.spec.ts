import { test, expect } from '@playwright/test';

test('loads the PulseCare HMS landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PulseCare HMS/);
  await expect(page.locator('text=PulseCare').first()).toBeVisible();
});
