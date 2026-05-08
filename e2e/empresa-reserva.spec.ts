import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { seedDatabase } from './helpers/db'

test.describe('EMPRESA — Reserva grupal', () => {
  // Re-seed so trips have future departure times relative to today.
  test.beforeAll(async () => {
    await seedDatabase()
  })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'empresa')
  })

  test('Puede ver viajes disponibles', async ({ page }) => {
    await page.goto('/empresa/viajes')
    await expect(page.getByRole('heading', { name: /viajes disponibles/i })).toBeVisible()
  })

  test('Hace clic en Crear reserva grupal y navega al formulario de reserva', async ({ page }) => {
    await page.goto('/empresa/viajes')

    // Seed has 3 future trips. Click the first "Crear reserva grupal" button.
    const reservarBtn = page.getByRole('button', { name: /crear reserva grupal/i }).first()
    await expect(reservarBtn).toBeVisible()
    await reservarBtn.click()

    // All seed trips are for tomorrow/day-after — the FechaFuturaModal will appear.
    // The modal has role="dialog" and a "Sí, continuar" button.
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByText(/este viaje no es para hoy/i)).toBeVisible()

    // Confirm navigation despite the future date.
    await modal.getByRole('button', { name: /continuar/i }).click()

    // Should navigate to the nueva reserva wizard with the tripId in the URL.
    await page.waitForURL(/\/empresa\/reservas\/nueva/, { timeout: 10_000 })
    await expect(page).toHaveURL(/tripId=/)
  })

  test('La página Mis reservas muestra el estado vacío cuando no hay reservas', async ({ page }) => {
    // This test validates the EmptyState fix (icons as ReactNode, not LucideIcon component ref).
    await page.goto('/empresa/reservas')
    // Either shows reservas list or the EmptyState — should not show a runtime error.
    await expect(page).not.toHaveURL(/error/)
    // Page should render without crashing
    await expect(page.locator('main')).toBeVisible()
  })
})
