SHELL := /usr/bin/env bash

# Path to the compose file used for local development
COMPOSE_FILE ?= infra/docker-compose.local.yml

# Path to production compose file
PROD_COMPOSE_FILE ?= infra/docker-compose.yml

# UI Image Tag
UI_IMAGE_TAG ?= 1.0.20
# API Image Tag
API_IMAGE_TAG ?= 1.0.2
# Allow overriding compose command (support `docker-compose` or `docker compose`)
DOCKER_COMPOSE ?= docker-compose

DC = $(DOCKER_COMPOSE) -f $(COMPOSE_FILE)
PROD = $(DOCKER_COMPOSE) -f $(PROD_COMPOSE_FILE)

.PHONY: localdev-up localdev-down localdev-restart logs ps
.PHONY: localdev-up-api localdev-down-api localdev-restart-api
.PHONY: localdev-up-ws localdev-down-ws localdev-restart-ws
.PHONY: localdev-up-db localdev-down-db localdev-restart-db
.PHONY: localdev-up-ui localdev-down-ui localdev-restart-ui
.PHONY: localdev-up-redis localdev-restart-redis localdev-logs-redis
.PHONY: prod-up prod-down prod-restart prod-logs prod-ps
.PHONY: jaeger-ui jaeger-logs jaeger-hash-password
.PHONY: db-backup db-restore db-restore-latest db-list-backups load-db-sample db-reset


localdev-up:
	@echo "Starting local development stack using $(COMPOSE_FILE)"
	$(DC) up -d --build

localdev-down:
	@echo "Stopping local development stack (bringing down containers)"
	$(DC) down

localdev-restart: localdev-down localdev-up

localdev-up-api:
	@echo "Starting API container"
	$(DC) up -d --build api

localdev-down-api:
	@echo "Stopping API container"
	$(DC) stop api

localdev-restart-api:
	@echo "Restarting API container"
	$(DC) stop api && $(DC) up --build -d api

localdev-up-ws:
	@echo "Starting WS container"
	$(DC) up -d --build ws

localdev-down-ws:
	@echo "Stopping WS container"
	$(DC) stop ws

localdev-restart-ws:
	@echo "Restarting WS container"
	$(DC) restart ws

localdev-seed-db:
	@echo "Seeding the database with initial data"
	$(DC) exec -T db psql -U donfra -d donfra_study -f /docker-entrypoint-initdb.d/000_seed_lessons.sql
	$(DC) exec -T db psql -U donfra -d donfra_study -f /docker-entrypoint-initdb.d/001_create_users_table.sql;
	$(DC) exec -T db psql -U donfra -d donfra_study -f /docker-entrypoint-initdb.d/002_create_interview_rooms.sql;
localdev-up-db:
	@echo "Starting DB container"
	$(DC) up -d db

localdev-down-db:
	@echo "Stopping DB container"
	$(DC) down db -v
localdev-restart-db:
	@echo "Restarting DB container"
	$(DC) down db -v && $(DC) up --build -d db

logs:
	$(DC) logs -f --tail=200

ps:
	$(DC) ps


localdev-down-ui:
	@echo "Stopping UI container"
	$(DC) stop ui

localdev-up-ui:
	@echo "Starting UI container"
	$(DC) up -d --build ui

localdev-restart-ui: localdev-down-ui localdev-up-ui

localdev-up-redis:
	@echo "Starting Redis container"
	$(DC) up -d redis

localdev-restart-redis:
	@echo "Restarting Redis container"
	$(DC) restart redis

localdev-logs-redis:
	@echo "Viewing Redis logs"
	$(DC) logs -f redis

docker-build-ui:
	@echo "Building UI container"
	cd donfra-ui ; docker build -t doneowth/donfra-ui:$(UI_IMAGE_TAG) .

docker-push-ui:
	@echo "Pushing UI container to Docker Hub"
	cd donfra-ui ; docker push doneowth/donfra-ui:$(UI_IMAGE_TAG)

docker-build-api:
	@echo "Building API container"
	cd donfra-api ; docker build -t doneowth/donfra-api:$(API_IMAGE_TAG) .

docker-push-api:
	@echo "Pushing API container to Docker Hub"
	cd donfra-api ; docker push doneowth/donfra-api:$(API_IMAGE_TAG)

docker-build-api:
	@echo "Building API container"
	cd donfra-api ; docker build -t doneowth/donfra-api:$(API_IMAGE_TAG) .

docker-push-api:
	@echo "Pushing API container to Docker Hub"
	cd donfra-api ; docker push doneowth/donfra-api:$(API_IMAGE_TAG)

# ===== Production Commands =====

prod-up:
	@echo "Starting production stack using $(PROD_COMPOSE_FILE)"
	$(PROD) up -d --build

prod-down:
	@echo "Stopping production stack"
	$(PROD) down

prod-restart:
	@echo "Restarting production stack"
	$(PROD) restart

prod-logs:
	@echo "Viewing production logs"
	$(PROD) logs -f --tail=200

prod-ps:
	@echo "Listing production containers"
	$(PROD) ps

prod-restart-api:
	@echo "Restarting production API container"
	$(PROD) stop api && $(PROD) up --build -d api

prod-restart-caddy:
	@echo "Restarting production Caddy container"
	$(PROD) restart caddy

# ===== Jaeger Commands =====

