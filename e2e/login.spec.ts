import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Login', () => {
  test('UABL admin puede entrar y ve su dashboard', async ({ page }) => {
    await loginAs(page, 'uabl')
    await expect(page).toHaveURL(/\/uabl/)
  })

  test('EMPRESA puede entrar y ve su panel', async ({ page }) => {
    await loginAs(page, 'empresa')
    await expect(page).toHaveURL(/\/empresa/)
  })

  test('PROVEEDOR puede entrar y ve su panel', async ({ page }) => {
    await loginAs(page, 'proveedor')
    await expect(page).toHaveURL(/\/proveedor/)
  })

  test('USUARIO puede entrar y ve su panel', async ({ page }) => {
    await loginAs(page, 'usuario')
    // USUARIO role redirects to /usuario or similar dashboard
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('Slug de empresa incorrecto muestra error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#companySlug', 'empresa-que-no-existe')
    await page.fill('#email', 'alguien@ejemplo.com')
    await page.fill('#password', 'cualquier')
    await page.click('button[type="submit"]')

    // The form shows an error via role="alert" on the field error paragraph.
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Contraseña incorrecta muestra error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#companySlug', 'harbor-rosario')
    await page.fill('#email', 'uabl.admin@rosario.dev')
    await page.fill('#password', 'contraseña-incorrecta')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 10_000 })
    // Should stay on login
    await expect(page).toHaveURL(/\/login/)
  })

  // NOTE: No CONDUCTOR-role user in seed. The Driver model (Horacio Ríos) is
  // not linked to a User account. Add one to prisma/seed.ts to enable this.
  test.skip('CONDUCTOR puede entrar y ve sus viajes', async ({ page }) => {
    // Needs: seed a User with role CONDUCTOR and link it to the Driver model via userId.
    // credentials: { email: 'conductor@rosario.dev', password: 'conductor123' }
    await loginAs(page, 'usuario') // placeholder — replace once seed is updated
    await expect(page).toHaveURL(/\/conductor/)
  })
})
