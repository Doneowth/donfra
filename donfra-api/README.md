# donfra-api

一个用 Go 写的小型后端，提供“房间”管理与在线 Python 代码沙盒。它主要用于：

- 通过口令打开/关闭一个“房间”，生成带 token 的邀请链接。
- 校验邀请 token，给前端下发 `room_access` Cookie。
- 在房间开启时，执行前端传入的 Python3 代码，返回 stdout/stderr。

## 架构与流程

- `cmd/donfra-api/main.go`：加载配置，启动 HTTP 服务器。
- `internal/domain/room`：房间状态与内存存储，负责 passcode 校验、token 生成、开关房间。
- `internal/domain/run`：`python3 -I -u -` 子进程执行代码，5 秒超时。
- `internal/http/router` & `handlers`：Chi 路由，含 CORS、请求 ID、中间件；暴露 `/api/v1` 接口。
- 存储是内存态的，重启后状态和 token 会丢失。

## API 速览

所有路径同时可通过 `/api` 或 `/api/v1` 访问。

| 方法 | 路径            | 作用                               | 说明 |
| ---- | --------------- | ---------------------------------- | ---- |
| POST | `/room/init`    | 传入 passcode，开启房间并返回邀请链接 | Body: `{ "passcode": "xxxx" }` |
| GET  | `/room/status`  | 查看房间是否开启                   | 无 Body |
| POST | `/room/join`    | 校验邀请 token，设置 `room_access` Cookie | Body: `{ "token": "..." }` |
| POST | `/room/close`   | 关闭房间                           | 无 Body |
| POST | `/room/run`          | 在房间开启时执行 Python 代码        | Body: `{ "code": "print(1)" }`，5 秒超时 |

### 示例

```bash
# 1) 管理员开启房间，拿到 inviteUrl
curl -X POST http://localhost:8080/api/v1/room/init \
  -H "Content-Type: application/json" \
  -d '{"passcode":"7777"}'

# 2) 客户端用 token 加入
curl -X POST http://localhost:8080/api/v1/room/join \
  -H "Content-Type: application/json" \
  -d '{"token":"<invite_token>"}' -c jar.txt

# 3) 执行代码（房间需处于开启状态）
curl -X POST http://localhost:8080/api/v1/run \
  -H "Content-Type: application/json" \
  -d '{"code":"print(42)"}'
```

## 配置

通过环境变量控制，见 `internal/config/config.go`：

- `ADDR`：监听地址，默认 `:8080`
- `PASSCODE`：开启房间所需口令，默认 `7777`
- `BASE_URL`：前端地址；若设置，会在邀请链接前拼上该 base（否则仅返回相对路径 `/coding?...`）
- `CORS_ORIGIN`：允许的前端域名，默认 `http://localhost:3000`

## 本地运行

需求：Go 1.24+、Python3（运行代码用）。

```bash
# 直接跑
go run ./cmd/donfra-api

# 或构建二进制
make build
./bin/donfra-api
```
