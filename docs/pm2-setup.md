# PM2 — Setup y gestión del proceso en producción

PM2 es el process manager que mantiene Next.js corriendo, reinicia ante crashes, y levanta la app automáticamente al reiniciar el servidor.

---

## 1. Instalación global

```bash
sudo npm install -g pm2
```

---

## 2. Primer deploy

```bash
# Ingresar como usuario harborflow
su - harborflow

# Ir al directorio de la app
cd /home/harborflow/app

# Asegurarse de que .env esté en su lugar (ver deploy-checklist.md)

# Instalar dependencias de producción
npm ci --production=false

# Build de Next.js
npm run build

# Iniciar con PM2
pm2 start /home/harborflow/app/ecosystem.config.js

# Verificar que esté corriendo
pm2 status
pm2 logs harborflow --lines 50
```

---

## 3. Autostart al reiniciar el servidor

```bash
# Generar el script de startup (correr como el usuario harborflow o root)
pm2 startup

# PM2 imprimirá un comando para ejecutar como root. Ejemplo:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u harborflow --hp /home/harborflow

# Correr ese comando como root, luego:
pm2 save
```

---

## 4. Comandos de operación cotidiana

```bash
# Ver estado de todos los procesos
pm2 status

# Ver logs en tiempo real
pm2 logs harborflow

# Ver logs de errores
pm2 logs harborflow --err

# Reiniciar sin downtime (zero-downtime reload)
pm2 reload harborflow

# Restart completo (hay un momento de downtime breve)
pm2 restart harborflow

# Detener
pm2 stop harborflow

# Monitoreo interactivo (CPU, memoria, logs)
pm2 monit
```

---

## 5. Deploy de nueva versión

```bash
# Conectarse a la VPS como harborflow
ssh harborflow@TU_IP_VPS

cd /home/harborflow/app

# Traer la última versión del código
git pull origin main

# Instalar dependencias nuevas si las hay
npm ci --production=false

# Correr migraciones de DB
npx prisma migrate deploy

# Build de producción
npm run build

# Reload sin downtime
pm2 reload harborflow

# Verificar que todo esté bien
pm2 status
curl http://localhost:3000/api/health
```

---

## 6. Rotar logs

PM2 tiene un módulo oficial para rotar logs automáticamente:

```bash
pm2 install pm2-logrotate

# Configurar para que rote cada día y guarde 7 días
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## Checklist

- [ ] PM2 instalado globalmente
- [ ] App iniciada con `pm2 start ecosystem.config.js`
- [ ] `pm2 save` ejecutado
- [ ] `pm2 startup` configurado y comando de root ejecutado
- [ ] App accesible en `http://localhost:3000/api/health`
- [ ] Nginx haciendo proxy correctamente a puerto 3000
- [ ] `pm2 logs harborflow` sin errores críticos
