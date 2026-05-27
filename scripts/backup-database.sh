#!/bin/bash
# Backup automático de PostgreSQL para HarborFlow
# Corre desde crontab en la VPS

set -e

# Variables (ajustar en producción)
DB_NAME="harborflow_prod"
DB_USER="harborflow"
BACKUP_DIR="/var/backups/harborflow"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/harborflow-$DATE.sql.gz"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Backup comprimido
echo "[$(date)] Iniciando backup..."
pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

# Verificar que el backup no esté vacío
if [ ! -s "$BACKUP_FILE" ]; then
    echo "[$(date)] ERROR: Backup vacío o falló"
    exit 1
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup creado: $BACKUP_FILE ($SIZE)"

# Eliminar backups viejos
find "$BACKUP_DIR" -name "harborflow-*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Backups > $RETENTION_DAYS días eliminados"

# Sincronizar con Backblaze B2 (si rclone está configurado)
if command -v rclone &> /dev/null; then
    echo "[$(date)] Subiendo a B2..."
    rclone copy "$BACKUP_FILE" b2-harborflow:harborflow-backups/
    echo "[$(date)] Backup subido a B2"
fi

echo "[$(date)] Backup completado"
