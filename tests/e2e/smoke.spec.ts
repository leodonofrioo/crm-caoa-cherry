import { expect, test } from '@playwright/test';

test.skip(!process.env.E2E_BASE_URL, 'Defina E2E_BASE_URL para rodar teste E2E contra staging/local com Postgres.');

test('login page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Acesso ao CRM' })).toBeVisible();
});
