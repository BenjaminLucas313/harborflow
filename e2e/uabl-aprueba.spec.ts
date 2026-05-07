import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('UABL — Aprobar PassengerSlot', () => {
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
    // Click on the first trip link to open its detail.
    const firstTripLink = page.getByRole('link').filter({ has: page.locator('p') }).first()
    await firstTripLink.click()

    // Should navigate to /uabl/viajes/[tripId]
    await page.waitForURL(/\/uabl\/viajes\/[^/]+$/, { timeout: 10_000 })

    // Find the first "Confirmar" button (from SlotReviewCard).
    // The button has text "Confirmar" with a CheckCircle2 icon.
    const confirmarBtn = page.getByRole('button', { name: /confirmar/i }).first()
    await expect(confirmarBtn).toBeVisible({ timeout: 8_000 })
    await confirmarBtn.click()

    // After confirmation, the card shows a "Confirmado" status badge.
    // The badge transitions: button disappears, emerald badge appears.
    await expect(page.getByText('Confirmado').first()).toBeVisible({ timeout: 8_000 })

    // The "Confirmar" button for the approved slot should be gone.
    // (Other pending slots may still show it — use strict count check.)
    const confirmarBtns = page.getByRole('button', { name: /^confirmar$/i })
    // We started with 2 pending slots → after approving 1 → at most 1 remains.
    await expect(confirmarBtns).toHaveCount(1, { timeout: 5_000 })
  })
})
