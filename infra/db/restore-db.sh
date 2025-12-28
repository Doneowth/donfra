#!/bin/bash
# PostgreSQL Database Snapshot Restore Script
# This script provides safe database restoration with connection handling

if [ -z "$1" ]; then
  echo "Usage: ./restore-db.sh <backup_file.sql>"
  echo ""
  echo "Available backups:"
  ls -lht ./db-backups/*.sql 2>/dev/null | head -10 || echo "No backups found"
  exit 1
fi

BACKUP_FILE=$1

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "🔄 Starting database snapshot restore..."
echo "Backup file: ${BACKUP_FILE}"
echo "File size: $(du -h ${BACKUP_FILE} | cut -f1)"
echo ""
read -p "⚠️  This will REPLACE ALL DATA in the database. Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo ""
echo "Step 1/4: Terminating active connections..."
docker exec -i donfra-db psql -U donfra -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'donfra_study' AND pid <> pg_backend_pid();
"

echo ""
echo "Step 2/4: Dropping and recreating database..."
docker exec -i donfra-db psql -U donfra -d postgres -c "DROP DATABASE IF EXISTS donfra_study;"
docker exec -i donfra-db psql -U donfra -d postgres -c "CREATE DATABASE donfra_study OWNER donfra;"

echo ""
echo "Step 3/4: Restoring data from snapshot..."
docker exec -i donfra-db psql -U donfra -d donfra_study < ${BACKUP_FILE}

if [ $? -eq 0 ]; then
  echo ""
  echo "Step 4/4: Verifying restore..."

  # Check table counts
  echo ""
  echo "📊 Database statistics:"
  docker exec -i donfra-db psql -U donfra -d donfra_study -c "
    SELECT
      schemaname,
      tablename,
      (SELECT COUNT(*) FROM (SELECT 1 FROM pg_catalog.pg_class WHERE relname = tablename LIMIT 1) sub) as exists,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  "

  echo ""
  echo "✅ Snapshot restore completed successfully!"
  echo ""
  echo "🔄 You may need to restart your API container to reconnect:"
  echo "   make prod-restart-api"
else
  echo ""
  echo "❌ Restore failed!"
  exit 1
fi
