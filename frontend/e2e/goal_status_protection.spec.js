import { test, expect } from '@playwright/test';

async function loginAs(page, email) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.getByPlaceholder('employee@test.com').fill(email);
  await page.getByPlaceholder('password123').fill('password123');
  await page.getByRole('button', { name: '登入' }).click();
}

test.describe('Goal Status Protection Tests', () => {

  test('MANAGER 不應看到已退回、異議中或裁定後目標的「退回」按鈕', async ({ page }) => {
    // Mock team goals with various statuses
    await page.route('**/api/goals/team', async route => {
      await route.fulfill({
        json: {
          goals: [
            { id: 'g1', title: '異議中目標', status: 'DISPUTED', progress: 50, user: { name: 'Employee A' }, kpi: { title: 'KPI 1', quarter: '2026Q1' } },
            { id: 'g2', title: '已裁定目標', status: 'DISPUTE_RESOLVED', progress: 80, user: { name: 'Employee B' }, kpi: { title: 'KPI 2', quarter: '2026Q1' } },
            { id: 'g3', title: '已退回目標', status: 'REJECTED', progress: 30, user: { name: 'Employee C' }, kpi: { title: 'KPI 3', quarter: '2026Q1' }, rejectReason: 'Reason X' },
            { id: 'g4', title: '進行中目標', status: 'ACTIVE', progress: 40, user: { name: 'Employee D' }, kpi: { title: 'KPI 4', quarter: '2026Q1' } }
          ],
          alignment: { total: 4, aligned: 3, percentage: 75 }
        }
      });
    });

    await loginAs(page, 'manager@test.com');
    await page.getByRole('tab', { name: '團隊目標總覽' }).click();

    // ACTIVE goal should have reject button
    await expect(page.locator('.goal-card', { hasText: '進行中目標' }).getByRole('button', { name: '退回目標' })).toBeVisible();

    // DISPUTED, DISPUTE_RESOLVED, REJECTED goals should NOT have reject button
    await expect(page.locator('.goal-card', { hasText: '異議中目標' }).getByRole('button', { name: '退回目標' })).not.toBeVisible();
    await expect(page.locator('.goal-card', { hasText: '已裁定目標' }).getByRole('button', { name: '退回目標' })).not.toBeVisible();
    await expect(page.locator('.goal-card', { hasText: '已退回目標' }).getByRole('button', { name: '退回目標' })).not.toBeVisible();
  });

  test('EMPLOYEE 不應在異議中或裁定後的目標看到「更新進度」輸入框', async ({ page }) => {
    // Mock employee goals
    await page.route('**/api/goals', async route => {
      await route.fulfill({
        json: [
          { id: 'g1', title: '異議中目標', status: 'DISPUTED', progress: 50, kpi: { title: 'KPI 1', quarter: '2026Q1' } },
          { id: 'g2', title: '已裁定目標', status: 'DISPUTE_RESOLVED', progress: 80, kpi: { title: 'KPI 2', quarter: '2026Q1' } },
          { id: 'g3', title: '進行中目標', status: 'ACTIVE', progress: 40, kpi: { title: 'KPI 4', quarter: '2026Q1' } }
        ]
      });
    });

    await loginAs(page, 'employee@test.com');

    // ACTIVE goal should have progress input
    const activeGoal = page.locator('.goal-card', { hasText: '進行中目標' });
    await expect(activeGoal.getByPlaceholder('輸入進度 0–100')).toBeVisible();
    await expect(activeGoal.getByRole('button', { name: '更新進度' })).toBeVisible();

    // DISPUTED and DISPUTE_RESOLVED goals should NOT have progress input
    const disputedGoal = page.locator('.goal-card', { hasText: '異議中目標' });
    await expect(disputedGoal.getByPlaceholder('輸入進度 0–100')).not.toBeVisible();

    const resolvedGoal = page.locator('.goal-card', { hasText: '已裁定目標' });
    await expect(resolvedGoal.getByPlaceholder('輸入進度 0–100')).not.toBeVisible();
  });

});