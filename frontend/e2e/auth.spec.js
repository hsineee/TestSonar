import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
});

test('登入頁面顯示正確標題', async ({ page }) => {
  await expect(page.getByText('績效管理系統')).toBeVisible();
});

test('密碼錯誤顯示錯誤訊息', async ({ page }) => {
  await page.getByPlaceholder('employee@test.com').fill('employee@test.com');
  await page.getByPlaceholder('password123').fill('wrongpassword');
  await page.getByRole('button', { name: '登入' }).click();
  await expect(page.getByText(/Invalid|登入失敗/i)).toBeVisible({ timeout: 10000 });
});

test('EMPLOYEE 登入後跳轉到 GoalDashboard', async ({ page }) => {
  await page.getByPlaceholder('employee@test.com').fill('employee@test.com');
  await page.getByPlaceholder('password123').fill('password123');
  await page.getByRole('button', { name: '登入' }).click();
  
  await expect(page.getByRole('tab', { name: '我的目標' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ 新增目標' })).toBeVisible();
  await expect(page.getByText('Employee Chen · 員工 (EMPLOYEE)')).toBeVisible();
});

test('MANAGER 登入後跳轉到 TeamOverview', async ({ page }) => {
  await page.getByPlaceholder('employee@test.com').fill('manager@test.com');
  await page.getByPlaceholder('password123').fill('password123');
  await page.getByRole('button', { name: '登入' }).click();
  
  await expect(page.getByRole('tab', { name: '團隊目標總覽' })).toBeVisible();
  await expect(page.getByText('KPI 對齊率')).toBeVisible();
});

test('登出後回到登入頁', async ({ page }) => {
  await page.getByPlaceholder('employee@test.com').fill('employee@test.com');
  await page.getByPlaceholder('password123').fill('password123');
  await page.getByRole('button', { name: '登入' }).click();
  
  await expect(page.getByRole('tab', { name: '我的目標' })).toBeVisible();
  await page.getByRole('button', { name: '登出' }).click();
  await expect(page.getByText('績效管理系統')).toBeVisible();
});