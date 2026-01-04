# Donfra JWT Session Management

## 概述

Donfra使用JWT (JSON Web Token) 进行用户会话管理，支持两种登录方式：
1. **传统登录**：Email/Password
2. **Google OAuth**：Google账号登录

JWT存储在HTTP-only Cookie中，有效期为7天。

---

## 时序图

### 1. 用户注册流程 (Email/Password)

```
Client                Handler              UserService           Repository          Database
  |                      |                      |                     |                  |
  |--POST /api/auth/register------------------> |                     |                  |
  |  {email, password, username}                |                     |                  |
  |                      |                      |                     |                  |
  |                      |---Register()-------->|                     |                  |
  |                      |                      |--ValidateEmail()--->|                  |
  |                      |                      |<--------------------|                  |
  |                      |                      |                     |                  |
  |                      |                      |--HashPassword()---->|                  |
  |                      |                      |<--------------------|                  |
  |                      |                      |                     |                  |
  |                      |                      |--ExistsByEmail()--->|                  |
  |                      |                      |                     |--SELECT-------->|
  |                      |                      |                     |<-----------------|
  |                      |                      |<--------------------|                  |
  |                      |                      |                     |                  |
  |                      |                      |--Create()---------->|                  |
  |                      |                      |                     |--INSERT-------->|
  |                      |                      |                     |<-----------------|
  |                      |                      |<--------------------|                  |
  |                      |                      |                     |                  |
  |                      |<--User---------------|                     |                  |
  |                      |                      |                     |                  |
  |<--201 {user}---------|                      |                     |                  |
  |                      |                      |                     |                  |
```

### 2. 用户登录流程 (Email/Password)

```
Client                Handler              UserService           Repository          Database
  |                      |                      |                     |                  |
  |--POST /api/auth/login---------------------->|                     |                  |
  |  {email, password}                          |                     |                  |
  |                      |                      |                     |                  |
  |                      |---Login()----------->|                     |                  |
  |                      |                      |--FindByEmail()----->|                  |
  |                      |                      |                     |--SELECT-------->|
  |                      |                      |                     |<-----------------|
  |                      |                      |<--User--------------|                  |
  |                      |                      |                     |                  |
  |                      |                      |--CheckPassword()--->|                  |
  |                      |                      |<--------------------|                  |
  |                      |                      |                     |                  |
  |                      |                      |--GenerateToken()--->|                  |
  |                      |                      |  JWT {              |                  |
  |                      |                      |    user_id: 123,    |                  |
  |                      |                      |    email: "...",    |                  |
  |                      |                      |    role: "user",    |                  |
  |                      |                      |    exp: +7days      |                  |
  |                      |                      |  }                  |                  |
  |                      |                      |<--token-------------|                  |
  |                      |                      |                     |                  |
  |                      |<--User, token--------|                     |                  |
  |                      |                      |                     |                  |
  |--Set-Cookie: auth_token=<JWT>-------------- |                     |                  |
  |  HttpOnly=true                              |                     |                  |
  |  SameSite=Lax                               |                     |                  |
  |  MaxAge=7days                               |                     |                  |
  |                      |                      |                     |                  |
  |<--200 {user, token}--|                      |                     |                  |
  |                      |                      |                     |                  |
```

### 3. Google OAuth 登录流程

