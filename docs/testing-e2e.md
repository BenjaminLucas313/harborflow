# Testing E2E con Playwright

HarborFlow usa [Playwright](https://playwright.dev/) para tests de integración end-to-end de los flujos críticos de la plataforma.

---

## Requisitos previos

1. La base de datos de desarrollo debe estar corriendo y seedeada:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

2. El servidor de desarrollo puede estar corriendo o no — Playwright lo levanta automáticamente si no detecta nada en el puerto 3000.

---

## Comandos

```bash
# Correr todos los tests E2E (headless)
npm run test:e2e

# Correr con UI interactiva de Playwright (debug visual)
npm run test:e2e:ui

# Correr con navegador visible
npm run test:e2e:headed

# Debuggear un test específico paso a paso
npm run test:e2e:debug

# Correr solo un archivo de tests
npx playwright test e2e/login.spec.ts

# Correr solo un test por nombre
npx playwright test --grep "UABL admin puede entrar"
```

---

## Estructura

```
e2e/
├── tsconfig.json              # TypeScript config específico para tests E2E
├── helpers/
│   ├── auth.ts                # loginAs(page, role) — helper de autenticación
│   └── db.ts                  # seedDatabase() — resetea datos entre tests
├── login.spec.ts              # Tests de autenticación por rol
├── proveedor-crea-viaje.spec.ts  # PROVEEDOR crea un viaje nuevo
├── empresa-reserva.spec.ts    # EMPRESA hace reserva grupal
├── uabl-aprueba.spec.ts       # UABL aprueba un PassengerSlot pendiente
└── conductor-checklist.spec.ts   # CONDUCTOR (⚠ requiere seed — ver archivo)
playwright.config.ts           # Configuración de Playwright (raíz del proyecto)
```

---

## Credenciales de test (seed)

Las credenciales vienen de `prisma/seed.ts`. Siempre referenciar ese archivo como fuente de verdad.

| Rol       | Email                        | Password      |
|-----------|------------------------------|---------------|
| UABL      | uabl.admin@rosario.dev       | uabl123       |
| EMPRESA   | empresa@constructora.dev     | empresa123    |
| PROVEEDOR | proveedor@rosario.dev        | proveedor123  |
| USUARIO   | juan.perez@rosario.dev       | usuario123    |
| CONDUCTOR | ⚠ No en seed — ver nota abajo |               |

> **Nota sobre CONDUCTOR:** El seed crea el modelo `Driver` (Horacio Ríos) pero no un `User` con `role=CONDUCTOR` vinculado via `Driver.userId`. Los tests de conductor están marcados como `test.skip`. Ver `e2e/conductor-checklist.spec.ts` para instrucciones de cómo agregar el usuario al seed.

---

## Cómo agregar un test nuevo

1. Crear un archivo `e2e/mi-feature.spec.ts`
2. Importar los helpers:
   ```typescript
   import { test, expect } from '@playwright/test'
   import { loginAs } from './helpers/auth'
   ```
3. Estructurar con `test.describe` y `test.beforeEach` para el login:
   ```typescript
   test.describe('Mi Feature', () => {
     test.beforeEach(async ({ page }) => {
       await loginAs(page, 'uabl') // o el rol que corresponda
     })

     test('descripción del comportamiento esperado', async ({ page }) => {
       await page.goto('/mi-ruta')
       await expect(page.getByRole('heading', { name: /título/i })).toBeVisible()
     })
   })
   ```

---

## Ver resultados del último run

```bash
npx playwright show-report
```

El reporte HTML se genera en `playwright-report/` (ignorado por git).

---

## Configuración actual

- **Browser:** Solo Chromium (Firefox y WebKit se agregan cuando los flows estén estables)
- **Workers:** 1 (secuencial — todos los tests comparten la misma DB de desarrollo)
- **Retries:** 0 en local, 2 en CI
- **webServer:** Playwright levanta `npm run dev` si no hay server en :3000
- **reuseExistingServer:** `true` en local, `false` en CI

---

## Consideraciones para CI

Cuando se configure CI (GitHub Actions), setear `CI=true`:
```yaml
- name: Run E2E tests
  run: npx playwright test
  env:
    CI: true
    DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
```

Con `CI=true`:
- `reuseExistingServer: false` → Playwright siempre levanta un server fresco
- `retries: 2` → reintenta tests inestables
- `forbidOnly: true` → falla si quedó algún `test.only` accidental
