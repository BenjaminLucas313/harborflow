import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

// Helper: build a future datetime string for the datetime-local input.
// Format required: "YYYY-MM-DDTHH:MM"
function futureDatetime(daysOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"
}

test.describe('PROVEEDOR — Crear viaje', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'proveedor')
  })

  test('Crea un viaje con paradas y aparece en la lista', async ({ page }) => {
    await page.goto('/proveedor/viajes/nuevo')

    // The form labels are NOT associated via for/id, but they are direct siblings
    // of the select/input inside a div.space-y-1 container.
    // Selector strategy: label:has-text("X") + select (CSS adjacent sibling).

    // Puerto — pre-selected with branches[0] (Puerto Rosario in seed)
    // No action needed unless the select has no default.

    // Embarcación — required. Select the first real option (index 1 skips the placeholder).
    await page
      .locator('label:has-text("Embarcación") + select')
      .selectOption({ index: 1 })

    // Conductor — selectOption accepts only plain strings, not RegExp.
    await page
      .locator('label:has-text("Conductor") + select')
      .selectOption({ label: 'Horacio Ríos' })

    // Salida — required, 3 days from now at 16:00
    const departure = futureDatetime(3, 16, 0)
    await page.locator('input[type="datetime-local"]').first().fill(departure)

    // Arrival — optional, 1 hour after departure
    const arrival = futureDatetime(3, 17, 0)
    await page.locator('input[type="datetime-local"]').nth(1).fill(arrival)

    // Stops: origin and destination are pre-rendered as inputs
    await page.locator('input[placeholder="Punto de salida"]').fill('Puerto Rosario')
    await page.locator('input[placeholder="Punto de llegada"]').fill('Buque 7')

    // Submit
    await page.click('button[type="submit"]')

    // After success the form redirects to /proveedor/viajes
    await page.waitForURL(/\/proveedor\/viajes$/, { timeout: 15_000 })

    // Verify the new trip appears in the list (check for "Buque 7" stop name
    // or the boat name "Lancha Río Grande")
    await expect(page.getByText('Lancha Río Grande').first()).toBeVisible()
  })
})
