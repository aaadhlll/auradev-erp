import { expect, type Page } from '@playwright/test'

export const EMAIL = 'admin@nenjankod.in'
export const PASSWORD = process.env.TEST_PASSWORD ?? 'Admin@123'
const API_BASE = 'http://localhost:8080'

/**
 * Clears auth tokens before the page hydrates (addInitScript runs before JS),
 * then navigates so the login screen is guaranteed to appear.
 */
export async function clearSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('erp_access_token')
    localStorage.removeItem('erp_refresh_token')
  })
  await page.goto('/')
  // Wait for Turbopack to finish compiling and React to hydrate
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 20000 })
}

/**
 * Login via backend API (fast — no UI), set tokens in localStorage,
 * then reload into the app and wait for the sidebar to appear.
 */
export async function loginViaApi(page: Page) {
  let res = await page.request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
    timeout: 15000,
  })

  // A user may be edited in a browser while local tests begin. The API is
  // designed to handle that safely; this small retry also prevents a transient
  // in-flight update from making the whole browser suite flaky.
  for (let attempt = 0; !res.ok() && res.status() === 409 && attempt < 2; attempt += 1) {
    await page.waitForTimeout(300 * (attempt + 1))
    res = await page.request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
      timeout: 15000,
    })
  }

  if (!res.ok()) {
    throw new Error(`Login API returned ${res.status()}: ${await res.text()}`)
  }

  const data = await res.json()

  await page.addInitScript(
    ({ access, refresh }: { access: string; refresh: string }) => {
      localStorage.setItem('erp_access_token', access)
      localStorage.setItem('erp_refresh_token', refresh)
    },
    { access: data.accessToken, refresh: data.refreshToken },
  )

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // Successful sign-in opens the Module Hub. Choose Overview for tests that
  // start from the regular application shell.
  await expect(page.getByRole('heading', { name: 'Hey there,' })).toBeVisible({ timeout: 30000 })
  await page.getByRole('button', { name: /overview/i }).click()
  // 2500ms splash + hydration — give it 30s total
  await expect(page.locator('.sb-logo')).toBeVisible({ timeout: 30000 })
}
