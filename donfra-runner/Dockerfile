FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /donfra-runner ./cmd/donfra-runner

FROM alpine:3.20

# In k8s mode, runner is just an HTTP orchestrator (no python/node needed).
# In direct mode (local dev), install language runtimes for local execution.
ARG INSTALL_RUNTIMES=false
RUN if [ "$INSTALL_RUNTIMES" = "true" ]; then apk add --no-cache python3 nodejs; fi

COPY --from=builder /donfra-runner /usr/local/bin/donfra-runner

RUN adduser -D -u 1000 runner
USER runner

EXPOSE 8090

ENV JAIL_MODE=direct
CMD ["donfra-runner"]
