# LiveKit Docker Network Setup

## 配置说明

所有服务现在都运行在Docker网络 `donfra-local` 中，可以通过服务名进行服务发现。

## 网络架构

```
┌─────────────────────────────────────────────────────────────┐
│                    浏览器 (Browser)                          │
│                                                              │
│  访问: http://localhost                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTP/WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Docker Network: donfra-local                    │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    UI    │  │   API    │  │ LiveKit  │  │    WS    │   │
│  │  :3000   │  │  :8080   │  │  :7880   │  │  :6789   │   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └──────────┘   │
│        │             │             │                        │
│        │ /api/* ────►│             │                        │
│        │             │ ws://livekit:7880                    │
│        │             └────────────►│                        │
│        │ /livekit/* ───────────────┤                        │
│        │                           │                        │
│  ┌─────┴────────────────────────────────────────────┐      │
│  │  浏览器通过UI代理访问API和LiveKit                 │      │
│  │  - /api/* → http://api:8080                      │      │
│  │  - /livekit/* → http://livekit:7880              │      │
│  │  - /yjs → http://ws:6789                         │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
│  ┌──────────┐  ┌─────────┐  ┌─────────┐                    │
│  │    DB    │  │  Redis  │  │ Jaeger  │                    │
│  │  :5432   │  │  :6379  │  │ :16686  │                    │
│  └──────────┘  └─────────┘  └─────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## 服务配置

### LiveKit Server
- **服务名**: `livekit`
- **端口**:
  - 7880: HTTP/WebSocket
  - 7881: TCP fallback
  - 50000-50100/udp: RTC ports
- **配置文件**: `infra/livekit/livekit.yaml`
- **在Docker网络中**: ✅

### API (Go)
- **服务名**: `api`
- **端口**: 8080
- **环境变量**:
  ```bash
  LIVEKIT_SERVER_URL=ws://livekit:7880    # API内部连接
  LIVEKIT_PUBLIC_URL=/livekit             # 返回给浏览器的相对路径
  ```

### UI (Next.js)
- **服务名**: `ui`
- **端口**: 3000 (映射到主机端口80)
- **代理配置** (`next.config.js`):
  ```javascript
  // 浏览器访问 /livekit/* → 转发到 http://livekit:7880/*
  { source: '/livekit/:path*', destination: 'http://livekit:7880/:path*' }
  ```

## 服务发现

所有Docker容器可以通过服务名互相访问：
- `api` → `livekit:7880`
- `ui` → `livekit:7880`
- `ui` → `api:8080`
- `ws` → `redis:6379`

## 浏览器访问流程

1. **用户访问**: `http://localhost/live`
   - 浏览器连接到UI容器 (端口80)

2. **创建会话**: 前端调用 `POST /api/live/create`
   - UI代理到 `http://api:8080/api/live/create`
   - API生成token，返回 `server_url: "/livekit"`

3. **连接LiveKit**: LiveKit客户端连接到 `/livekit`
   - UI代理到 `ws://livekit:7880`
   - WebSocket升级成功
   - 建立WebRTC连接

## 端口映射

| 服务 | 容器端口 | 主机端口 | 用途 |
|------|---------|---------|------|
| ui | 3000 | 80 | HTTP/Web界面 |
| api | 8080 | 8080 | REST API |
| livekit | 7880 | 7880 | LiveKit WebSocket |
| livekit | 7881 | 7881 | LiveKit TCP fallback |
| livekit | 50000-50100/udp | 50000-50100/udp | WebRTC媒体流 |
| ws | 6789 | 6789 | Yjs协作 |
| db | 5432 | 5432 | PostgreSQL |
| redis | 6379 | 6379 | Redis |
| jaeger | 16686 | 16686 | Jaeger UI |

## 启动和测试

### 启动所有服务
```bash
cd /home/don/donfra/infra
docker-compose -f docker-compose.local.yml up -d
```

### 检查容器状态
```bash
docker-compose -f docker-compose.local.yml ps
```

### 查看LiveKit日志
```bash
docker logs donfra-livekit -f
```

### 测试服务连接
```bash
# 测试API能否访问LiveKit
docker exec donfra-api wget -qO- http://livekit:7880

# 测试UI能否访问LiveKit
docker exec donfra-ui wget -qO- http://livekit:7880
```

### 访问应用
打开浏览器访问:
```
http://localhost/live
```

## 配置文件修改记录

### 1. docker-compose.local.yml
```yaml
# API环境变量
api:
  environment:
    - LIVEKIT_SERVER_URL=ws://livekit:7880  # 服务发现
    - LIVEKIT_PUBLIC_URL=/livekit           # 相对路径

# LiveKit配置
livekit:
  ports:
    - "7880:7880"
    - "7881:7881"
    - "50000-50100:50000-50100/udp"
  networks:
    - donfra-local  # 加入Docker网络

# UI配置
ui:
  build:
    args:
      LIVEKIT_PROXY_TARGET: http://livekit:7880
```

### 2. next.config.js
```javascript
const LIVEKIT_PROXY_TARGET = process.env.LIVEKIT_PROXY_TARGET || "http://localhost:7880";

async rewrites() {
  return [
    { source: '/livekit/:path*', destination: `${LIVEKIT_PROXY_TARGET}/:path*` },
  ];
}
```

### 3. config.go
```go
LiveKitPublicURL: getenv("LIVEKIT_PUBLIC_URL", "/livekit"),
```

### 4. livekit.yaml
```yaml
rtc:
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: false  # 本地开发不需要外部IP
```

## 优势

✅ **统一的服务发现**: 所有服务通过服务名访问，配置简单
✅ **完整的Docker网络隔离**: 所有服务在同一网络中
✅ **简化的配置**: 不需要 `host.docker.internal`
✅ **标准的Docker Compose模式**: 符合最佳实践
✅ **易于扩展**: 可以轻松添加新服务

## 故障排除

### LiveKit连接失败
1. 检查LiveKit容器是否运行:
   ```bash
   docker ps | grep livekit
   ```

2. 查看LiveKit日志:
   ```bash
   docker logs donfra-livekit --tail 50
   ```

3. 确认LiveKit在Docker网络中:
   ```bash
   docker network inspect donfra-local_donfra-local | grep livekit
   ```

### UI无法代理到LiveKit
1. 检查next.config.js中的代理配置
2. 重启UI容器:
   ```bash
   docker-compose -f docker-compose.local.yml restart ui
   ```

### WebRTC连接失败
1. 确认UDP端口已映射 (50000-50100)
2. 检查防火墙设置
3. 查看浏览器控制台错误

## 与之前配置的区别

| 方面 | 之前 (host网络) | 现在 (bridge网络) |
|------|----------------|------------------|
| LiveKit网络 | `network_mode: host` | `networks: donfra-local` |
| API访问LiveKit | `host.docker.internal:7880` | `livekit:7880` |
| 浏览器访问 | `ws://localhost:7880` | `/livekit` (通过UI代理) |
| 服务发现 | 不统一 | 统一使用服务名 |
| 端口管理 | LiveKit直接占用主机端口 | Docker端口映射 |

---

**配置完成时间**: 2025-12-27 04:55 UTC
**状态**: ✅ 所有服务运行正常，使用Docker网络服务发现