```
Client          Handler         GoogleService       Google API      UserService      Repository      Database
  |                |                  |                  |                |                |               |
  |--GET /api/auth/google/url-------->|                  |                |                |               |
  |                |                  |                  |                |                |               |
  |                |--GenerateAuthURL()->                |                |                |               |
  |                |                  |--generateState()->                |                |               |
  |                |                  |  (random 32B)    |                |                |               |
  |                |                  |                  |                |                |               |
  |                |                  |--Store in Redis->|                |                |               |
  |                |                  |  Key: google_oauth_state:{state}  |                |               |
  |                |                  |  TTL: 10min      |                |                |               |
  |                |                  |                  |                |                |               |
  |                |<--auth_url, state|                  |                |                |               |
  |                |                  |                  |                |                |               |
  |<--200 {auth_url, state}----------|                  |                |                |               |
  |                |                  |                  |                |                |               |
  |--Redirect to Google auth_url----------------------------->|          |                |               |
  |                |                  |                  |                |                |               |
  |                |                  |                  |<--User Login--|                |               |
  |                |                  |                  |                |                |               |
  |<--Redirect /api/auth/google/callback?code=XXX&state=YYY--|           |                |               |
  |                |                  |                  |                |                |               |
  |--GET /api/auth/google/callback-->|                  |                |                |               |
  |  ?code=XXX&state=YYY              |                  |                |                |               |
  |                |                  |                  |                |                |               |
  |                |--ExchangeCode()------------------------>|            |                |               |
  |                |                  |--validateState()->|              |                |               |
  |                |                  |  Check Redis     |               |                |               |
  |                |                  |<-----------------|                |                |               |
  |                |                  |                  |                |                |               |
  |                |                  |--Exchange code-->|                |                |               |
  |                |                  |  for access token|                |                |               |
  |                |                  |<--access_token---|                |                |               |
  |                |                  |                  |                |                |               |
  |                |                  |--getUserInfo()-->|                |                |               |
  |                |                  |<--{id, email, name, picture}-----|                |               |
  |                |                  |                  |                |                |               |
  |                |                  |--Delete state from Redis--------->|                |               |
  |                |                  |                  |                |                |               |
  |                |<--GoogleUserInfo-|                  |                |                |               |
  |                |                  |                  |                |                |               |
  |                |--LoginOrRegisterWithGoogle()------------------------>|                |               |
  |                |                  |                  |                |                |               |
  |                |                  |                  |                |--FindByGoogleID()->            |
  |                |                  |                  |                |                |--SELECT------>|
  |                |                  |                  |                |                |<--------------|
  |                |                  |                  |                |<--User or nil--|               |
  |                |                  |                  |                |                |               |
  |                |                  |                  |                |--Create/Update->              |
  |                |                  |                  |                |                |--INSERT/UPDATE|
  |                |                  |                  |                |                |<--------------|
  |                |                  |                  |                |<--User---------|               |
  |                |                  |                  |                |                |               |
  |                |                  |                  |                |--GenerateToken()->             |
  |                |                  |                  |                |<--token--------|               |
  |                |                  |                  |                |                |               |
  |                |<--User, token----------------------------|           |                |               |
  |                |                  |                  |                |                |               |
  |--Set-Cookie: auth_token=<JWT>----|                  |                |                |               |
  |  HttpOnly=true                    |                  |                |                |               |
  |  SameSite=Lax                     |                  |                |                |               |
  |  MaxAge=7days                     |                  |                |                |               |
  |                |                  |                  |                |                |               |
  |--302 Redirect to frontendURL-----|                  |                |                |               |
  |  (http://donfra.com)              |                  |                |                |               |
  |                |                  |                  |                |                |               |
```

### 4. 受保护路由访问流程 (RequireAuth Middleware)

```
Client          Middleware          UserService          Handler           Database
  |                  |                    |                   |                 |
  |--GET /api/auth/me--------------->|    |                   |                 |
  |  Cookie: auth_token=<JWT>        |    |                   |                 |
  |                  |                    |                   |                 |
  |                  |--Extract Cookie--->|                   |                 |
  |                  |                    |                   |                 |
  |                  |--ValidateToken()-->|                   |                 |
  |                  |                    |--Parse JWT------->|                 |
  |                  |                    |--Verify Signature->                 |
  |                  |                    |--Check Expiry---->|                 |
  |                  |                    |<--Claims----------|                 |
  |                  |                    |  {user_id, email, role}             |
  |                  |<--Claims-----------|                   |                 |
  |                  |                    |                   |                 |
  |                  |--Inject to Context->                   |                 |
  |                  |  ctx["user_id"] = 123                  |                 |
  |                  |  ctx["user_email"] = "user@example.com"|                |
  |                  |  ctx["user_role"] = "user"             |                 |
  |                  |                    |                   |                 |
  |                  |--next.ServeHTTP()---------------------->|                 |
  |                  |                    |                   |                 |
  |                  |                    |                   |--Get from ctx-->|
  |                  |                    |                   |                 |
  |                  |                    |                   |--GetUserByID()-->
  |                  |                    |                   |                 |--SELECT
  |                  |                    |                   |                 |<--------
  |                  |                    |                   |<--User----------|
  |                  |                    |                   |                 |
  |<--200 {user}-----|                    |                   |                 |
  |                  |                    |                   |                 |
```

### 5. 可选认证路由访问流程 (OptionalAuth Middleware)

```
Client          Middleware          UserService          Handler           Database
  |                  |                    |                   |                 |
  |--GET /api/lessons---------------->|   |                   |                 |
  |  Cookie: auth_token=<JWT> (可选)  |   |                   |                 |
  |                  |                    |                   |                 |
  |                  |--Try Extract Cookie>                   |                 |
  |                  |                    |                   |                 |
  |                  |--If token exists-->|                   |                 |
  |                  |  ValidateToken()-->|                   |                 |
  |                  |<--Claims (or nil)--|                   |                 |
  |                  |                    |                   |                 |
  |                  |--If valid: Inject to Context           |                 |
  |                  |  ctx["user_id"] = 123                  |                 |
  |                  |  ctx["user_role"] = "user"             |                 |
  |                  |                    |                   |                 |
  |                  |--next.ServeHTTP()---------------------->|                 |
  |                  |  (with or without user context)        |                 |
  |                  |                    |                   |                 |
  |                  |                    |                   |--Check ctx----->|
  |                  |                    |                   |  hasVipAccess = |
  |                  |                    |                   |  (role=="admin")|
  |                  |                    |                   |                 |
  |                  |                    |                   |--ListLessons()-->
  |                  |                    |                   |  (filter by VIP)|--SELECT
  |                  |                    |                   |                 |<--------
  |                  |                    |                   |<--Lessons-------|
  |                  |                    |                   |                 |
  |<--200 {lessons}--|                    |                   |                 |
  |                  |                    |                   |                 |
```

