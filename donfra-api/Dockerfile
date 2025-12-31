# syntax=docker/dockerfile:1.6

### ===== Build stage =====
FROM golang:1.24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata

# 先拷贝依赖清单，最大化缓存命中
COPY go.mod go.sum ./
RUN go mod download

# 再拷贝源码
COPY . .

# 构建（静态、精简符号表）
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w -buildid= -extldflags '-static'" \
    -o /out/donfra-api ./cmd/donfra-api

### ===== Runtime stage =====
FROM alpine:3.20
# 非 root 运行
RUN addgroup -S app && adduser -S app -G app

# 运行时依赖：Python3（/api/run 用到），证书，时区
RUN apk add --no-cache python3 ca-certificates tzdata curl

# 如果你的后端用 "python" 名称来执行，这里补软链到 python3
RUN ln -sf /usr/bin/python3 /usr/local/bin/python

WORKDIR /home/app
COPY --from=builder /out/donfra-api /usr/local/bin/donfra-api

# 多域时可逗号分隔；开发期可覆盖为 http://localhost:3000 或 http://localhost:7777
# ENV CORS_ORIGIN=http://localhost:3000

# Run as app user
USER app
EXPOSE 8080

# 健康检查（可选：你的服务有 /api/healthz 时更佳）
# HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
#   CMD curl -fsS http://127.0.0.1:8080/api/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/donfra-api"]
