# Test de emails antes del deploy

## Email mensual por departamento

### Preview local (sin enviar)
```bash
npm run email:preview
```
Genera `preview-email-mensual.html` en la raíz del proyecto. Abrilo en el browser para ver el template exacto que recibirán los departamentos.

### Envío real a un email de prueba
```bash
npm run email:test -- tuemail@gmail.com
```

> Requiere `BREVO_SMTP_LOGIN` y `BREVO_SMTP_KEY` configurados en `.env`.
> Sin credenciales Brevo, el script solo loguea los datos en consola (modo dev mock).

### Checklist de verificación post-envío

- [ ] El email llega a la bandeja de entrada (no spam)
- [ ] El remitente muestra "HarborFlow"
- [ ] El asunto es claro y descriptivo
- [ ] El header se ve bien (logo + nombre)
- [ ] Los datos del mes son correctos
- [ ] La comparativa con mes anterior funciona
- [ ] Los colores se ven bien en mobile
- [ ] Los textos están en argentino (vos, no tú)
- [ ] El footer tiene la información correcta

## Datos mock usados en los scripts

Los scripts usan datos de prueba representativos:

| Campo              | Valor                 |
|--------------------|-----------------------|
| departamento       | Ingeniería            |
| mes                | Abril 2026            |
| totalViajes        | 42                    |
| asientosUsados     | 187                   |
| asientosVacios     | 23.5                  |
| totalAsientos      | 210.5                 |
| variacionAsientos  | +15 (mes anterior)    |
| companyName        | UABL Puerto Rosario   |

Para cambiar los datos de prueba, editá directamente los archivos
`src/scripts/test-email-mensual.ts` y `src/scripts/preview-email-mensual.tsx`.

## Envío real a todos los departamentos (producción)

El endpoint `POST /api/emails/mensual` envía a todos los departamentos activos
con `emailContacto` configurado. Solo accesible para rol UABL con `isUablAdmin: true`.

```bash
# Mes anterior (default)
curl -X POST https://tudominio.com/api/emails/mensual \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>"

# Mes específico
curl -X POST https://tudominio.com/api/emails/mensual \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"mes": 3, "anio": 2026}'
```
