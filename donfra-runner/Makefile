BINARY    := donfra-runner
IMAGE     := doneowth/donfra-runner
TAG       ?= latest

.PHONY: build run test lint clean docker-build docker-push

build:
	go build -o bin/$(BINARY) ./cmd/donfra-runner

run:
	go run ./cmd/donfra-runner

test:
	go test ./... -v -race

lint:
	golangci-lint run

clean:
	rm -rf bin/

docker-build:
	docker build -t $(IMAGE):$(TAG) .

docker-push:
	docker push $(IMAGE):$(TAG)
