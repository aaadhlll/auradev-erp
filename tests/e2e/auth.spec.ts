import { test, expect } from '@playwright/test'
import { EMAIL, PASSWORD, clearSession } from './helpers'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page)
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 10000 })
  })

  test('shows login page on first load', async ({ page }) => {
    await expect(page.getByPlaceholder('you@store.in')).toBeVisible()
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('shows validation error when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText('Email is required')).toBeVisible()
  })

  test('shows error for invalid email format', async ({ page }) => {
    await page.getByPlaceholder('you@store.in').fill('notanemail')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await page.getByPlaceholder('you@store.in').fill(EMAIL)
    await page.getByPlaceholder('Enter your password').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 })
  })

  test('logs in successfully with valid credentials', async ({ page }) => {
    await page.getByPlaceholder('you@store.in').fill(EMAIL)
    await page.getByPlaceholder('Enter your password').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByRole('heading', { name: 'Hey there,' })).toBeVisible({ timeout: 10000 })
  })

  test('logs out and returns to login screen', async ({ page }) => {
    await page.getByPlaceholder('you@store.in').fill(EMAIL)
    await page.getByPlaceholder('Enter your password').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByRole('heading', { name: 'Hey there,' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /overview/i }).click()
    await expect(page.locator('.sb-logo')).toBeVisible({ timeout: 10000 })

    await page.locator('.sb-user').click()
    await page.getByRole('menuitem', { name: /sign out/i }).click()
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 8000 })
  })
})
