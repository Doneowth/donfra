APP=donfra-api
BIN_DIR=./bin
BIN_FILE=$(BIN_DIR)/$(APP)
DOCKER_COMPOSE?=docker compose

.PHONY: run build docker docker-run clean dev-up up down logs

run:
	go run ./cmd/$(APP)

build:
	mkdir -p $(BIN_DIR)
	go build -o $(BIN_FILE) ./cmd/$(APP)

dev-up: build
	$(BIN_FILE)

docker:
	docker build -t $(APP):dev .

docker-run:
	docker run --rm -p 8080:8080 \
	 -e CORS_ORIGIN=http://localhost:3000 \
	 -e PASSCODE=19930115 \
	 $(APP):dev

up:
	$(DOCKER_COMPOSE) up -d --build

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f api

clean:
	rm -f $(BIN_FILE)
	go clean -cache -testcache

format:
	go fmt ./...
