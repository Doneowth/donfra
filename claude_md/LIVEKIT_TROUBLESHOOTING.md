# LiveKit 连接问题排查指南

## 当前配置

### Docker 网络配置
- **LiveKit**: 使用 `network_mode: host`（直接使用主机网络）
- **API**: 在 Docker 网络 `donfra-local` 中
- **前端**: 在浏览器中运行

### 连接 URL
- **API → LiveKit**: `ws://host.docker.internal:7880`（Docker 容器访问主机）
- **浏览器 → LiveKit**: `ws://localhost:7880`（浏览器访问主机）

## 常见问题

### 1. 浏览器连接 `http://localhost:7880/rtc/validate` 报错

**原因**: LiveKit 的 `/rtc/validate` 端点需要 WebSocket 升级，不能直接用 HTTP 访问。

**解决方案**: 这是正常的！浏览器应该通过 LiveKit React 组件连接，组件会自动处理 WebSocket 升级。

### 2. WebRTC ICE 连接失败

**症状**: LiveKit 日志显示 `"state": "failed"` for ICE candidates

**原因**: NAT 穿透问题，Docker 内部 IP 和外部 IP 不匹配

**解决方案**: ✅ 已解决 - 使用 `network_mode: host`

### 3. API 无法连接到 LiveKit

**症状**: API 启动报错或无法生成 token

**原因**: API 在 Docker 网络中，无法通过 `livekit` 主机名访问使用 host 网络的 LiveKit

**解决方案**: ✅ 已解决 - 使用 `host.docker.internal:7880`

## 测试步骤

### 1. 测试 LiveKit 服务器
```bash
# 检查 LiveKit 是否运行
docker ps | grep livekit

# 查看 LiveKit 日志
docker logs donfra-livekit --tail 20

# 应该看到类似输出:
# INFO livekit service/server.go:264 starting LiveKit server {"portHttp": 7880, ...}
```

### 2. 测试 API 端点
```bash
# 创建会话
curl -X POST http://localhost:8080/api/live/create \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "owner_name": "Alice"}'

# 应该返回:
# {
#   "session_id": "...",
#   "server_url": "ws://localhost:7880",  # 浏览器可访问的 URL
#   "host_token": "eyJ...",
#   ...
# }
```

### 3. 测试前端连接
```bash
# 启动前端
cd donfra-ui
npm install
npm run dev

# 访问 http://localhost:3000/live
# 创建会话后应该能看到视频界面
```

## 调试命令

### 检查端口监听
```bash
# 主机上检查 7880 端口
sudo netstat -tlnp | grep 7880
# 或
sudo ss -tlnp | grep 7880
```

### 检查 Docker 网络
```bash
# 查看所有网络
docker network ls

# 查看 donfra-local 网络详情
docker network inspect donfra-local
```

### 查看完整日志
```bash
# LiveKit 日志
docker logs donfra-livekit -f

# API 日志
docker logs donfra-api -f
```

## 预期行为

1. **创建会话**:
   - 用户点击 "Create Session"
   - API 调用 `CreateSession`，生成 session_id 和 host_token
   - 返回 `server_url: "ws://localhost:7880"`

2. **连接 LiveKit**:
   - React 组件使用 token 和 server_url 连接
   - LiveKit 验证 token
   - 建立 WebRTC 连接
   - 显示本地视频流

3. **加入会话**:
   - 另一个用户输入 session_id
   - API 生成 viewer token
   - 连接到同一个 room
   - 看到 host 的视频流

## 关键配置文件

### docker-compose.local.yml
```yaml
livekit:
  image: livekit/livekit-server:latest
  network_mode: host  # 关键！使用主机网络
  volumes:
    - ./livekit/livekit.yaml:/etc/livekit.yaml:ro
```

### livekit.yaml
```yaml
port: 7880
keys:
  devkeydevkeydevkeydevkeydevkeydevkey: APISECRETdevkeyAPISECRETdevkeyAPISECRETdevkey
```

### API 环境变量
```bash
LIVEKIT_API_KEY=devkeydevkeydevkeydevkeydevkeydevkey
LIVEKIT_API_SECRET=APISECRETdevkeyAPISECRETdevkeyAPISECRETdevkey
LIVEKIT_SERVER_URL=ws://host.docker.internal:7880  # API 内部使用
LIVEKIT_PUBLIC_URL=ws://localhost:7880             # 返回给浏览器
```

## 故障排除检查清单

- [ ] LiveKit 容器正在运行
- [ ] LiveKit 监听 7880 端口
- [ ] API 能够访问 `host.docker.internal:7880`
- [ ] API 返回正确的 `server_url: "ws://localhost:7880"`
- [ ] 浏览器能访问 `http://localhost:7880`（即使报错也说明端口可达）
- [ ] LiveKit 日志没有错误
- [ ] 前端已安装 LiveKit 依赖（`npm install`）
- [ ] Token 使用正确的 API key/secret 生成

## 常见错误信息

### "could not restart participant"
- **原因**: WebRTC 连接建立失败
- **检查**: LiveKit 日志中的 ICE candidate 状态
- **解决**: 使用 host 网络模式（已配置）

### "SIGNAL_SOURCE_CLOSE"
- **原因**: 客户端主动断开连接
- **检查**: 浏览器控制台错误
- **可能原因**: Token 无效、权限不足、网络问题

### "secret is too short"
- **原因**: API secret 少于 32 字符
- **解决**: ✅ 已修复 - 使用 49 字符的 secret

## 成功指标

连接成功时，LiveKit 日志应该显示：
```
INFO livekit service/roommanager.go:410 starting RTC session
INFO livekit.transport rtc/transport.go:XXX ICE connection state changed to connected
```

前端应该显示：
- 本地视频预览
- 控制按钮（麦克风、摄像头、屏幕共享）
- 其他参与者的视频（如果有）
