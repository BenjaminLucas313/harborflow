# Deploy Checklist — HarborFlow en VPS

> Seguir en orden estricto. Cada bloque tiene su verificación antes de continuar.

---

## FASE 0 — Pre-deploy (en tu PC, antes de tocar la VPS)

- [ ] `npm run build` pasa sin errores en local
- [ ] `npx tsc --noEmit` sin errores TypeScript
- [ ] `npm test` — todos los tests pasan
- [ ] `npm audit` revisado — no hay vulnerabilidades críticas sin atender
- [ ] Todos los cambios commiteados y pusheados a `main`
- [ ] `.env` está en `.gitignore` y **no está commiteado**
- [ ] Secretos de producción preparados (nuevos, no los de dev)

---

## FASE 1 — Provisión del servidor

### 1.1 Sistema operativo
- [ ] Ubuntu 22.04 LTS (o 24.04 LTS)
- [ ] Actualizar paquetes: `sudo apt update && sudo apt upgrade -y`

### 1.2 Instalar dependencias del servidor
```bash
# Node.js 20 LTS via nvm (recomendado sobre apt)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Verificar:
node --version   # v20.x.x
npm --version

# PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# PM2 global
sudo npm install -g pm2

# Nginx
sudo apt install nginx -y
```

---

## FASE 2 — Seguridad del servidor

> Ver docs/server-hardening.md para instrucciones detalladas.

- [ ] SSH con clave privada configurado
- [ ] Acceso por contraseña deshabilitado en sshd_config
- [ ] Root login deshabilitado
- [ ] UFW activo (22, 80, 443)
- [ ] Fail2ban instalado y corriendo
- [ ] Usuario `harborflow` creado sin sudo
- [ ] PostgreSQL configurado para escuchar solo en localhost

---

## FASE 3 — Base de datos

```bash
# Crear DB y usuario
sudo -u postgres psql
CREATE USER harborflow WITH PASSWORD 'TU_PASSWORD_FUERTE';
CREATE DATABASE harborflow_prod OWNER harborflow;
GRANT ALL PRIVILEGES ON DATABASE harborflow_prod TO harborflow;
\q

# Verificar conexión:
psql -U harborflow -d harborflow_prod -h localhost
```

- [ ] Base de datos `harborflow_prod` creada
- [ ] Usuario `harborflow` con permisos solo sobre esa DB
- [ ] Conexión verificada desde el usuario de la app

---

## FASE 4 — Código en la VPS

```bash
# Como usuario harborflow
su - harborflow
mkdir -p /home/harborflow/app
cd /home/harborflow/app

# Clonar el repositorio
git clone https://github.com/TU_ORG/harborflow.git .

# Verificar que estamos en main
git branch
```

---

## FASE 5 — Variables de entorno

```bash
# Copiar y editar el archivo de entorno
cp .env.production.example .env
nano .env
# Reemplazar TODOS los valores placeholder
# Verificar: AUTH_SECRET, DATABASE_URL, JOB_SECRET son los más críticos

# Verificar que .env no sea legible por otros usuarios:
chmod 600 .env
```

- [ ] Todos los campos `REEMPLAZAR_*` sustituidos
- [ ] `DATABASE_URL` apunta a `harborflow_prod` con la contraseña correcta
- [ ] `AUTH_SECRET` es un nuevo valor de 64 bytes (nunca el de dev)
- [ ] `JOB_SECRET` generado con `openssl rand -hex 32`
- [ ] `AUTH_URL` y `NEXT_PUBLIC_APP_URL` apuntan a `https://harborflow.app`
- [ ] `NODE_ENV=production`

---

## FASE 6 — Instalación y build

```bash
cd /home/harborflow/app

# Instalar dependencias (incluyendo devDependencies para el build)
npm ci

# Correr migraciones de DB
npx prisma migrate deploy

# Verificar que la DB tiene las tablas esperadas
npx prisma db pull  # solo para verificar, no para modificar

# Build de producción
npm run build
```

- [ ] `npm ci` sin errores
- [ ] `npx prisma migrate deploy` — todas las migraciones aplicadas
- [ ] `npm run build` completa sin errores
- [ ] Carpeta `.next/` creada

---

## FASE 7 — PM2

> Ver docs/pm2-setup.md para instrucciones detalladas.

```bash
# Iniciar la app
pm2 start /home/harborflow/app/ecosystem.config.js

# Verificar que está corriendo
pm2 status
# "harborflow" debe mostrar "online"

# Verificar que responde:
curl http://localhost:3000/api/health
# Debe retornar {"status":"ok"} o similar

# Guardar la lista de procesos
pm2 save

# Configurar autostart (correr como root el comando que imprime pm2 startup)
pm2 startup
```

- [ ] App corriendo en PM2 (status: online)
- [ ] `/api/health` responde 200
- [ ] `pm2 save` ejecutado
- [ ] Autostart configurado

---

## FASE 8 — Nginx + SSL

> Ver docs/nginx-config.md para la configuración completa.

```bash
# Crear configuración
sudo nano /etc/nginx/sites-available/harborflow
# Pegar la configuración del archivo docs/nginx-config.md

sudo ln -s /etc/nginx/sites-available/harborflow /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Obtener certificado SSL
sudo certbot --nginx -d harborflow.app -d www.harborflow.app

# Verificar renovación automática
sudo certbot renew --dry-run
```

- [ ] Nginx corriendo sin errores
- [ ] Certificado SSL obtenido
- [ ] `https://harborflow.app` carga correctamente
- [ ] HTTP redirige a HTTPS

---

## FASE 9 — Verificación funcional

```bash
# Health check
curl -I https://harborflow.app/api/health

# Headers de seguridad
curl -I https://harborflow.app | grep -E "(Strict|X-Content|X-Frame)"

# PM2 logs (sin errores rojos)
pm2 logs harborflow --lines 100
```

Probar en navegador:
- [ ] Página de inicio carga
- [ ] Login funciona (crear usuario admin si es primer deploy)
- [ ] Formularios básicos responden
- [ ] Emails de prueba llegan (si hay configuración SMTP)

---

## FASE 10 — Seed inicial (solo primer deploy)

```bash
cd /home/harborflow/app

# Solo si es un deploy fresh sin datos
npx prisma db seed
```

---

## FASE 11 — Cron jobs (ver docs/crontab-vps.md)

```bash
# Configurar crontab para jobs automáticos
crontab -e
# Agregar las entradas de docs/crontab-vps.md
```

---

## Post-deploy — Monitoreo

- [ ] Sentry recibiendo eventos (ir a sentry.io y verificar que aparece la app)
- [ ] PM2 logs limpios después de 15 minutos en producción
- [ ] Sin errores 500 en Nginx (`sudo tail -f /var/log/nginx/error.log`)

---

## Rollback de emergencia

Si algo falla después del deploy:

```bash
cd /home/harborflow/app

# Volver al commit anterior
git log --oneline -5
git checkout COMMIT_HASH_ANTERIOR

npm ci
npm run build
pm2 reload harborflow

# Si hay migraciones que revertir, hacer rollback manual con Prisma
```

---

## Notas importantes

- **Nunca** correr `prisma migrate dev` en producción — solo `prisma migrate deploy`
- **Nunca** reutilizar secretos de desarrollo en producción
- El `JOB_SECRET` debe estar en `.env` Y en el crontab de la VPS si los jobs se ejecutan via cron
- Después de cada deploy, verificar PM2 status y `/api/health`
