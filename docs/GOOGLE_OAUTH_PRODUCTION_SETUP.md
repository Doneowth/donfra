# Google OAuth 生产环境配置步骤

## 问题
生产环境Google OAuth回调到localhost导致失败。

## 解决方案

### 1. 更新Google Cloud Console配置

访问：https://console.cloud.google.com/apis/credentials

1. 找到你的OAuth 2.0客户端ID：`591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi.apps.googleusercontent.com`

2. 点击编辑

3. 在 **已获授权的重定向 URI** 部分，添加生产环境URL：
   ```
   http://donfra.com/api/auth/google/callback
   ```

4. 如果使用HTTPS（推荐），使用：
   ```
   https://donfra.com/api/auth/google/callback
   ```

5. 保存更改

### 2. 更新后的配置

已更新 `infra/.env.production`：
```bash
GOOGLE_CLIENT_ID=591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URL=http://donfra.com/api/auth/google/callback
FRONTEND_URL=http://donfra.com
```

### 3. 重启生产环境服务

```bash
cd infra
docker-compose down api
docker-compose up -d api
docker-compose logs -f api
```

查看日志确认配置加载正确：
```
[donfra-api] google oauth service initialized with Redis (redirect: http://donfra.com/api/auth/google/callback, frontend: http://donfra.com)
```

### 4. 测试OAuth流程

1. 访问：http://donfra.com
2. 点击Google登录
3. 应该跳转到Google授权页面
4. 授权后应该重定向回：http://donfra.com（而不是localhost）

## 注意事项

- Google OAuth配置更新后可能需要几分钟生效
- 如果你的网站使用HTTPS，所有URL都应该使用 `https://`
- 确保域名已正确解析到服务器IP：97.107.136.151
