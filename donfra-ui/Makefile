# Helper targets to drive docker compose for this project
DC ?= docker compose

.PHONY: up up-d down logs ps

up:
	$(DC) up --build

up-d:
	$(DC) up --build -d

down:
	$(DC) down

logs:
	$(DC) logs -f

ps:
	$(DC) ps
