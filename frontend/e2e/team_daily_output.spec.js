import { test, expect } from '@playwright/test';

async function resetDb() {
  await fetch('http://localhost:3001/test/reset', { method: 'POST' });
}

async function loginAs(page, email) {
  await page.goto('/');
  await page.getByPlaceholder('employee@test.com').fill(email);
  await page.getByPlaceholder('password123').fill('password123');
  await page.getByRole('button', { name: '登入' }).click();
}

test.beforeEach(async () => {
  await resetDb();
});

test('MANAGER 可開啟日常產出週報分頁', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await page.getByRole('tab', { name: '日常產出週報' }).click();
  await expect(page.getByText('團隊日常微產出週報')).toBeVisible();
  await expect(page.getByText('成員量化產出比較')).toBeVisible({ timeout: 10000 });
});
