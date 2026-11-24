import { test, expect } from '@playwright/test'
import { loginViaApi } from './helpers'

async function openModule(page: import('@playwright/test').Page, name: RegExp) {
  await page.getByRole('button', { name: /open mercantile modules/i }).click()
  await page.getByRole('button', { name }).click()
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page)
  })

  test('dashboard is the default active view', async ({ page }) => {
    await expect(page.locator('.sb-nav.active')).toContainText('Dashboard')
  })

  test('navigates to Billing / POS', async ({ page }) => {
    await openModule(page, /point of sale/i)
    await page.getByRole('button', { name: 'Billing / POS' }).click()
    await expect(page.locator('.sb-nav.active')).toContainText('Billing / POS')
  })

  test('navigates to Sales bills', async ({ page }) => {
    await openModule(page, /point of sale/i)
    await page.getByRole('button', { name: 'Sales bills' }).click()
    await expect(page.locator('.sb-nav.active')).toContainText('Sales bills')
  })

  test('navigates to Inventory', async ({ page }) => {
    await openModule(page, /^inventory/i)
    await page.getByRole('button', { name: /^master/i }).click()
    await page.getByRole('button', { name: /item master/i }).click()
    await expect(page.locator('.sb-nav.active')).toContainText('Item master')
  })

  test('navigates to Purchase orders', async ({ page }) => {
    await openModule(page, /^procurement/i)
    await page.getByRole('button', { name: /^transactions/i }).click()
    await page.getByRole('button', { name: /purchase orders/i }).click()
    await expect(page.locator('.sb-nav.active')).toContainText('Purchase orders')
  })

  test('sidebar shows logged-in user name', async ({ page }) => {
    await expect(page.locator('.sb-user .n')).not.toBeEmpty()
  })
})
