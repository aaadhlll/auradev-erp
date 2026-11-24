import { test, expect, type Page } from '@playwright/test'
import { loginViaApi } from './helpers'

async function ensureOpenShift(page: Page) {
  const action = page.getByRole('button', { name: /^(open shift|shift open|shift overdue)$/i })
  await expect(action).toBeVisible({ timeout: 15000 })
  const label = (await action.textContent())?.trim().toLowerCase()

  if (label === 'shift overdue') {
    await action.click()
    const modal = page.locator('.modal').filter({ hasText: 'Close cashier shift' })
    await expect(modal).toBeVisible()
    await modal.locator('input[type="number"]').fill('0')
    await modal.getByRole('button', { name: /^close shift$/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 15000 })
  }

  const openShift = page.getByRole('button', { name: /^open shift$/i })
  if (await openShift.isVisible().catch(() => false)) {
    await openShift.click()
    const modal = page.locator('.modal').filter({ hasText: 'Open cashier shift' })
    await expect(modal).toBeVisible()
    await modal.locator('input[type="number"]').fill('0')
    await modal.getByRole('button', { name: /^open shift$/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 15000 })
  }

  await expect(page.getByRole('button', { name: /^shift open$/i })).toBeVisible({ timeout: 15000 })
}

test.describe('Point of Sale', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page)
    await page.getByRole('button', { name: /open mercantile modules/i }).click()
    await page.getByRole('button', { name: /point of sale/i }).click()
    await expect(page.locator('.pos-root')).toBeVisible({ timeout: 15000 })
  })

  test('adds an in-stock item and enforces the cashier-shift payment gate', async ({ page }) => {
    const product = page.locator('.prod-card:not(:disabled)').first()
    await expect(product).toBeVisible({ timeout: 15000 })
    await product.click()
    await expect(page.locator('.cart-line')).toHaveCount(1)

    const shiftButton = page.getByRole('button', { name: /^(open shift|shift open|shift overdue)$/i })
    const shiftStatus = (await shiftButton.textContent())?.trim().toLowerCase()

    await page.getByRole('button', { name: /^pay /i }).click()

    if (shiftStatus === 'shift open') {
      await expect(page.getByText('Take payment')).toBeVisible()
      await page.getByRole('button', { name: /cancel/i }).click()
    } else if (shiftStatus === 'shift overdue') {
      await expect(page.getByText('Your cashier shift is overdue. Close it before billing.')).toBeVisible()
    } else {
      await expect(page.getByText('Please open a shift before billing.')).toBeVisible()
    }
  })

  test('completes a cash sale and shows the saved receipt', async ({ page }) => {
    await ensureOpenShift(page)
    const product = page.locator('.prod-card:not(:disabled)').first()
    await expect(product).toBeVisible({ timeout: 15000 })
    await product.click()
    await expect(page.locator('.cart-line')).toHaveCount(1)

    await page.getByRole('button', { name: /^pay /i }).click()
    await expect(page.getByText('Take payment')).toBeVisible()
    await page.getByRole('button', { name: /confirm & save receipt/i }).click()

    await expect(page.getByText('Bill saved')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Total paid')).toBeVisible()
  })

  test('prevents quantities above the available stock', async ({ page }) => {
    const product = page.locator('.prod-card:not(:disabled)').first()
    await expect(product).toBeVisible({ timeout: 15000 })
    await product.click()

    const quantity = page.getByRole('spinbutton', { name: /^quantity for /i })
    await quantity.fill('999999')
    await quantity.blur()

    await expect(page.getByText(/only .* available/i)).toBeVisible({ timeout: 10000 })
  })

  test('opens a completed bill return screen and limits return quantity to the quantity sold', async ({ page }) => {
    await ensureOpenShift(page)
    const product = page.locator('.prod-card:not(:disabled)').first()
    await expect(product).toBeVisible({ timeout: 15000 })
    await product.click()
    await page.getByRole('button', { name: /^pay /i }).click()
    await expect(page.getByText('Take payment')).toBeVisible()
    await page.getByRole('button', { name: /confirm & save receipt/i }).click()
    await expect(page.getByText('Bill saved')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Close' }).press('Enter')

    await page.getByRole('button', { name: /sales bills/i }).click()
    await expect(page.getByRole('heading', { name: 'Sales bills' })).toBeVisible({ timeout: 15000 })

    const firstBill = page.locator('.tbl.tbl-clickable tbody tr:visible').first()
    await expect(firstBill).toBeVisible({ timeout: 15000 })
    await firstBill.click()
    await expect(page.getByRole('button', { name: 'Return items' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Return items' }).click()
    await expect(page.getByText('Original bill')).toBeVisible()

    const returnQuantity = page.locator('.modal input[type="number"]:not(:disabled)').first()
    await expect(returnQuantity).toBeVisible()
    const available = Number(await returnQuantity.getAttribute('max'))
    await returnQuantity.fill(String(available + 1))
    await returnQuantity.blur()

    await expect(page.getByText(/only .* sold unit.* can be returned/i)).toBeVisible({ timeout: 10000 })
    await expect(returnQuantity).toHaveValue(String(available))
  })

  test('creates a controlled return and records it in the returns report', async ({ page }) => {
    await ensureOpenShift(page)
    // Create the bill used for this test first. This avoids depending on old
    // sample bills, which may already have been completely returned.
    const product = page.locator('.prod-card:not(:disabled)').first()
    await expect(product).toBeVisible({ timeout: 15000 })
    await product.click()
    await page.getByRole('button', { name: /^pay /i }).click()
    await expect(page.getByText('Take payment')).toBeVisible()
    await page.getByRole('button', { name: /confirm & save receipt/i }).click()
    await expect(page.getByText('Bill saved')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Close' }).press('Enter')

    await page.getByRole('button', { name: /sales bills/i }).click()
    await expect(page.getByRole('heading', { name: 'Sales bills' })).toBeVisible({ timeout: 15000 })
    await page.locator('.tbl.tbl-clickable tbody tr:visible').first().click()
    await page.getByRole('button', { name: 'Return items' }).click()
    const returnQuantity = page.locator('.modal input[type="number"]:not(:disabled)').first()
    await expect(returnQuantity).toBeVisible()
    await returnQuantity.fill('1')
    await page.locator('.modal input[placeholder*="Damaged"]').fill('UAT controlled return')
    await page.getByRole('button', { name: /^refund /i }).click()

    await expect(page.getByText(/created · refund/i)).toBeVisible({ timeout: 15000 })
    await page.locator('.drawer button[aria-label="Close"]').press('Enter')
    await page.getByRole('button', { name: 'Returns report' }).press('Enter')
    await expect(page.locator('.tbl.tbl-clickable:visible td').filter({ hasText: 'UAT controlled return' }).first()).toBeVisible({ timeout: 15000 })
  })
})