jaeger-ui:
	@echo "Opening Jaeger UI in browser..."
	@echo "Local: http://localhost:16686"
	@echo "Production: https://donfra.dev/jaeger"

jaeger-logs:
	@echo "Viewing Jaeger logs (local dev)..."
	$(DC) logs -f jaeger

jaeger-logs-prod:
	@echo "Viewing Jaeger logs (production)..."
	$(PROD) logs -f jaeger

jaeger-hash-password:
	@echo "Generate password hash for Caddy Basic Auth:"
	@echo "Enter your password when prompted:"
	@docker run --rm -it caddy:2 caddy hash-password

# ===== Database Backup & Restore Commands =====

db-backup:
	@echo "📦 Creating database snapshot backup..."
	@chmod +x ./infra/db/backup-db.sh
	@./infra/db/backup-db.sh

db-restore:
	@echo "🔄 Restoring database from snapshot..."
	@chmod +x ./infra/db/restore-db.sh
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo ""; \
		echo "Usage: make db-restore BACKUP_FILE=./db-backups/donfra_backup_YYYYMMDD_HHMMSS.sql"; \
		echo ""; \
		echo "Available backups (newest first):"; \
		ls -lht ./db-backups/*.sql 2>/dev/null | head -10 || echo "No backups found"; \
		echo ""; \
		echo "Quick restore latest: make db-restore-latest"; \
		exit 1; \
	fi
	@./infra/db/restore-db.sh $(BACKUP_FILE)

db-restore-latest:
	@echo "🔄 Restoring from latest backup snapshot..."
	@chmod +x ./infra/db/restore-db.sh
	@LATEST=$$(ls -t ./db-backups/donfra_backup_*.sql 2>/dev/null | head -1); \
	if [ -z "$$LATEST" ]; then \
		echo "❌ No backups found!"; \
		echo "Create a backup first with: make db-backup"; \
		exit 1; \
	fi; \
	echo "Latest backup: $$LATEST"; \
	./infra/db/restore-db.sh "$$LATEST"

db-list-backups:
	@echo "📋 Available database snapshots (newest first):"
	@ls -lht ./db-backups/*.sql 2>/dev/null | head -10 || echo "No backups found"

# ===== Load Database Sample Data =====

load-db-sample:
	@echo "📥 Loading all SQL files from infra/db/ into database..."
	@echo ""
	@for sql_file in infra/db/*.sql; do \
		if [ -f "$$sql_file" ]; then \
			echo "▶ Executing: $$sql_file"; \
			output=$$(docker exec -i donfra-db psql -U donfra -d donfra_study < "$$sql_file" 2>&1); \
			echo "$$output" | grep -v "^NOTICE:" | grep -E "(CREATE|ALTER|INSERT|UPDATE|DELETE|ERROR)" || true; \
			if echo "$$output" | grep -q "ERROR.*already exists"; then \
				echo "⚠️  Some objects already exist (skipped): $$sql_file"; \
			elif echo "$$output" | grep -q "ERROR"; then \
				echo "❌ Failed with errors: $$sql_file"; \
			else \
				echo "✅ Successfully loaded: $$sql_file"; \
			fi; \
			echo ""; \
		fi; \
	done
	@echo "✨ Database sample data loading complete!"

add-20-lessons:
	@echo "📚 Adding 20 test lessons to database (mixed published/unpublished and VIP)..."
	@docker exec -i donfra-db psql -U donfra -d donfra_study < infra/db/999_add_test_lessons.sql
	@echo "✅ Added 20 test lessons successfully!"
	@echo ""
	@echo "Breakdown:"
	@echo "  - Published lessons: 14"
	@echo "  - Unpublished lessons: 6"
	@echo "  - VIP lessons: 10"
	@echo "  - Regular lessons: 10"

# ===== Database Reset =====

db-reset:
	@echo "🔄 Dropping and recreating database..."
	@echo "⏸️  Terminating existing connections..."
	@docker exec -i donfra-db psql -U donfra -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'donfra_study' AND pid <> pg_backend_pid();" > /dev/null
	@docker exec -i donfra-db psql -U donfra -d postgres -c "DROP DATABASE IF EXISTS donfra_study;"
	@docker exec -i donfra-db psql -U donfra -d postgres -c "CREATE DATABASE donfra_study;"
	@echo "✅ Database dropped and recreated!"
	@echo ""
	@echo "📥 Loading schema and seed data from 000_seed_lessons.sql..."
	@docker exec -i donfra-db psql -U donfra -d donfra_study < infra/db/000_seed_lessons.sql
	@echo "✅ Schema and initial data loaded!"
	@echo ""
	@echo "📥 Loading users table..."
	@docker exec -i donfra-db psql -U donfra -d donfra_study < infra/db/001_create_users_table.sql
	@echo "✅ Users table loaded!"
	@echo ""
	@echo "📥 Loading interview rooms table..."
	@docker exec -i donfra-db psql -U donfra -d donfra_study < infra/db/002_create_interview_rooms.sql
	@echo "✅ Interview rooms table loaded!"
	@echo ""
	@echo "📚 Adding 20 test lessons..."
	@docker exec -i donfra-db psql -U donfra -d donfra_study < infra/db/999_add_test_lessons.sql
	@echo "✅ Test lessons loaded!"
	@echo ""
	@echo "🎉 Database reset complete! Total lessons: 22 (2 seed + 20 test)"