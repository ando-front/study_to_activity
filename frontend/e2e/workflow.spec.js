const { test, expect } = require('@playwright/test');

test('S2A full workflow: Create plan, complete task, and approve', async ({ page }) => {
  const todayStr = new Date().toLocaleDateString('sv-SE');

  // Handle confirm dialogs
  page.on('dialog', dialog => dialog.accept());

  // 1. Reset Database for testing (resets task/plan data; seed users are preserved)
  await page.request.post('http://localhost:8000/api/test/reset');

  // Get seed users from the backend
  const usersRes = await page.request.get('http://localhost:8000/api/auth/users');
  expect(usersRes.ok()).toBeTruthy();
  const users = await usersRes.json();
  const parent = users.find(u => u.name === 'お父さん');
  const child = users.find(u => u.name === 'たろう');
  expect(parent, 'Seed user お父さん not found - did the backend seed correctly?').toBeTruthy();
  expect(child, 'Seed user たろう not found - did the backend seed correctly?').toBeTruthy();

  // 2. Login as parent via localStorage (bypasses OAuth for E2E testing)
  await page.goto('/');
  await page.evaluate((user) => {
    localStorage.setItem('s2a_user', JSON.stringify(user));
  }, parent);
  await page.goto('/parent/dashboard');
  await page.waitForURL(/.*parent\/dashboard/);

  // 3. 計画の作成
  await page.getByRole('link', { name: '計画', exact: true }).click();
  await page.waitForURL(/.*parent\/plans/);
  
  // 既存の計画をすべて削除
  let deleteBtn = page.locator('button:has-text("削除")');
  while (await deleteBtn.count() > 0) {
    await deleteBtn.first().click();
    await page.waitForTimeout(500);
  }

  // 新規作成
  await page.getByTestId('create-plan-button').click();
  await page.getByTestId('child-select').selectOption({ label: 'たろう' });
  await page.fill('input[type="date"]', todayStr);
  await page.getByPlaceholder('例: 月曜日の学習').fill('E2Eテスト計画');
  await page.getByTestId('task-subject-input').fill('E2E算数');
  await page.getByTestId('submit-plan-button').click();
  
  // 計画が一覧に表示されるのを待つ
  await expect(page.locator('text=E2Eテスト計画').first()).toBeVisible();
  
  // 4. ログアウトして子供でログイン
  await page.getByTestId('logout-link').click();
  await page.waitForURL('/');
  await page.getByRole('button', { name: 'たろう' }).click();
  await page.waitForURL(/.*child\/dashboard/);
  
  // 5. タスクの実施 (開始 -> 完了)
  await expect(page.getByTestId('task-start-button').first()).toBeVisible({ timeout: 10000 });
  await page.getByTestId('task-start-button').first().click();
  
  await expect(page.getByTestId('task-complete-button').first()).toBeVisible({ timeout: 10000 });
  await page.getByTestId('task-complete-button').first().click();
  
  // 6. ログアウトして親で承認
  await page.getByTestId('logout-link').click();
  await page.waitForURL('/');

  // Login as parent again via localStorage
  await page.evaluate((user) => {
    localStorage.setItem('s2a_user', JSON.stringify(user));
  }, parent);
  await page.goto('/parent/dashboard');
  await page.waitForURL(/.*parent\/dashboard/);
  
  // 承認
  await expect(page.getByText('承認待ちタスク')).toBeVisible();
  await page.getByRole('button', { name: '承認' }).first().click();
  
  // 7. 最終確認
  await expect(page.locator('text=承認しました！').first()).toBeVisible();
});
