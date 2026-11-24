import { test, expect } from '@playwright/test'
import { loginViaApi } from './helpers'

test.describe('Inventory', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page)
    await page.getByRole('button', { name: /open mercantile modules/i }).click()
    await page.getByRole('button', { name: /^inventory/i }).click()
    await page.getByRole('button', { name: /^master/i }).click()
    await page.getByRole('button', { name: /item master/i }).click()
    await expect(page.locator('.sb-nav.active')).toContainText('Item master')
  })

  test('inventory page loads without error', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('inventory list renders items', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    const rows = page.locator('table:visible tbody tr, [class*="inv-row"], [class*="product-row"]')
    await expect(rows.first()).toBeVisible({ timeout: 8000 })
  })

  test('search field is present and accepts input', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i).first()
    await expect(search).toBeVisible()
    await search.fill('sugar')
    await search.clear()
  })
})
