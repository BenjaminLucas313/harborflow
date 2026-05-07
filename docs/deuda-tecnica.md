# Deuda técnica de seguridad

> Última revisión: 2026-05-07

---

## Sin fix upstream — monitorear

### `xlsx` — Prototype Pollution + ReDoS

- **CVEs:** GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9
- **Severidad:** Alta
- **Usado en:** [src/scripts/cargar-usuarios-excel.ts](../src/scripts/cargar-usuarios-excel.ts)
- **Riesgo real:** Bajo — el script lo corre exclusivamente un administrador con archivos que ellos mismos preparan. No hay carga de archivos Excel desde usuarios externos o endpoints HTTP.
- **Mitigación existente:** Validación de filas antes de procesar en el script; el archivo nunca se expone en ningún endpoint HTTP.
- **Acción:** Revisar trimestralmente si SheetJS lanza fix. Evaluar migrar a `exceljs` (alternativa mantenida activamente) si el riesgo escala.
- **Próxima revisión:** 2026-08-07

---

### `nodemailer` (vía `next-auth` / `@auth/core`) — SMTP command injection

- **CVEs:** GHSA-c7w3-x93f-qmm8 (envelope.size), GHSA-vvjj-xcjg-gr5g (CRLF en EHLO/HELO)
- **Severidad:** Moderada
- **Usado en:** Envío de emails transaccionales vía Brevo SMTP (bienvenida, notificaciones, recuperación de contraseña)
- **Riesgo real:** Bajo — Brevo SMTP no expone al atacante los campos vulnerables (`envelope.size`, transport name). La explotación requiere control sobre esos campos internos del transport, que en esta app son constantes definidas en código.
- **Mitigación existente:** Los campos SMTP son hardcodeados; ningún input de usuario llega al constructor del transport.
- **Fix `--force`:** Instalaría `next-auth@1.12.1` (breaking — la app usa v5 beta, incompatible).
- **Acción:** Monitorear releases de `next-auth` v5 estable. Cuando salga de beta debería traer versión actualizada de `nodemailer`.
- **Próxima revisión:** 2026-08-07

---

## Breaking changes pendientes (no bloquean producción inicial)

### `next` — DoS con Server Components + `postcss` XSS

- **CVEs:** GHSA-q4gf-8mx6-v5v3 (Next.js DoS), GHSA-qx2v-qp2m-jg93 (PostCSS XSS)
- **Fix disponible:** `npm audit fix --force` — instala `next@9.3.3` (downgrade fuera del rango declarado, incompatible)
- **Por qué no ahora:** El fix sugiere un downgrade masivo. La vía correcta es actualizar Next.js al último release estable en el rango `latest`. Requiere validar compatibilidad con `next-pwa`, `next-intl`, `next-auth` beta, y todos los Server Components existentes. Riesgo de regresión alto sin testing E2E.
- **Plan:** Rama dedicada `chore/next-major-upgrade`, testing E2E completo antes de mergear. Hacer dentro de los primeros 30 días post-deploy.
- **Prioridad:** Alta.

### `next-pwa` 2.0.2 — `serialize-javascript` RCE/DoS

- **CVEs:** GHSA-5c6j-r48x-rmvq (RCE via RegExp), GHSA-qj8w-gfj5-8c6v (CPU Exhaustion DoS)
- **Fix disponible:** `npm audit fix --force` — instala `next-pwa@2.0.2` (breaking, API diferente)
- **Por qué no ahora:** `next-pwa` 2.x tiene cambios de API que requieren actualizar `next.config.js` y validar que el Service Worker siga funcionando correctamente (offline, caché).
- **Contexto de riesgo:** La vulnerabilidad está en código de build-time (`workbox-build`), **no en runtime de producción**. No es explotable por usuarios de la app.
- **Plan:** Incluir en la misma rama `chore/next-major-upgrade`.

### `@anthropic-ai/sdk` 0.95.1 — Insecure file permissions en Memory Tool

- **CVE:** GHSA-p7fg-763f-g4gf
- **Fix disponible:** `npm audit fix --force` — instala `@anthropic-ai/sdk@0.95.1` (breaking)
- **Por qué no ahora:** Puede cambiar tipos exportados y la API del assistant UABL. Requiere verificar compatibilidad.
- **Riesgo real:** Muy bajo — la vulnerabilidad es sobre permisos de archivos en la herramienta "Local Filesystem Memory", que esta app no usa. El assistant UABL usa streaming de mensajes sin filesystem.
- **Plan:** Actualizar en rama separada, verificar el assistant UABL con las nuevas interfaces de la SDK.

### `@hono/node-server` (vía `prisma` dev) — Middleware bypass

- **CVE:** GHSA-92pp-h63x-v22m
- **Afecta:** Herramientas de desarrollo de Prisma (`@prisma/dev`), **no el runtime de producción**.
- **Fix disponible:** `npm audit fix --force` — instala `prisma@6.19.3` (breaking)
- **Por qué no ahora:** Cambio de versión mayor de Prisma requiere validar todas las queries, relaciones, y migraciones existentes.
- **Riesgo real:** Nulo en producción — `@prisma/dev` solo se usa en herramientas de desarrollo.

---

## Vulnerabilidades resueltas — 2026-05-07

Resueltas con `npm audit fix` (sin breaking changes). De 22 vulnerabilidades bajamos a 16.

| Paquete | CVEs resueltos | Severidad |
|---------|---------------|-----------|
| `defu` | GHSA-737v-mqg7-c878 (Prototype Pollution) | Alta |
| `hono` | GHSA-26pp-8wgv-hjvm, GHSA-r5rp-j6wh-rvv4, GHSA-xf4j-xp2r-rqqx, GHSA-wmmm-f939-6g9c, GHSA-458j-xx4x-4375, GHSA-xpcf-pg52-r92g, GHSA-9vqf-7f2p-gf9v, GHSA-69xw-7hcm-h432 | Moderada |
| `next-intl` | GHSA-8f24-v5vv-gm5j, GHSA-4c35-wcg5-mm9h | Moderada |
| `ip-address` / `express-rate-limit` | GHSA-v2v4-37r5-5v8g (XSS en Address6) | Moderada |
| `icu-minify` / `mcp-data-vis` | GHSA-r27j-894h-3w3p (DoS via Object.prototype) | Moderada |
