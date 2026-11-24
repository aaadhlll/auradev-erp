import { test, expect } from '@playwright/test'
import { loginViaApi } from './helpers'

test.describe('Purchases', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page)
    await page.getByRole('button', { name: /open mercantile modules/i }).click()
    await page.getByRole('button', { name: /^procurement/i }).click()
    await page.getByRole('button', { name: /^transactions/i }).click()
    await page.getByRole('button', { name: /purchase orders/i }).click()
    await expect(page.locator('.sb-nav.active')).toContainText('Purchase orders')
    await page.waitForLoadState('networkidle')
  })

  // ── Page structure ────────────────────────────────────────────────────────────

  test('purchases page loads without error', async ({ page }) => {
    await expect(page.getByText('Purchase orders').first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('KPI cards are all visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /total orders/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /new drafts/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /awaiting delivery/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /completed/i })).toBeVisible()
  })

  test('sidebar opens Supplier master', async ({ page }) => {
    await page.getByRole('button', { name: /^master/i }).click()
    await page.getByRole('button', { name: /supplier master/i }).click()
    await expect(page.locator('.sb-nav.active')).toContainText('Supplier master')
  })

  // ── Purchase bills list ───────────────────────────────────────────────────────

  test('purchase list renders rows', async ({ page }) => {
    const rows = page.locator('table:visible tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 8000 })
  })

  test('search field is present and accepts input', async ({ page }) => {
    const search = page.getByPlaceholder('Search purchase order ID…')
    await expect(search).toBeVisible()
    await search.fill('PO')
    await search.clear()
  })

  test('supplier filter dropdown is present', async ({ page }) => {
    await expect(page.getByText('All suppliers')).toBeVisible()
  })

  test('status filter is present', async ({ page }) => {
    await expect(page.getByText('All statuses')).toBeVisible()
  })

  // ── Row click → detail drawer ─────────────────────────────────────────────────

  test('clicking a purchase row opens the detail drawer', async ({ page }) => {
    const firstRow = page.locator('table:visible tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 8000 })
    await firstRow.click()
    // drawer shows purchase number and supplier info
    await expect(page.locator('.drawer-overlay')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Grand total')).toBeVisible()
    await expect(page.getByText('Line items')).toBeVisible()
  })

  test('detail drawer closes with the close button', async ({ page }) => {
    const firstRow = page.locator('table:visible tbody tr').first()
    await firstRow.click()
    await expect(page.locator('.drawer-overlay')).toBeVisible({ timeout: 8000 })
    // Next.js development tools can sit above the page in local development.
    // Keyboard activation still verifies the actual accessible Close control.
    await page.getByRole('button', { name: 'Close' }).press('Enter')
    await expect(page.locator('.drawer-overlay')).not.toBeVisible()
  })

  test('detail drawer closes when pressing Escape', async ({ page }) => {
    const firstRow = page.locator('table:visible tbody tr').first()
    await firstRow.click()
    await expect(page.locator('.drawer-overlay')).toBeVisible({ timeout: 8000 })
    await page.keyboard.press('Escape')
    await expect(page.locator('.drawer-overlay')).not.toBeVisible()
  })

  // ── Create purchase button ────────────────────────────────────────────────────

  test('Create new button is visible and opens the form modal', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create new/i })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(page.locator('.overlay')).toBeVisible({ timeout: 6000 })
    await page.keyboard.press('Escape')
  })

  // ── Supplier master ────────────────────────────────────────────────────────────

  test('switching to Supplier master shows supplier list', async ({ page }) => {
    await page.getByRole('button', { name: /^master/i }).click()
    await page.getByRole('button', { name: /supplier master/i }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.sb-nav.active')).toContainText('Supplier master')
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('Add supplier button appears in Supplier master', async ({ page }) => {
    await page.getByRole('button', { name: /^master/i }).click()
    await page.getByRole('button', { name: /supplier master/i }).click()
    await expect(page.getByRole('button', { name: /add supplier/i }).first()).toBeVisible()
  })
})
