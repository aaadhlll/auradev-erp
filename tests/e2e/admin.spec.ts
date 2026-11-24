import { test, expect } from '@playwright/test'
import { loginViaApi } from './helpers'

test.describe('Admin profile & Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page)
  })

  // ── Profile menu ──────────────────────────────────────────────────────────────

  test('profile button is visible in sidebar', async ({ page }) => {
    await expect(page.locator('.sb-user')).toBeVisible()
  })

  test('clicking profile opens the user menu', async ({ page }) => {
    await page.locator('.sb-user').click()
    await expect(page.locator('.sb-user-menu')).toBeVisible()
  })

  test('user menu shows name, email and role', async ({ page }) => {
    await page.locator('.sb-user').click()
    await expect(page.locator('.sb-user-menu .who .n')).not.toBeEmpty()
    await expect(page.locator('.sb-user-menu .who .e')).not.toBeEmpty()
    await expect(page.locator('.sb-user-menu .who .r')).not.toBeEmpty()
  })

  test('user menu has Settings and Sign out options', async ({ page }) => {
    await page.locator('.sb-user').click()
    await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible()
  })

  test('clicking outside closes the user menu', async ({ page }) => {
    await page.locator('.sb-user').click()
    await expect(page.locator('.sb-user-menu')).toBeVisible()
    await page.locator('.sb-brand').click()
    await expect(page.locator('.sb-user-menu')).not.toBeVisible()
  })

  // ── Navigating to Settings ─────────────────────────────────────────────────────

  test('Settings menu item navigates to Settings page', async ({ page }) => {
    await page.locator('.sb-user').click()
    await page.getByRole('menuitem', { name: /settings/i }).click()
    await expect(page.getByRole('button', { name: /store profile/i })).toBeVisible({ timeout: 8000 })
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  // ── Settings page structure ───────────────────────────────────────────────────

  test.describe('Settings page', () => {
    test.beforeEach(async ({ page }) => {
      await loginViaApi(page)
      await page.locator('.sb-user').click()
      await page.getByRole('menuitem', { name: /settings/i }).click()
      await expect(page.getByRole('button', { name: /store profile/i })).toBeVisible({ timeout: 8000 })
    })

    test('settings nav shows all sections', async ({ page }) => {
      await expect(page.getByRole('button', { name: /store profile/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /billing & pos/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /receipt output/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /team access/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /activity log/i })).toBeVisible()
    })

    test('Store Profile section loads by default', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('button', { name: /store profile/i })).toHaveClass(/\bactive\b/)
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    })

    test('switching to Billing & POS section works', async ({ page }) => {
      await page.getByRole('button', { name: /billing & pos/i }).click()
      await expect(page.getByRole('button', { name: /billing & pos/i })).toHaveClass(/\bactive\b/)
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    })

    test('switching to Receipt output section works', async ({ page }) => {
      await page.getByRole('button', { name: /receipt output/i }).click()
      await expect(page.getByRole('button', { name: /receipt output/i })).toHaveClass(/\bactive\b/)
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    })

    test('Team access section shows team members table', async ({ page }) => {
      await page.getByRole('button', { name: /team access/i }).click()
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('button', { name: /team access/i })).toHaveClass(/\bactive\b/)
      await expect(page.locator('table:visible tbody tr').first()).toBeVisible({ timeout: 8000 })
    })

    test('Team access section has Add user button', async ({ page }) => {
      await page.getByRole('button', { name: /team access/i }).click()
      await expect(page.getByRole('button', { name: /add user/i })).toBeVisible()
    })

    test('Activity log section loads entries', async ({ page }) => {
      await page.getByRole('button', { name: /activity log/i }).click()
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('button', { name: /activity log/i })).toHaveClass(/\bactive\b/)
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    })
  })
})