### 6. Token刷新流程

```
Client          Handler          UserService          JWT
  |                |                  |                  |
  |--POST /api/auth/refresh--------->|                  |
  |  Cookie: auth_token=<old_JWT>    |                  |
  |  (RequireAuth middleware已验证)   |                  |
  |                |                  |                  |
  |                |--Extract user_id from context------>|
  |                |                  |                  |
  |                |--GetUserByID()-->|                  |
  |                |<--User-----------|                  |
  |                |                  |                  |
  |                |--GenerateToken()->|                 |
  |                |                  |--Create new JWT->|
  |                |                  |  {              |
  |                |                  |    user_id,     |
  |                |                  |    email,       |
  |                |                  |    role,        |
  |                |                  |    exp: +7days  |
  |                |                  |  }              |
  |                |                  |<--new_token-----|
  |                |<--token----------|                  |
  |                |                  |                  |
  |--Set-Cookie: auth_token=<new_JWT>|                  |
  |  MaxAge=7days                     |                  |
  |                |                  |                  |
  |<--200 {token}--|                  |                  |
  |                |                  |                  |
```

### 7. 登出流程

```
Client          Handler
  |                |
  |--POST /api/auth/logout--------->|
  |                |                 |
  |                |--Clear Cookie-->|
  |                |                 |
  |--Set-Cookie: auth_token=""------|
  |  MaxAge=-1 (立即删除)            |
  |                |                 |
  |<--200 {message: "logged out"}----|
  |                |
```

---

## 关键组件说明

### JWT Claims 结构
```go
{
  "user_id": 123,
  "email": "user@example.com",
  "role": "user",         // "user" or "admin"
  "sub": "123",
  "exp": 1735804800,      // Unix timestamp (7 days from now)
  "iat": 1735200000,      // Issued at
  "iss": "donfra-api"     // Issuer
}
```

### Cookie 配置
```
Name: auth_token
Value: <JWT string>
HttpOnly: true          // 防止XSS攻击
Secure: false           // 生产环境应设为true (HTTPS)
SameSite: Lax           // CSRF保护
MaxAge: 604800          // 7天 (秒)
Path: /
```

### Google OAuth State 存储 (Redis)
```
Key: google_oauth_state:{random_base64_string}
Value: "valid"
TTL: 600秒 (10分钟)
```

---

## 安全特性

1. **HttpOnly Cookie**: JWT存储在HttpOnly cookie中，防止XSS攻击
2. **SameSite=Lax**: 防止CSRF攻击
3. **密码哈希**: 使用bcrypt加密存储密码
4. **JWT签名**: 使用HMAC-SHA256签名，防止篡改
5. **Token过期**: 7天自动过期，需重新登录
6. **OAuth State验证**: 防止CSRF攻击，state在Redis中10分钟过期
7. **Redis持久化**: OAuth state存储在Redis中，支持容器重启和多实例部署

---

## API端点总结

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/auth/register` | POST | 无 | 用户注册 |
| `/api/auth/login` | POST | 无 | Email/Password登录 |
| `/api/auth/logout` | POST | 无 | 登出（清除cookie） |
| `/api/auth/google/url` | GET | 无 | 获取Google OAuth授权URL |
| `/api/auth/google/callback` | GET | 无 | Google OAuth回调 |
| `/api/auth/me` | GET | Optional | 获取当前用户信息 |
| `/api/auth/refresh` | POST | Required | 刷新JWT token |
| `/api/auth/update-password` | POST | Required | 更新密码 |

---

## 环境变量

```bash
JWT_SECRET=your_secret_here          # JWT签名密钥
FRONTEND_URL=http://donfra.com       # 前端URL（OAuth回调后重定向）
GOOGLE_CLIENT_ID=...                 # Google OAuth客户端ID
GOOGLE_CLIENT_SECRET=...             # Google OAuth客户端密钥
GOOGLE_REDIRECT_URL=http://donfra.com/api/auth/google/callback
REDIS_ADDR=redis:6379                # Redis地址
USE_REDIS=true                       # 是否使用Redis存储OAuth state
```
