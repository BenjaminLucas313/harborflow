# Sistema de backups de HarborFlow

## Arquitectura
- Backup local diario en /var/backups/harborflow/
- Retención local: 30 días
- Backup off-site en Backblaze B2 con rclone
- Retención off-site: 90 días

## Configuración inicial en la VPS

### 1. Crear directorio de backups
```bash
sudo mkdir -p /var/backups/harborflow
sudo chown harborflow:harborflow /var/backups/harborflow
```

### 2. Permisos del script
```bash
chmod +x scripts/backup-database.sh
chmod +x scripts/restore-database.sh
```

### 3. Configurar rclone para Backblaze B2
```bash
sudo apt install rclone
rclone config
# Seguir wizard: nombre "b2-harborflow", tipo B2,
# pegar las credenciales generadas en backblaze.com
```

### 4. Agregar al crontab
```bash
crontab -e
```

```cron
# Backup diario a las 03:00 AM
0 3 * * * /home/harborflow/scripts/backup-database.sh >> /var/log/harborflow/backup.log 2>&1
```

## Procedimiento de restore

### En caso de emergencia:
1. Detener la app: `pm2 stop harborflow`
2. Listar backups disponibles:
   ```bash
   ls -lh /var/backups/harborflow/
   ```
3. Ejecutar restore:
   ```bash
   ./scripts/restore-database.sh /var/backups/harborflow/harborflow-YYYY-MM-DD.sql.gz
   ```
4. Verificar datos manualmente
5. Reiniciar app: `pm2 start harborflow`

### Restore desde B2:
1. Descargar backup de B2:
   ```bash
   rclone copy b2-harborflow:harborflow-backups/harborflow-YYYY-MM-DD.sql.gz /tmp/
   ```
2. Restore normal:
   ```bash
   ./scripts/restore-database.sh /tmp/harborflow-YYYY-MM-DD.sql.gz
   ```

## Verificación mensual
- Verificar que los últimos 5 backups existen en /var/backups/harborflow/
- Verificar que B2 tiene los mismos archivos
- Cada 3 meses: hacer un restore de prueba en un entorno separado
