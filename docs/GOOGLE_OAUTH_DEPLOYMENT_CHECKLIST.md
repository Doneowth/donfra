# Google OAuth 生产环境部署检查清单

## 当前问题
```
Error 400: redirect_uri_mismatch
Access blocked: This app's request is invalid
```

## 根本原因
Google Console中配置的回调URL与应用实际请求的URL不匹配。

---

## ✅ 完整修复步骤

### 第1步: 更新 Google Cloud Console（必须！）

1. **访问 Google Cloud Console**
   ```
   https://console.cloud.google.com/apis/credentials
   ```

2. **编辑 OAuth 2.0 客户端**
   - 客户端ID: `591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi`
   - 点击右侧的编辑图标（铅笔）

3. **在"已获授权的重定向 URI"部分添加以下URL**

   **当前配置（你的.env.production）:**
   ```
   GOOGLE_REDIRECT_URL=https://donfra.com/api/auth/google/callback
   ```

   **需要在Google Console中添加的所有URL:**
   ```
   http://localhost:8080/api/auth/google/callback       ← 本地开发用
   http://localhost/api/auth/google/callback            ← 本地开发用
   http://donfra.com/api/auth/google/callback           ← 生产环境 HTTP
   https://donfra.com/api/auth/google/callback          ← 生产环境 HTTPS ⭐
   ```

4. **保存更改**
   - 点击"保存"按钮
   - 等待1-2分钟让配置生效

---

### 第2步: 验证 `.env.production` 配置

已确认你的配置正确：
```bash
# ✅ 正确配置
GOOGLE_CLIENT_ID=591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URL=https://donfra.com/api/auth/google/callback
FRONTEND_URL=https://donfra.com
REDIS_ADDR=redis:6379
USE_REDIS=true
```

---

### 第3步: 部署新版本API（包含Redis支持）

**SSH登录到服务器 (97.107.136.151)**

```bash
# 进入项目目录
cd /path/to/donfra/infra

# 拉取最新的API镜像（1.0.1包含Redis state存储）
docker-compose pull api

# 重启API服务
docker-compose up -d api

# 查看日志确认Redis已启用
docker-compose logs -f api
```

**期望的日志输出：**
```
[donfra-api] google oauth service initialized with Redis (redirect: https://donfra.com/api/auth/google/callback, frontend: https://donfra.com)
```

---

### 第4步: 验证Redis连接

```bash
# 检查Redis是否运行
docker-compose ps redis

# 连接到Redis验证
docker exec -it donfra-redis redis-cli

# 在Redis CLI中执行
PING
# 应返回: PONG

# 检查Redis配置
CONFIG GET maxmemory

# 退出
exit
```

---

### 第5步: 测试OAuth流程

1. **清除浏览器缓存和Cookies**
   ```
   Chrome: Ctrl+Shift+Delete
   Firefox: Ctrl+Shift+Delete
   ```

2. **访问生产环境**
   ```
   https://donfra.com
   ```

3. **点击Google登录按钮**
   - 应该跳转到Google授权页面
   - **不再出现** "Error 400: redirect_uri_mismatch"

4. **完成授权**
   - 选择Google账号
   - 授权应用访问
   - 应该重定向回：`https://donfra.com`
   - 你应该已登录

5. **验证Redis state存储**
   ```bash
   # 在用户点击登录后，立即执行（10分钟内有效）
   docker exec -it donfra-redis redis-cli

   # 查看OAuth state keys
   KEYS google_oauth_state:*

   # 应该看到类似输出：
   # 1) "google_oauth_state:gLj1Ek7XgtDJKHQoQ5X-L--mOWoiSzlxWpQfmZzXb1U="

   # 查看TTL（应该是600秒 = 10分钟）
   TTL google_oauth_state:gLj1Ek7XgtDJKHQoQ5X-L--mOWoiSzlxWpQfmZzXb1U=

   # 退出
   exit
   ```

---

## 🔍 故障排查

### 如果还是出现 redirect_uri_mismatch

1. **检查Google Console配置**
   - 确认HTTPS URL已添加：`https://donfra.com/api/auth/google/callback`
   - 确认没有多余的空格或字符
   - 等待2-5分钟让配置生效

2. **检查API日志中的实际redirect URL**
   ```bash
   docker-compose logs api | grep "google oauth"
   ```

   应该显示：
   ```
   google oauth service initialized with Redis (redirect: https://donfra.com/api/auth/google/callback, frontend: https://donfra.com)
   ```

3. **检查.env.production是否被正确加载**
   ```bash
   # 进入API容器
   docker exec -it donfra-api sh

   # 检查环境变量
   echo $GOOGLE_REDIRECT_URL
   echo $FRONTEND_URL
   echo $USE_REDIS

   # 应该输出：
   # https://donfra.com/api/auth/google/callback
   # https://donfra.com
   # true

   # 退出
   exit
   ```

4. **检查Caddy反向代理配置**
   ```bash
   docker exec -it caddy cat /etc/caddy/Caddyfile
   ```

   确认有正确的路由配置：
   ```
   donfra.com {
       reverse_proxy /api/* api:8080
       reverse_proxy /yjs/* ws:6789
       reverse_proxy /* ui:3000
   }
   ```

### 如果state validation失败

1. **检查Redis是否运行**
   ```bash
   docker-compose ps redis
   ```

2. **检查Redis连接**
   ```bash
   docker-compose logs redis | tail -20
   ```

3. **检查API是否成功连接到Redis**
   ```bash
   docker-compose logs api | grep -i redis
   ```

   应该看到：
   ```
   [donfra-api] using Redis repository at redis:6379
   ```

---

## 📋 部署检查清单

- [ ] Google Console中添加了 `https://donfra.com/api/auth/google/callback`
- [ ] `.env.production` 配置正确（GOOGLE_REDIRECT_URL, FRONTEND_URL都是https）
- [ ] API镜像版本为 `doneowth/donfra-api:1.0.1` 或更高
- [ ] Redis容器正常运行
- [ ] API日志显示 "google oauth service initialized with Redis"
- [ ] 清除了浏览器缓存和cookies
- [ ] 能够访问 `https://donfra.com`
- [ ] Google OAuth不再显示 redirect_uri_mismatch 错误

---

## 🔐 安全提示

当前配置使用HTTPS（推荐），请确保：

1. **Cookie Secure标志**
   生产环境应该设置 `Secure: true`，在 `handlers/user.go` 中：
   ```go
   http.SetCookie(w, &http.Cookie{
       Name:     "auth_token",
       Value:    token,
       Path:     "/",
       MaxAge:   7 * 24 * 60 * 60,
       HttpOnly: true,
       Secure:   true,  // ⭐ 生产环境应该为true
       SameSite: http.SameSiteLaxMode,
   })
   ```

2. **Caddy自动HTTPS**
   Caddy会自动为你的域名申请Let's Encrypt证书，确保Caddy有权限绑定443端口。

---

## 📞 需要帮助？

如果完成以上步骤后仍有问题，请提供：
1. API日志：`docker-compose logs api | tail -50`
2. Redis日志：`docker-compose logs redis | tail -20`
3. 浏览器Network面板中的完整错误信息
4. Google Console中配置的所有回调URL截图
