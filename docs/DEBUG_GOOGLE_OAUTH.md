# Google OAuth 调试指南

## 错误：{"error":"Google login failed"}

这个错误表示OAuth回调成功到达后端，但在处理用户登录/注册时失败。

---

## 🔍 诊断步骤

### 1. 查看详细的API日志

SSH到服务器执行：

```bash
cd /path/to/donfra/infra

# 查看最近的API日志（包含错误详情）
docker-compose logs --tail=100 api

# 或者实时查看日志
docker-compose logs -f api
```

**关键日志查找：**
- 查找包含 "google" 的行
- 查找包含 "error" 的行
- 查找包含 "failed" 的行

### 2. 检查Redis连接

```bash
# 检查Redis是否运行
docker-compose ps redis

# 连接到Redis
docker exec -it donfra-redis redis-cli

# 测试连接
PING
# 应该返回: PONG

# 查看所有keys
KEYS *

# 查看OAuth state keys（在点击登录后10分钟内）
KEYS google_oauth_state:*

# 退出
exit
```

### 3. 检查数据库连接

```bash
# 连接到PostgreSQL
docker exec -it donfra-db psql -U donfra -d donfra_study

# 检查users表结构
\d users

# 查看是否有google_id和google_avatar列
# 应该看到：
# google_id      | character varying(255)
# google_avatar  | text

# 查看现有用户
SELECT id, email, username, google_id FROM users;

# 退出
\q
```

### 4. 检查环境变量

```bash
# 进入API容器
docker exec -it donfra-api sh

# 检查Google OAuth配置
echo "GOOGLE_CLIENT_ID: $GOOGLE_CLIENT_ID"
echo "GOOGLE_CLIENT_SECRET: $GOOGLE_CLIENT_SECRET"
echo "GOOGLE_REDIRECT_URL: $GOOGLE_REDIRECT_URL"
echo "FRONTEND_URL: $FRONTEND_URL"
echo "USE_REDIS: $USE_REDIS"
echo "REDIS_ADDR: $REDIS_ADDR"
echo "DATABASE_URL: $DATABASE_URL"

# 退出
exit
```

---

## 🐛 常见问题和解决方案

### 问题1: Redis连接失败

**症状：**
```
failed to store state in Redis: dial tcp: lookup redis
```

**解决方案：**
```bash
# 检查Redis是否运行
docker-compose ps redis

# 如果没运行，启动Redis
docker-compose up -d redis

# 重启API
docker-compose restart api
```

### 问题2: State验证失败（invalid state parameter）

**症状：**
```
failed to verify Google login: invalid state parameter
```

**原因：**
- API容器重启导致内存中的state丢失（旧版本）
- Redis中没有state（新版本但Redis未配置）
- State已过期（超过10分钟）

**解决方案：**
1. 确保API使用 `doneowth/donfra-api:1.0.1` 或更高版本
2. 确保Redis正常运行
3. 重新点击Google登录（生成新的state）

### 问题3: 数据库schema不匹配

**症状：**
```
pq: column "google_id" does not exist
```

**解决方案：**
```bash
# 连接到数据库
docker exec -it donfra-db psql -U donfra -d donfra_study

# 添加缺失的列
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_avatar TEXT;

# 修改email和password为可空
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

# 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
    ON users(google_id)
    WHERE google_id IS NOT NULL AND google_id != '';

# 退出
\q

# 重启API
docker-compose restart api
```

### 问题4: Google API调用失败

**症状：**
```
failed to get google user info: oauth2: cannot fetch token
```

**可能原因：**
- `GOOGLE_CLIENT_ID` 或 `GOOGLE_CLIENT_SECRET` 错误
- API容器无法访问Google API（网络问题）

**解决方案：**
```bash
# 测试API容器的网络连接
docker exec -it donfra-api sh

# 测试能否访问Google
wget -O- https://www.googleapis.com/oauth2/v3/userinfo 2>&1 | head -20

# 检查DNS
nslookup www.google.com

exit
```

---

## 📋 完整诊断清单

运行以下命令收集所有诊断信息：

```bash
cd /path/to/donfra/infra

echo "=== 1. Container Status ==="
docker-compose ps

echo -e "\n=== 2. API Logs (last 50 lines) ==="
docker-compose logs --tail=50 api

echo -e "\n=== 3. Redis Status ==="
docker exec -it donfra-redis redis-cli PING

echo -e "\n=== 4. Redis Keys ==="
docker exec -it donfra-redis redis-cli KEYS "*"

echo -e "\n=== 5. Environment Variables ==="
docker exec donfra-api sh -c 'echo "GOOGLE_REDIRECT_URL: $GOOGLE_REDIRECT_URL"'
docker exec donfra-api sh -c 'echo "FRONTEND_URL: $FRONTEND_URL"'
docker exec donfra-api sh -c 'echo "USE_REDIS: $USE_REDIS"'

echo -e "\n=== 6. Database Users Table ==="
docker exec -it donfra-db psql -U donfra -d donfra_study -c "\d users"

echo -e "\n=== 7. Network Test from API Container ==="
docker exec donfra-api sh -c 'wget -O- -q https://www.google.com 2>&1 | head -5'
```

---

## 🎯 最可能的原因

根据错误信息 `{"error":"Google login failed"}`，最可能的原因是：

1. **数据库schema缺少Google OAuth字段**
   - 运行 `infra/db/001_create_users_table.sql` 中的schema
   - 或手动添加 `google_id` 和 `google_avatar` 列

2. **Redis未正确配置或未运行**
   - 检查 `USE_REDIS=true`
   - 检查Redis容器状态

3. **Google API凭证错误**
   - 验证 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`

---

## 💡 快速修复（最常见情况）

如果是数据库schema问题：

```bash
# 1. 更新数据库schema
docker exec -it donfra-db psql -U donfra -d donfra_study << 'EOF'
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_avatar TEXT;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL AND google_id != '';
EOF

# 2. 重启API
docker-compose restart api

# 3. 重新测试Google登录
```

---

## 📞 提供诊断信息

如果问题仍然存在，请提供以下信息：

1. **API日志**（最近50行）：
   ```bash
   docker-compose logs --tail=50 api
   ```

2. **Redis状态**：
   ```bash
   docker exec -it donfra-redis redis-cli INFO server
   ```

3. **数据库schema**：
   ```bash
   docker exec -it donfra-db psql -U donfra -d donfra_study -c "\d users"
   ```

4. **环境变量**：
   ```bash
   docker exec donfra-api env | grep -E 'GOOGLE|REDIS|FRONTEND'
   ```
