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

// ─── Tab visibility ───────────────────────────────────────────────────────────

test('MANAGER 登入後可見到「績效可視化儀表板」Tab 按鈕', async ({ page }) => {
  await loginAs(page, 'manager@test.com');

  // 💡 更新：使用 getByRole 精準抓取新的 Tabs
  await expect(page.getByRole('tab', { name: '績效可視化儀表板' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '團隊目標總覽' })).toBeVisible();
});

test('MANAGER 點擊「績效可視化儀表板」Tab 可進入 Dashboard 頁', async ({ page }) => {
  await loginAs(page, 'manager@test.com');

  await page.getByRole('tab', { name: '績效可視化儀表板' }).click();

  await expect(page.locator('#performance-dashboard')).toBeVisible();
});

// ─── KPI Summary Cards ────────────────────────────────────────────────────────

test('Dashboard 顯示四張 KPI 摘要卡片', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await page.getByRole('tab', { name: '績效可視化儀表板' }).click();

  const kpiSection = page.locator('#dashboard-kpi-cards');
  await expect(kpiSection).toBeVisible({ timeout: 10000 });

  await expect(kpiSection.getByText('總目標數')).toBeVisible();
  await expect(kpiSection.getByText('完成率')).toBeVisible();
  await expect(kpiSection.getByText('平均進度')).toBeVisible();
  await expect(kpiSection.getByText('整體 KPI 對齊率')).toBeVisible();
});

// ─── Filters ─────────────────────────────────────────────────────────────────

test('季度篩選 Dropdown 存在且含「全部季度」選項', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await page.getByRole('tab', { name: '績效可視化儀表板' }).click();

  const quarterFilter = page.locator('#quarter-filter');
  await expect(quarterFilter).toBeVisible({ timeout: 10000 });
  await expect(quarterFilter.locator('option[value=""]')).toHaveText('全部季度');
});

test('Charts visible', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await page.getByRole('tab', { name: '績效可視化儀表板' }).click();

  await expect(page.locator('#status-distribution-card')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#progress-distribution-card')).toBeVisible();
});

test('HR 登入後不顯示「績效儀表板」Tab', async ({ page }) => {
  await loginAs(page, 'hr@test.com');
  await expect(page.getByRole('tab', { name: '績效可視化儀表板' })).not.toBeVisible();
});