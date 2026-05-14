import { expect, test } from '@playwright/test';

test('login page renders the Google sign-in action', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /bienvenido a sfvc/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /continuar con google/i })).toBeVisible();
});
