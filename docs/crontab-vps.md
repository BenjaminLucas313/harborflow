# Configuración de cron jobs en VPS

## Prerequisitos

- HarborFlow corriendo en la VPS (PM2 o similar)
- `JOB_SECRET` configurado en las variables de entorno de producción
- `curl` instalado (`apt install curl` en Debian/Ubuntu)

## Crear carpeta de logs

```bash
sudo mkdir -p /var/log/harborflow
sudo chown $USER:$USER /var/log/harborflow
```

## Instalar en crontab

```bash
crontab -e
```

Agregar las siguientes líneas (reemplazar `TUDOMINIO` y `TU_SECRET`):

```cron
# ─── HarborFlow jobs ──────────────────────────────────────────────────────────

# Cierre mensual — 00:00 Argentina (03:00 UTC) días 28-31
# Corre en los últimos días del mes; el check de idempotencia evita doble ejecución.
0 3 28-31 * * curl -s -X POST https://TUDOMINIO/api/jobs/cierre-mensual \
  -H "X-Job-Secret: TU_SECRET" \
  -H "Content-Type: application/json" \
  >> /var/log/harborflow/cierre-mensual.log 2>&1

# Actualizar viajes pasados — cada hora
0 * * * * curl -s -X POST https://TUDOMINIO/api/jobs/update-past-trips \
  -H "X-Job-Secret: TU_SECRET" \
  >> /var/log/harborflow/update-trips.log 2>&1

# Viajes automatizados — 01:00 Argentina (04:00 UTC)
0 4 * * * curl -s -X POST https://TUDOMINIO/api/jobs/crear-viajes-automatizados \
  -H "X-Job-Secret: TU_SECRET" \
  >> /var/log/harborflow/viajes-auto.log 2>&1
```

> **Nota sobre el cierre mensual en días 28-31:**
> En meses cortos (febrero termina el 28 o 29), cron simplemente no ejecuta el job en
> los días que no existen — comportamiento correcto de cron estándar.
> La idempotencia en el job garantiza que solo la primera ejecución exitosa del mes
> realiza el trabajo; las restantes responden 200 "ya realizado".

## Rotar logs (logrotate)

Crear `/etc/logrotate.d/harborflow`:

```
/var/log/harborflow/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 root root
}
```

## Verificar ejecución

```bash
# Ver log del cierre mensual en tiempo real
tail -f /var/log/harborflow/cierre-mensual.log

# Ver las últimas ejecuciones registradas
tail -n 50 /var/log/harborflow/cierre-mensual.log

# Listar los crons activos
crontab -l

# Probar el job manualmente (sin esperar al cron)
curl -s -X POST https://TUDOMINIO/api/jobs/cierre-mensual \
  -H "X-Job-Secret: TU_SECRET" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

## Variables de entorno requeridas en producción

| Variable | Descripción |
|---|---|
| `JOB_SECRET` | Secret compartido entre cron y la API. Generarlo con `openssl rand -hex 32`. |
| `ANTHROPIC_API_KEY` | Requerida para el informe narrativo (PASO D del cierre mensual). |
| `BREVO_SMTP_LOGIN` | SMTP login para envío de emails. |
| `BREVO_SMTP_KEY` | SMTP key de Brevo. |
| `DATABASE_URL` | Conexión a PostgreSQL. |

## Generar un JOB_SECRET seguro

```bash
openssl rand -hex 32
```

Agregar al archivo `.env` en la VPS:

```env
JOB_SECRET=<output del comando anterior>
```
