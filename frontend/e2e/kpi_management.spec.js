/**
 * E2E tests — KPI Management (manager split-view)
 *
 * Tests (against a live dev server + backend):
 *  - Manager (with upper manager) sees KPI 管理 tab
 *  - After navigating to KPI 管理, split view renders with two labelled columns
 *  - Left column "上級主管指派" contains seed KPI created by upper-manager
 *  - Right column "我建立的 KPI" contains seed KPI created by manager
 *  - Manager can create a new KPI using the form (appears in right column)
 *  - Upper manager (no managerId) sees a single-column view (no split)
 *  - Quarter select only shows HR-defined periods (not free text)
 */
import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────
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

async function goToKpiTab(page) {
  await page.getByRole('tab', { name: 'KPI 管理' }).click();
}

// ── Before each ───────────────────────────────────────────────────────────────
test.beforeEach(async () => {
  await resetDb();
});

// ─── Navigation ───────────────────────────────────────────────────────────────

test('MANAGER 登入後可以看到 KPI 管理 分頁', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
});

// ─── Split-view (manager with upper manager) ──────────────────────────────────

test('MANAGER 的 KPI 管理頁顯示兩欄分割 — 上級主管指派 與 我建立的 KPI', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
  await goToKpiTab(page);

  await expect(page.getByText('上級主管指派')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('我建立的 KPI')).toBeVisible();
});

test('左欄「上級主管指派」包含 upper-manager 建立的 KPI', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
  await goToKpiTab(page);

  await expect(page.getByText('上級主管指派')).toBeVisible({ timeout: 8000 });

  // Seed data: kpi-q2-2026-002 was created by upperManager
  const upperCol = page.locator('text=上級主管指派').locator('../..');
  await expect(upperCol.getByText('完成微服務架構遷移規劃')).toBeVisible({ timeout: 8000 });
});

test('右欄「我建立的 KPI」包含 manager 自己建立的 KPI', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
  await goToKpiTab(page);

  await expect(page.getByText('我建立的 KPI')).toBeVisible({ timeout: 8000 });

  // Seed data: kpi-q2-2026-001 and kpi-q2-2026-003 were created by manager
  await expect(page.getByText('提升系統測試覆蓋率至 80%')).toBeVisible({ timeout: 8000 });
});

test('兩欄都顯示欄位內 KPI 數量', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
  await goToKpiTab(page);

  await expect(page.getByText('上級主管指派')).toBeVisible({ timeout: 8000 });
  // The count badges next to the column headers
  await expect(page.getByText('1 個').first()).toBeVisible();
});

// ─── Create KPI form ──────────────────────────────────────────────────────────

test('MANAGER 可以新增 KPI，出現在「我建立的 KPI」欄', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
  await goToKpiTab(page);

  await expect(page.getByRole('button', { name: '+ 新增 KPI' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '+ 新增 KPI' }).click();

  await page.getByPlaceholder('KPI 標題').fill('E2E 新建 KPI 測試');

  // Periods are loaded asynchronously; wait for option to appear before selecting
  const quarterSelect = page.locator('select').first();
  await expect(quarterSelect.locator('option').nth(1)).toBeAttached({ timeout: 5000 });
  await quarterSelect.selectOption({ index: 1 });

  await page.locator('button[type="submit"]').first().click();

  // New KPI should appear in the right "我建立的 KPI" column
  await expect(page.getByText('E2E 新建 KPI 測試')).toBeVisible({ timeout: 8000 });
});

test('Quarter 選單只包含 HR 預設的績效週期（不是自由輸入）', async ({ page }) => {
  await loginAs(page, 'manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
  await goToKpiTab(page);

  await page.getByRole('button', { name: '+ 新增 KPI' }).click();
  await expect(page.getByPlaceholder('KPI 標題')).toBeVisible();

  // The quarter field should be a <select> (not a free text <input>)
  const quarterSelect = page.locator('form select');
  await expect(quarterSelect).toBeVisible();

  // Should contain the seed periods
  const options = await quarterSelect.locator('option').allTextContents();
  expect(options.some((o) => o.includes('2026Q'))).toBe(true);
});

// ─── Single-column view (upper manager) ──────────────────────────────────────

test('UPPER-MANAGER 的 KPI 頁不顯示分欄（單欄顯示）', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({
    json: { token: 'mock-token', user: { id: 'upper-1', email: 'upper-manager@test.com', role: 'MANAGER', managerId: null, name: 'Upper' } }
  }));
  await page.route('**/api/auth/me', route => route.fulfill({
    json: { id: 'upper-1', email: 'upper-manager@test.com', role: 'MANAGER', managerId: null, name: 'Upper' }
  }));
  await page.route('**/api/kpis', route => route.fulfill({ json: [] }));
  await page.route('**/api/periods', route => route.fulfill({ json: [] }));

  await loginAs(page, 'upper-manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
  await goToKpiTab(page);

  await expect(page.locator('text=共').first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('上級主管指派')).not.toBeVisible();
  await expect(page.getByText('我建立的 KPI')).not.toBeVisible();
});

test('UPPER-MANAGER 可以看到自己建立的 KPI', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({
    json: { token: 'mock-token', user: { id: 'upper-1', email: 'upper-manager@test.com', role: 'MANAGER', managerId: null, name: 'Upper' } }
  }));
  await page.route('**/api/auth/me', route => route.fulfill({
    json: { id: 'upper-1', email: 'upper-manager@test.com', role: 'MANAGER', managerId: null, name: 'Upper' }
  }));
  await page.route('**/api/kpis', route => route.fulfill({
    json: [ { id: 'kpi-2', title: '完成微服務架構遷移規劃', quarter: '2026Q2', createdById: 'upper-1' } ]
  }));
  await page.route('**/api/periods', route => route.fulfill({ json: [] }));

  await loginAs(page, 'upper-manager@test.com');
  await expect(page.getByRole('tab', { name: 'KPI 管理' })).toBeVisible({ timeout: 10000 });
  await goToKpiTab(page);

  await expect(page.getByText('完成微服務架構遷移規劃')).toBeVisible({ timeout: 8000 });
});
