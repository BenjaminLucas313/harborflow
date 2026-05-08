import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { seedDatabase } from './helpers/db'

test.describe('UABL — Aprobar PassengerSlot', () => {
  // Re-seed so future trips and PENDING slots exist.
  test.beforeAll(async () => {
    await seedDatabase()
  })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'uabl')
  })

  test('Ve la lista de viajes programados', async ({ page }) => {
    await page.goto('/uabl/viajes')
    await expect(page.getByRole('heading', { name: /viajes programados/i })).toBeVisible()
  })

  test('Aprueba un slot pendiente y el badge cambia a Confirmado', async ({ page }) => {
    await page.goto('/uabl/viajes')

    // Seed has Trip 1 (mañana 08:00) with 2 PENDING PassengerSlots.
    // Target trip detail links specifically — avoids matching navbar/other links.
    const firstTripLink = page.locator('a[href*="/uabl/viajes/"]').first()
    await firstTripLink.click()

    // Should navigate to /uabl/viajes/[tripId]
    await page.waitForURL(/\/uabl\/viajes\/[^/]+$/, { timeout: 10_000 })

    // Count "Confirmar" buttons before clicking.
    // NOTE: the UABL admin (Operaciones dept) only sees slots from their department,
    // so the count here may be less than the total slots in the seed.
    const confirmarBtns = page.getByRole('button', { name: /^confirmar$/i })
    const countBefore = await confirmarBtns.count()
    expect(countBefore).toBeGreaterThan(0)

    // Click the first Confirmar button.
    await confirmarBtns.first().click()

    // After confirmation, the card shows a "Confirmado" status badge.
    await expect(page.getByText('Confirmado').first()).toBeVisible({ timeout: 8_000 })

    // One fewer "Confirmar" button should remain after approving.
    await expect(confirmarBtns).toHaveCount(countBefore - 1, { timeout: 5_000 })
  })
})
