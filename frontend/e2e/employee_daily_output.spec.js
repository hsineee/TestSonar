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

test('EMPLOYEE 可進入日常產出分頁並看到週報區塊', async ({ page }) => {
  await loginAs(page, 'employee@test.com');
  await page.getByRole('tab', { name: '日常產出' }).click();
  await expect(page.getByText('快速新增紀錄')).toBeVisible();
  await expect(page.getByText('自動週報彙整')).toBeVisible();
  await expect(page.getByText('本週明細')).toBeVisible();
});

test('EMPLOYEE 可新增一筆日常微產出', async ({ page }) => {
  await loginAs(page, 'employee@test.com');
  await page.getByRole('tab', { name: '日常產出' }).click();
  await page.getByPlaceholder('例如 3').fill('2');
  await page.getByPlaceholder('例如：審閱 Payment API PR、補上 8 個 unit tests').fill('E2E 測試紀錄');
  await page.getByRole('button', { name: '+ 新增微產出' }).click();
  await expect(page.getByText('E2E 測試紀錄')).toBeVisible({ timeout: 10000 });
});
