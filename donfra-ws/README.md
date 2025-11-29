# Yjs Demo WebSocket Server

简单的 Yjs WebSocket 后端，带静态文件服务、健康检查、可配置的 WS 路径和 API 反向代理。

## 快速启动
- 构建并后台运行：`make up`（等同 `docker-compose up -d --build`）
- 查看日志：`make logs`
- 停止：`make down`

## 端口与路由
- HTTP/WS 端口：`6789`（可通过 `PORT` 覆盖）
- WS 路径：`/ws` 默认，可用 `WS_PATH` 改成 `/collab` 等
- 健康检查：`/health`
- API 代理：`/api/*` 会转发到 `API_TARGET` 指定的后端

## 环境变量
- `PORT`：监听端口，默认 `6789`
- `PRODUCTION`：存在即视为生产模式，静态文件开启缓存和 gzip
- `WS_PATH`：WebSocket upgrade 路径，默认 `/ws`
- `API_TARGET`：API 转发目标，如 `http://go-api:8080` 或 `http://host.docker.internal:8080`

## 本地开发
- 不设置 `PRODUCTION`，避免静态文件缓存
- 如需改 WS 路径，运行时设置 `WS_PATH=/collab npm start`
- 直接运行：`npm start`（需本地装好 Node 16+）

## Docker/Compose
- 默认网络名：`donfra`（在 `docker-compose.yml` 中配置）
- 其他容器想要互通，运行时加入同一网络：`--network donfra`
- 修改 API 目标时，覆盖环境变量：`API_TARGET=http://your-api:8080 make up`
# donfra
