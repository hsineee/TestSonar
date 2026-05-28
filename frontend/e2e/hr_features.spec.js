import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function resetDb() {
  await fetch('http://localhost:3001/test/reset', { method: 'POST' });
}

async function loginAsHr(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.getByPlaceholder('employee@test.com').fill('hr@test.com');
  await page.getByPlaceholder('password123').fill('password123');
  await page.getByRole('button', { name: '登入' }).click();
  // Wait for HR layout to appear
  await expect(page.getByRole('tab', { name: '使用者管理' })).toBeVisible({ timeout: 10000 });
}

// ── Before each ───────────────────────────────────────────────────────────────
test.beforeEach(async () => {
  await resetDb();
});

// ─── HR Layout ────────────────────────────────────────────────────────────────

test('HR 登入後顯示三個主要分頁', async ({ page }) => {
  await loginAsHr(page);
  await expect(page.getByRole('tab', { name: '使用者管理' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '評估模板管理' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '績效週期管理' })).toBeVisible();
});

test('HR 頂部顯示 "後端紀錄" 小按鈕', async ({ page }) => {
  await loginAsHr(page);
  await expect(page.getByRole('button', { name: '後端紀錄' })).toBeVisible();
});

test('點擊 "後端紀錄" 進入審計日誌頁', async ({ page }) => {
  await loginAsHr(page);
  await page.getByRole('button', { name: '後端紀錄' }).click();
  await expect(page.getByText('系統審計日誌')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('篩選動作')).toBeVisible();
});

test('審計日誌有「清除篩選」按鈕', async ({ page }) => {
  await loginAsHr(page);
  await page.getByRole('button', { name: '後端紀錄' }).click();
  await expect(page.getByRole('button', { name: '清除篩選' })).toBeVisible({ timeout: 8000 });
});

test('從審計日誌點回分頁後回到使用者管理', async ({ page }) => {
  await loginAsHr(page);
  await page.getByRole('button', { name: '後端紀錄' }).click();
  await expect(page.getByText('系統審計日誌')).toBeVisible();

  // Navigate back to a normal tab
  await page.getByRole('tab', { name: '使用者管理' }).click();
  await expect(page.getByText('使用者管理')).toBeVisible({ timeout: 8000 });
});

// ─── Template Management ──────────────────────────────────────────────────────

test('評估模板管理：載入現有模板', async ({ page }) => {
  await loginAsHr(page);
  await page.getByRole('tab', { name: '評估模板管理' }).click();
  // Seed data should have at least one template
  await expect(page.getByText('Engineering Quarterly Review')).toBeVisible({ timeout: 8000 });
});

test('評估模板管理：儲存空名稱顯示驗證錯誤', async ({ page }) => {
  await loginAsHr(page);
  await page.getByRole('tab', { name: '評估模板管理' }).click();
  await expect(page.getByRole('button', { name: '+ 新增評估模板' })).toBeVisible({ timeout: 8000 });

  await page.getByRole('button', { name: '+ 新增評估模板' }).click();
  // Don't fill in any name
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.getByText('請輸入模板名稱')).toBeVisible();
});


test('評估模板管理：可以刪除模板', async ({ page }) => {
  // First create a template so we have something to delete without breaking seed data
  await loginAsHr(page);
  await page.getByRole('tab', { name: '評估模板管理' }).click();
  await expect(page.getByRole('button', { name: '+ 新增評估模板' })).toBeVisible({ timeout: 8000 });

  await page.getByRole('button', { name: '+ 新增評估模板' }).click();
  await page.getByPlaceholder('例如: 研發部門季度考評').fill('刪除測試模板');
  await page.getByPlaceholder('維度名稱，如: 技術研發 / 代碼品質').first().fill('測試維度');
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.getByText('刪除測試模板')).toBeVisible({ timeout: 8000 });

  // Accept the confirm dialog and click delete for the new template
  page.on('dialog', (dialog) => dialog.accept());
  const deleteBtn = page.getByRole('row', { name: /刪除測試模板/ }).getByRole('button', { name: '刪除' });
  await deleteBtn.click();

  await expect(page.getByText('刪除測試模板')).not.toBeVisible({ timeout: 8000 });
});

// ─── Period Management ────────────────────────────────────────────────────────

test('績效週期管理：載入現有週期', async ({ page }) => {
  await loginAsHr(page);
  await page.getByRole('tab', { name: '績效週期管理' }).click();

  // Wait until the loading spinner is gone (list heading only appears after API returns)
  await expect(page.getByText('現有績效週期清單')).toBeVisible({ timeout: 10000 });

  // Seed data creates 2026Q1 and 2026Q2 — use cell role to avoid matching hint text
  await expect(page.getByRole('cell', { name: '2026Q1' })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('cell', { name: '2026Q2' })).toBeVisible();
});

test('績效週期管理：可以新增有效格式的週期', async ({ page }) => {
  await loginAsHr(page);
  await page.getByRole('tab', { name: '績效週期管理' }).click();
  await expect(page.getByPlaceholder('例如: 2026Q3')).toBeVisible({ timeout: 8000 });

  await page.getByPlaceholder('例如: 2026Q3').fill('2026Q3');
  await page.getByRole('button', { name: '確認新增' }).click();

  await expect(page.getByText('2026Q3')).toBeVisible({ timeout: 8000 });
});

test('績效週期管理：無效格式顯示驗證錯誤', async ({ page }) => {
  await loginAsHr(page);
  await page.getByRole('tab', { name: '績效週期管理' }).click();
  await expect(page.getByPlaceholder('例如: 2026Q3')).toBeVisible({ timeout: 8000 });

  await page.getByPlaceholder('例如: 2026Q3').fill('Q2-2026');
  await page.getByRole('button', { name: '確認新增' }).click();

  await expect(page.getByText(/格式必須為/)).toBeVisible();
});

test('績效週期管理：可以刪除週期', async ({ page }) => {
  // Add a new period then delete it
  await loginAsHr(page);
  await page.getByRole('tab', { name: '績效週期管理' }).click();
  await expect(page.getByPlaceholder('例如: 2026Q3')).toBeVisible({ timeout: 8000 });

  await page.getByPlaceholder('例如: 2026Q3').fill('2026Q4');
  await page.getByRole('button', { name: '確認新增' }).click();
  await expect(page.getByText('2026Q4')).toBeVisible({ timeout: 8000 });

  // Accept the confirm dialog
  page.on('dialog', (dialog) => dialog.accept());
  const deleteBtn = page.getByRole('row', { name: /2026Q4/ }).getByRole('button', { name: '刪除' });
  await deleteBtn.click();

  await expect(page.getByText('2026Q4')).not.toBeVisible({ timeout: 8000 });
});
