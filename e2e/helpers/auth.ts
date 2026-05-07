import type { Page } from '@playwright/test'

// Company slug used for all seed data.
const COMPANY_SLUG = 'harbor-rosario'

type Role = 'uabl' | 'empresa' | 'proveedor' | 'usuario'

// Credentials match prisma/seed.ts exactly.
// NOTE: There is no CONDUCTOR-role user in the seed. The Driver model (Horacio Ríos)
// is separate from User accounts. Add a conductor user to the seed before enabling
// conductor tests.
const CREDENTIALS: Record<Role, { email: string; password: string }> = {
  uabl:      { email: 'uabl.admin@rosario.dev',   password: 'uabl123'      },
  empresa:   { email: 'empresa@constructora.dev', password: 'empresa123'   },
  proveedor: { email: 'proveedor@rosario.dev',    password: 'proveedor123' },
  usuario:   { email: 'juan.perez@rosario.dev',   password: 'usuario123'   },
}

/**
 * Logs in as the given role via the UI login form.
 * Waits until the browser leaves /login before returning.
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const cred = CREDENTIALS[role]

  await page.goto('/login')

  // The login form has three fields: companySlug, email, password.
  // Fields use id attributes — use them for reliable targeting.
  await page.fill('#companySlug', COMPANY_SLUG)
  await page.fill('#email', cred.email)
  await page.fill('#password', cred.password)
  await page.click('button[type="submit"]')

  // After successful login, Next.js does a hard navigation via window.location.replace()
  // to the role dashboard. Wait until we're no longer on /login.
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15_000,
  })
}
