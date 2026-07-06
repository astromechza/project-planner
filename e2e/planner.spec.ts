import { expect, test } from '@playwright/test';

test('plans, recovers, exports, and imports a local project', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add initiative' }).click();
  await page.getByLabel('Task title').fill('Launch Initiative');

  await page.getByRole('button', { name: 'Add child' }).click();
  await page.getByLabel('Task title').fill('Foundation Epic');

  const foundationEpic = page.getByRole('treeitem', {
    name: 'Foundation Epic',
  });
  await foundationEpic.press('Shift+Tab');
  await expect(foundationEpic).toHaveAttribute('aria-level', '1');
  await foundationEpic.press('Tab');
  await expect(foundationEpic).toHaveAttribute('aria-level', '2');

  await page.getByLabel('Blocked by').selectOption({
    label: 'Launch Initiative',
  });
  await page.getByRole('button', { name: 'Add blocker' }).click();

  const initiative = page.getByRole('treeitem', {
    name: 'Launch Initiative',
  });
  await expect(initiative).toHaveClass(/task-row--blocks-selected/);
  await expect(foundationEpic).toHaveAttribute('aria-selected', 'true');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  const exportedProjectPath = await download.path();

  await page.reload();
  await page.getByRole('button', { name: 'Expand Launch Initiative' }).click();
  await expect(foundationEpic).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New plan' }).click();
  await expect(foundationEpic).toHaveCount(0);

  await page
    .getByLabel('Import project file')
    .setInputFiles(exportedProjectPath);
  await expect(foundationEpic).toBeVisible();
});
