# LiveKit 最终配置 - 完成 ✅

## 配置总结

所有服务都在Docker网络 `donfra-local` 中运行，使用服务名进行服务发现。浏览器通过UI的代理访问LiveKit。

## 网络架构

```
┌─────────────────────────────────────────────────────────────┐
│                    浏览器 (Browser)                          │
│                                                              │
│  访问: http://localhost                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/WebSocket
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Docker Network: donfra-local                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  UI Container (Next.js - Port 80)                    │   │
│  │                                                       │   │
│  │  Next.js Rewrites (代理规则):                        │   │
│  │  • /api/*      → http://api:8080/api/*              │   │
│  │  • /yjs        → http://ws:6789/yjs                  │   │
│  │  • /livekit/*  → http://livekit:7880/*  ✅           │   │
│  └──────────┬────────────────────┬────────────────────────┘   │
│             │                    │                            │
│             ▼                    ▼                            │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   API (Go)       │  │   LiveKit        │                 │
│  │   livekit:7880   │  │   livekit:7880   │                 │
│  │                  │  │                  │                 │
│  │  内部连接:       │  │  端口映射:       │                 │
│  │  ws://livekit:   │  │  7880→7880       │                 │
│  │  7880            │  │  7881→7881       │                 │
│  │                  │  │  50000-50100/udp │                 │
│  │  返回给浏览器:   │  │                  │                 │
│  │  /livekit        │  └──────────────────┘                 │
│  └──────────────────┘                                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐    │
│  │    WS    │  │    DB    │  │  Redis  │  │  Jaeger  │    │
│  │  :6789   │  │  :5432   │  │  :6379  │  │  :16686  │    │
│  └──────────┘  └──────────┘  └─────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 关键配置文件

### 1. docker-compose.local.yml

```yaml
# API服务
api:
  environment:
    - LIVEKIT_SERVER_URL=ws://livekit:7880  # API内部访问
    - LIVEKIT_PUBLIC_URL=/livekit           # 返回给浏览器的路径
  depends_on:
    - livekit

# UI服务
ui:
  build:
    args:
      LIVEKIT_PROXY_TARGET: http://livekit:7880  # ✅ 构建时传递

# LiveKit服务
livekit:
  image: livekit/livekit-server:latest
  ports:
    - "7880:7880"      # HTTP/WebSocket
    - "7881:7881"      # TCP fallback
    - "50000-50100:50000-50100/udp"  # RTC ports
  networks:
    - donfra-local
```

### 2. donfra-ui/Dockerfile

```dockerfile
# 构建阶段需要接收LIVEKIT_PROXY_TARGET
ARG LIVEKIT_PROXY_TARGET
ENV LIVEKIT_PROXY_TARGET=${LIVEKIT_PROXY_TARGET}
```

### 3. donfra-ui/next.config.js

```javascript
const LIVEKIT_PROXY_TARGET = process.env.LIVEKIT_PROXY_TARGET || "http://localhost:7880";

async rewrites() {
  return [
    // LiveKit代理 - 浏览器访问 /livekit/* 会被转发到 livekit:7880
    { source: '/livekit/:path*', destination: `${LIVEKIT_PROXY_TARGET}/:path*` },
  ];
}
```

### 4. livekit.yaml

```yaml
port: 7880
bind_addresses:
  - "0.0.0.0"

rtc:
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: false  # 本地开发不需要外部IP

keys:
  devkeydevkeydevkeydevkeydevkeydevkey: APISECRETdevkeyAPISECRETdevkeyAPISECRETdevkey
```

## 数据流

### 创建直播会话

1. **用户操作**: 访问 `http://localhost/live`，点击"Create Session"
2. **前端请求**: `POST http://localhost/api/live/create`
3. **UI代理**: 转发到 `http://api:8080/api/live/create`
4. **API处理**:
   - 内部连接LiveKit: `ws://livekit:7880`
   - 生成token
   - 返回响应: `{ server_url: "/livekit", token: "..." }`
5. **浏览器连接**: 访问 `/livekit` (通过UI代理到 `http://livekit:7880`)

### WebSocket连接流程

```
浏览器 → http://localhost/livekit
  ↓
UI (Next.js rewrite)
  ↓
http://livekit:7880 (Docker网络内部)
  ↓
LiveKit Server (WebSocket升级)
  ↓
WebRTC连接建立 (UDP 50000-50100)
```

## 验证测试

### 1. 检查所有容器运行
```bash
cd /home/don/donfra/infra
docker-compose -f docker-compose.local.yml ps
```

