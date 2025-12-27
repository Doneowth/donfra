#!/bin/bash
# PostgreSQL Database Backup Script

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./db-backups"
BACKUP_FILE="${BACKUP_DIR}/donfra_backup_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

echo "📦 Starting database backup..."
echo "Backup file: ${BACKUP_FILE}"

# Export database using pg_dump via docker exec
docker exec -i donfra-db pg_dump -U donfra -d donfra_study > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
  echo "✅ Backup completed successfully!"
  echo "File size: $(du -h ${BACKUP_FILE} | cut -f1)"
  ls -lh ${BACKUP_FILE}
else
  echo "❌ Backup failed!"
  exit 1
fi
