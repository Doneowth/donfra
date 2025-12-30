#!/bin/bash
# PostgreSQL Database Backup Script
# Creates timestamped snapshots and maintains last 10 backups

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./db-backups"
BACKUP_FILE="${BACKUP_DIR}/donfra_backup_${TIMESTAMP}.sql"
KEEP_LAST=10  # Keep only the last N backups

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

echo "📦 Starting database snapshot backup..."
echo "Backup file: ${BACKUP_FILE}"

# Export database using pg_dump via docker exec
# Using --clean --if-exists for safer restores
docker exec -i donfra-db pg_dump -U donfra -d donfra_study \
  --clean --if-exists --create > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
  echo "✅ Backup completed successfully!"
  echo "File size: $(du -h ${BACKUP_FILE} | cut -f1)"

  # Clean up old backups (keep last N)
  echo ""
  echo "🧹 Cleaning up old backups (keeping last ${KEEP_LAST})..."
  BACKUP_COUNT=$(ls -1 ${BACKUP_DIR}/donfra_backup_*.sql 2>/dev/null | wc -l)

  if [ ${BACKUP_COUNT} -gt ${KEEP_LAST} ]; then
    ls -1t ${BACKUP_DIR}/donfra_backup_*.sql | tail -n +$((KEEP_LAST + 1)) | while read old_backup; do
      echo "  Removing  : $(basename ${old_backup})"
      rm "${old_backup}"
    done
  fi

  echo ""
  echo "📊 Available backups:"
  ls -lht ${BACKUP_DIR}/donfra_backup_*.sql | head -${KEEP_LAST}
else
  echo "❌ Backup failed!"
  exit 1
fi
