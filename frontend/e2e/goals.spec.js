import { test, expect } from '@playwright/test';

async function resetDb() {
  await fetch('http://localhost:3001/test/reset', { method: 'POST' });
}

async function loginAs(page, email) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.getByPlaceholder('employee@test.com').fill(email);
  await page.getByPlaceholder('password123').fill('password123');
  await page.getByRole('button', { name: '登入' }).click();
}

test.beforeEach(async () => {
  await resetDb();
});

test('EMPLOYEE 可以看到目標列表', async ({ page }) => {
  await loginAs(page, 'employee@test.com');
  await expect(page.getByRole('tab', { name: '我的目標' })).toBeVisible();
  await expect(page.locator('text=共').first()).toBeVisible();
});

test('EMPLOYEE 可以新增目標', async ({ page }) => {
  await loginAs(page, 'employee@test.com');

  await page.getByRole('button', { name: '+ 新增目標' }).click();
  
  const formLocator = page.locator('form').filter({ hasText: '新增 SMART 目標' });
  await expect(formLocator).toBeVisible();

  await formLocator.locator('input').first().fill('E2E 測試目標');
  await expect(formLocator.locator('select option').nth(1)).toBeAttached({ timeout: 5000 });
  await formLocator.locator('select').selectOption({ index: 1 });
  await formLocator.locator('input[type="date"]').fill('2026-12-31');

  const textareas = formLocator.locator('textarea');
  await textareas.nth(0).fill('具體描述測試');
  await textareas.nth(1).fill('可衡量指標測試');
  await textareas.nth(2).fill('可達成方式測試');
  await textareas.nth(3).fill('相關性說明測試');

  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/goals') && res.request().method() === 'POST'),
    formLocator.locator('button[type="submit"]').click()
  ]);

  await expect(page.getByText('E2E 測試目標').first()).toBeVisible({ timeout: 8000 });
});

test('MANAGER 可以看到 KPI 對齊率', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await expect(page.getByText('KPI 對齊率')).toBeVisible();
  await expect(page.locator('text=%').first()).toBeVisible();
});

test('MANAGER 可以退回員工目標', async ({ page }) => {
  await loginAs(page, 'manager@test.com');

  await expect(page.getByRole('tab', { name: '團隊目標總覽' })).toBeVisible();
  await page.getByRole('tab', { name: '團隊目標總覽' }).click();
  
  // Wait for the data to load by checking for any goal title (h3)
  await expect(page.locator('h3').first()).toBeVisible({ timeout: 10000 });

  const rejectBtn = page.getByRole('button', { name: '退回目標' }).first();
  await expect(rejectBtn).toBeVisible({ timeout: 10000 });
  await rejectBtn.click();

  await page.getByPlaceholder('填寫退回原因').fill('E2E 測試退回原因');
  await page.getByRole('button', { name: '確認退回' }).click();

  await expect(page.getByText('E2E 測試退回原因').first()).toBeVisible();
});