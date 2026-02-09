FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /donfra-runner ./cmd/donfra-runner

FROM alpine:3.20

# Install language runtimes
RUN apk add --no-cache python3 nodejs

COPY --from=builder /donfra-runner /usr/local/bin/donfra-runner
COPY configs/ /etc/nsjail/

RUN adduser -D -u 1000 runner
USER runner

EXPOSE 8090

# Default to direct mode (no nsjail). Set SANDBOX_MODE=nsjail for production.
ENV SANDBOX_MODE=direct
CMD ["donfra-runner"]
