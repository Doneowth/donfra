SHELL := /bin/zsh

# Path to the compose file used for local development
COMPOSE_FILE ?= infra/docker-compose.local.yml

# Allow overriding compose command (support `docker-compose` or `docker compose`)
DOCKER_COMPOSE ?= docker-compose

DC = $(DOCKER_COMPOSE) -f $(COMPOSE_FILE)

.PHONY: localdev-up localdev-down localdev-restart logs ps

localdev-up:
	@echo "Starting local development stack using $(COMPOSE_FILE)"
	$(DC) up -d --build

localdev-down:
	@echo "Stopping local development stack (bringing down containers)"
	$(DC) down

localdev-restart: localdev-down localdev-up

logs:
	$(DC) logs -f --tail=200

ps:
	$(DC) ps
