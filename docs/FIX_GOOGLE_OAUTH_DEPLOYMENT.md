# 修复 Google OAuth "redirect_uri_mismatch" 错误

## 错误信息
```
Error 400: redirect_uri_mismatch
Access blocked: This app's request is invalid
```

## 原因
Google Cloud Console中配置的授权回调URL与应用程序实际请求的URL不匹配。

## 完整修复步骤

### 步骤1: 更新 Google Cloud Console 配置

1. **访问 Google Cloud Console**
   - 打开：https://console.cloud.google.com/apis/credentials
   - 使用你的Google账号登录

2. **找到OAuth 2.0客户端**
   - 在"OAuth 2.0 客户端 ID"列表中
   - 找到客户端ID：`591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi.apps.googleusercontent.com`
   - 点击右侧的编辑图标（铅笔图标）

3. **添加授权的重定向URI**

   在"已获授权的重定向 URI"部分，**添加以下所有URL**（保留现有的localhost用于本地开发）：

   ```
   http://localhost:8080/api/auth/google/callback
   http://localhost/api/auth/google/callback
   http://donfra.com/api/auth/google/callback
   ```

   如果你有HTTPS证书，也添加：
   ```
   https://donfra.com/api/auth/google/callback
   ```

4. **保存更改**
   - 点击"保存"按钮
   - 等待几分钟让配置生效（通常是即时的，但有时需要1-2分钟）

### 步骤2: 构建并推送新版本API镜像

在本地机器执行：

```bash
# 进入项目根目录
cd /home/don/donfra

# 构建API Docker镜像
make docker-build-api API_IMAGE_TAG=1.0.1

# 推送到Docker Hub
make docker-push-api API_IMAGE_TAG=1.0.1
```

或者手动执行：
```bash
cd donfra-api
docker build -t doneowth/donfra-api:1.0.1 .
docker push doneowth/donfra-api:1.0.1
```

### 步骤3: 在服务器上部署

SSH登录到服务器 (97.107.136.151)，然后执行：

```bash
# 进入项目目录
cd /path/to/donfra/infra

# 拉取最新镜像
docker-compose pull api

# 重启API服务
docker-compose up -d api

# 查看日志确认启动成功
docker-compose logs -f api
```

你应该看到日志输出：
```
[donfra-api] google oauth service initialized with Redis (redirect: http://donfra.com/api/auth/google/callback, frontend: http://donfra.com)
```

### 步骤4: 测试Google OAuth登录

1. 访问：http://donfra.com
2. 点击Google登录按钮
3. 应该正常跳转到Google授权页面（不再出现400错误）
4. 授权后应该重定向回：http://donfra.com

## 验证Redis状态存储

测试OAuth完整流程是否使用Redis：

```bash
# 在服务器上连接到Redis
docker exec -it donfra-redis redis-cli

# 在Redis CLI中，等待用户点击登录后查看state
KEYS google_oauth_state:*

# 应该看到类似输出：
# 1) "google_oauth_state:gLj1Ek7XgtDJKHQoQ5X-L--mOWoiSzlxWpQfmZzXb1U="

# 查看key的TTL（应该是600秒 = 10分钟）
TTL google_oauth_state:gLj1Ek7XgtDJKHQoQ5X-L--mOWoiSzlxWpQfmZzXb1U=

# 退出Redis CLI
exit
```

## 关键修复点总结

1. ✅ **代码修复**：将state存储从内存迁移到Redis（防止容器重启丢失state）
2. ✅ **配置修复**：更新 `.env.production` 使用正确的生产域名
3. 🔧 **Google Console**：添加生产环境回调URL（需要手动操作）
4. 🔧 **部署**：构建并推送新镜像到Docker Hub，然后在服务器重启

## 常见问题

**Q: 为什么需要Redis？**
A: 因为容器重启或有多个API实例时，内存存储会丢失state导致OAuth失败。Redis提供持久化和跨实例共享。

**Q: 修改Google Console配置后需要等多久？**
A: 通常即时生效，最多等待1-2分钟。

**Q: 如果还是出现redirect_uri_mismatch怎么办？**
A:
1. 检查Google Console中的URL是否完全匹配（包括http/https、域名、路径）
2. 检查 `.env.production` 中的 `GOOGLE_REDIRECT_URL` 是否正确
3. 检查API日志中显示的redirect URL是否正确
4. 清除浏览器缓存后重试