### 2. 测试LiveKit代理
```bash
curl http://localhost/livekit
# 应该返回: OK
```

### 3. 测试API端点
```bash
curl -X POST http://localhost/api/live/create \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session", "owner_name": "Alice"}'

# 应该返回:
# {
#   "session_id": "...",
#   "server_url": "/livekit",
#   "host_token": "...",
#   "message": "Live session created successfully"
# }
```

### 4. 测试完整流程
1. 浏览器访问: `http://localhost/live`
2. 创建新会话
3. 授权摄像头/麦克风
4. 应该能看到视频界面

## 端口映射

| 服务 | 容器端口 | 主机端口 | 用途 |
|------|---------|---------|------|
| ui | 3000 | 80 | Web界面 |
| api | 8080 | 8080 | REST API (通过UI代理) |
| livekit | 7880 | 7880 | HTTP/WebSocket (通过UI代理) |
| livekit | 7881 | 7881 | TCP fallback |
| livekit | 50000-50100/udp | 50000-50100/udp | WebRTC媒体流 |
| ws | 6789 | 6789 | Yjs WebSocket |
| db | 5432 | 5432 | PostgreSQL |
| redis | 6379 | 6379 | Redis |

## 服务发现

所有Docker容器通过服务名互相访问：
- ✅ `api` → `livekit:7880`
- ✅ `ui` → `api:8080`
- ✅ `ui` → `livekit:7880`
- ✅ `ui` → `ws:6789`

浏览器通过UI代理访问：
- ✅ `/api/*` → `api:8080`
- ✅ `/livekit/*` → `livekit:7880`
- ✅ `/yjs` → `ws:6789`

## 常用命令

```bash
# 启动所有服务
cd /home/don/donfra/infra
docker-compose -f docker-compose.local.yml up -d

# 重新构建UI（如果修改了代理配置）
docker-compose -f docker-compose.local.yml build --no-cache ui
docker-compose -f docker-compose.local.yml up -d ui

# 查看日志
docker logs donfra-livekit -f   # LiveKit日志
docker logs donfra-api -f       # API日志
docker logs donfra-ui -f        # UI日志

# 停止所有服务
docker-compose -f docker-compose.local.yml down

# 重启单个服务
docker-compose -f docker-compose.local.yml restart api
docker-compose -f docker-compose.local.yml restart ui
docker-compose -f docker-compose.local.yml restart livekit
```

## 故障排除

### LiveKit代理返回500错误
**症状**: `curl http://localhost/livekit` 返回 "Internal Server Error"

**原因**: UI的Next.js构建时没有正确的`LIVEKIT_PROXY_TARGET`环境变量

**解决**:
```bash
# 确认docker-compose.local.yml中有build args
# 重新构建UI
docker-compose -f docker-compose.local.yml build --no-cache ui
docker-compose -f docker-compose.local.yml up -d ui
```

### 浏览器显示ERR_NAME_NOT_RESOLVED
**症状**: 浏览器无法解析 `http://livekit`

**原因**: API返回了内部服务名而不是相对路径

**解决**: 确认API的`LIVEKIT_PUBLIC_URL`设置为`/livekit`而不是`http://livekit`

### LiveKit连接超时
**症状**: LiveKit客户端连接失败

**检查步骤**:
1. 确认LiveKit容器运行: `docker ps | grep livekit`
2. 检查端口映射: `docker port donfra-livekit`
3. 查看LiveKit日志: `docker logs donfra-livekit`
4. 测试代理: `curl http://localhost/livekit`

## 配置优势

✅ **统一的服务发现**: 所有服务通过Docker网络服务名访问
✅ **浏览器友好**: 通过UI代理，避免CORS问题
✅ **开发环境一致**: 本地开发和Docker环境配置相同
✅ **易于扩展**: 添加新服务只需加入Docker网络
✅ **符合最佳实践**: 标准的Docker Compose + Next.js proxy模式

## 生产环境注意事项

在部署到生产环境时需要修改：

1. **LiveKit密钥**: 更换`livekit.yaml`中的API key/secret
2. **外部IP**: 设置`use_external_ip: true`和`external_ip`
3. **HTTPS**: 使用Caddy或nginx反向代理，配置TLS证书
4. **TURN服务器**: 为NAT穿透配置TURN服务器
5. **域名**: 更新所有localhost为实际域名

---

**配置完成时间**: 2025-12-27
**状态**: ✅ 所有服务运行正常，LiveKit代理工作正常
**访问地址**: http://localhost/live
