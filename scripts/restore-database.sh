#!/bin/bash
# Restaurar backup de HarborFlow
# Uso: ./restore-database.sh <archivo.sql.gz>

set -e

if [ -z "$1" ]; then
    echo "Uso: $0 <archivo.sql.gz>"
    echo ""
    echo "Backups disponibles:"
    ls -lh /var/backups/harborflow/
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="harborflow_prod"
DB_USER="harborflow"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Archivo no existe: $BACKUP_FILE"
    exit 1
fi

echo "⚠ ATENCIÓN: Vas a restaurar el backup:"
echo "  $BACKUP_FILE"
echo ""
echo "Esto SOBRESCRIBE la base de datos actual."
echo "Los datos posteriores al backup SE PERDERÁN."
echo ""
read -p "¿Continuar? (escribí 'restaurar' para confirmar): " confirm

if [ "$confirm" != "restaurar" ]; then
    echo "Cancelado"
    exit 0
fi

echo "Restaurando..."
gunzip -c "$BACKUP_FILE" | psql -U "$DB_USER" -d "$DB_NAME"
echo "✓ Restore completado"
