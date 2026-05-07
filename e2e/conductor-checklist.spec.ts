import { test } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// CONDUCTOR — Checklist de embarque
//
// These tests are SKIPPED because the seed (prisma/seed.ts) does not create a
// User with role=CONDUCTOR linked to the Driver model.
//
// To enable: add a CONDUCTOR user to the seed and link it to the existing
// Driver (Horacio Ríos) via the Driver.userId field.
//
// Example seed addition:
//
//   const conductorUser = await prisma.user.upsert({
//     where:  { companyId_email: { companyId: company.id, email: 'conductor@rosario.dev' } },
//     update: { passwordHash: hash },
//     create: {
//       companyId,
//       email:        'conductor@rosario.dev',
//       passwordHash: await bcrypt.hash('conductor123', ROUNDS),
//       firstName:    'Horacio',
//       lastName:     'Ríos',
//       role:         'CONDUCTOR',
//       isActive:     true,
//     },
//   })
//
//   await prisma.driver.update({
//     where: { id: driver.id },
//     data:  { userId: conductorUser.id },
//   })
//
// After that, update auth.ts to add:
//   conductor: { email: 'conductor@rosario.dev', password: 'conductor123' }
// ─────────────────────────────────────────────────────────────────────────────

test.describe('CONDUCTOR — Checklist de embarque', () => {
  test.skip(true, 'Requiere usuario CONDUCTOR en el seed — ver comentario en este archivo')

  test('Ve su próximo viaje asignado en el dashboard', async ({ page }) => {
    // loginAs(page, 'conductor')
    await page.goto('/conductor')
    // expect next trip card to be visible
  })

  test('Accede al checklist de un viaje y marca pasajeros', async ({ page }) => {
    // loginAs(page, 'conductor')
    await page.goto('/conductor')
    // click on the first trip
    // verify checklist items appear
    // mark all checkboxes
    // verify counter shows "X / Y presentes"
  })

  test('Confirma la salida y ve mensaje con timestamp', async ({ page }) => {
    // loginAs(page, 'conductor')
    // navigate to trip checklist
    // click "Todos abordaron" or "Confirmar salida"
    // confirm in dialog
    // verify success message with timestamp
  })
})
