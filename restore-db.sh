#!/bin/bash
# PostgreSQL Database Restore Script

if [ -z "$1" ]; then
  echo "Usage: ./restore-db.sh <backup_file.sql>"
  echo ""
  echo "Available backups:"
  ls -lh ./db-backups/*.sql 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_FILE=$1

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "🔄 Starting database restore..."
echo "Backup file: ${BACKUP_FILE}"
echo ""
read -p "⚠️  This will OVERWRITE the current database. Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Drop existing database and recreate (optional, more thorough)
echo "Dropping existing database..."
docker exec -i donfra-db psql -U donfra -c "DROP DATABASE IF EXISTS donfra_study;"
docker exec -i donfra-db psql -U donfra -c "CREATE DATABASE donfra_study;"

# Restore from backup
echo "Restoring from backup..."
docker exec -i donfra-db psql -U donfra -d donfra_study < ${BACKUP_FILE}

if [ $? -eq 0 ]; then
  echo "✅ Restore completed successfully!"
else
  echo "❌ Restore failed!"
  exit 1
fi
