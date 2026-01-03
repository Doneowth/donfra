# Google SSO 登录集成指南

本文档说明如何在 Donfra 项目中配置和使用 Google SSO (Single Sign-On) 登录功能。

## 概述

Google SSO 允许用户使用他们的 Google 账号快速登录系统,无需创建新账号或记住额外的密码。

## 已实现的功能

### 后端 (Go API)

1. **数据库模型** ([user/model.go](../donfra-api/internal/domain/user/model.go))
   - `GoogleID` - Google 唯一标识符
   - `GoogleAvatar` - Google 头像 URL

2. **Google OAuth 服务** ([google/google_oauth.go](../donfra-api/internal/domain/google/google_oauth.go))
   - 生成 Google OAuth 授权 URL
   - 处理授权码交换
   - 获取用户信息
   - State 验证和过期管理
   - 使用官方 `golang.org/x/oauth2` 库

3. **用户服务** ([user/service.go](../donfra-api/internal/domain/user/service.go))
   - `LoginOrRegisterWithGoogle()` - 自动登录或注册
   - `GetUserByGoogleID()` - 通过 Google ID 查询用户

4. **Repository** ([user/postgres_repository.go](../donfra-api/internal/domain/user/postgres_repository.go))
   - `FindByGoogleID()` - 数据库查询方法

5. **API 端点** ([handlers/user.go](../donfra-api/internal/http/handlers/user.go))
   - `GET /api/auth/google/url` - 生成授权 URL
   - `GET /api/auth/google/callback` - 处理 Google 回调

### 前端 (Next.js)

1. **API 客户端** ([lib/api.ts](../donfra-ui/lib/api.ts))
   - `api.auth.googleAuthURL()` - 获取授权 URL
   - `api.auth.googleCallback()` - 处理回调

2. **登录模态框** ([components/auth/SignInModal.tsx](../donfra-ui/components/auth/SignInModal.tsx))
   - "Sign in with Google" 按钮
   - Google 品牌图标
   - 自动重定向到 Google 登录页

### 数据库 Schema

Users 表已经包含 Google OAuth 字段 (定义在 `infra/db/001_create_users_table.sql`):
- `google_id` - Google 唯一标识符 (VARCHAR, UNIQUE, 可空)
- `google_avatar` - Google 头像 URL (TEXT, 可空)
- `email` 和 `password` 字段可空,支持纯 OAuth 用户

无需单独的迁移脚本。

## 配置步骤

### 1. 创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API

### 2. 配置 OAuth 2.0 凭据

1. 在 Google Cloud Console 中,进入 **APIs & Services** > **Credentials**
2. 点击 **Create Credentials** > **OAuth 2.0 Client IDs**
3. 选择应用类型: **Web application**
4. 配置:
   - **Authorized JavaScript origins**: `https://yourdomain.com`
   - **Authorized redirect URIs**: `https://yourdomain.com/api/auth/google/callback`
5. 获取:
   - **Client ID**
   - **Client Secret**

### 3. 配置环境变量

在 `donfra-api` 中添加:

```bash
# Google OAuth 配置
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URL=https://yourdomain.com/api/auth/google/callback

# 本地开发
GOOGLE_REDIRECT_URL=http://localhost:8080/api/auth/google/callback
```

### 4. 更新 main.go

在 `cmd/donfra-api/main.go` 中初始化 Google OAuth 服务:

```go
package main

import (
    "donfra-api/internal/domain/google"
    "donfra-api/internal/http/handlers"
    "os"
)

func main() {
    // ... 其他初始化代码 ...

    // 初始化 Google OAuth 服务
    googleSvc := google.NewGoogleOAuthService(
        os.Getenv("GOOGLE_CLIENT_ID"),
        os.Getenv("GOOGLE_CLIENT_SECRET"),
        os.Getenv("GOOGLE_REDIRECT_URL"),
    )

    // 创建 handlers,传入 googleSvc
    h := handlers.New(
        roomSvc,
        studySvc,
        authSvc,
        userSvc,
        googleSvc,      // Google OAuth service
        interviewSvc,
        livekitSvc,
    )

    // ... 其他代码 ...
}
```

### 5. 添加路由

在 `internal/http/router/router.go` 中注册路由:

```go
// Google OAuth 路由
r.Get("/auth/google/url", h.GoogleAuthURL)
r.Get("/auth/google/callback", h.GoogleCallback)
```

### 6. 安装 Go 依赖

```bash
cd donfra-api
go get golang.org/x/oauth2
go get golang.org/x/oauth2/google
go mod tidy
```

### 7. 运行数据库迁移

```bash
psql -U your_user -d donfra < infra/db/migration_add_google_oauth.sql
```

### 8. 重启服务

```bash
# Docker Compose
make localdev-restart-api
make localdev-restart-ui

# Kubernetes
make k8s-restart-api
make k8s-restart-ui
```

## 使用流程

### 用户登录流程

1. 用户打开登录模态框
2. 点击 "Sign in with Google" 按钮
3. 前端调用 `/api/auth/google/url` 获取 Google 授权 URL
4. 用户被重定向到 Google 登录页面
5. 用户在 Google 页面登录并授权
6. Google 重定向回 `/api/auth/google/callback?code=xxx&state=xxx`
7. 后端:
   - 验证 state 参数
   - 使用 code 交换 access token
   - 获取用户信息 (ID, email, name, avatar)
   - 查询数据库是否存在该 Google ID
   - 如果存在: 直接登录
   - 如果不存在: 创建新用户
8. 设置 JWT cookie
9. 返回用户信息
10. 前端更新认证状态

### 数据流

```
用户 → 点击 Google 登录
         ↓
    GET /api/auth/google/url
         ↓
    返回: { auth_url, state }
         ↓
    重定向到 Google → 用户登录授权
         ↓
    Google 回调 → GET /api/auth/google/callback?code=xxx&state=xxx
         ↓
    验证 state → 交换 code 获取 token
         ↓
    获取用户信息 → 查询/创建用户
         ↓
    生成 JWT → 设置 cookie
         ↓
    返回用户信息 → 前端更新状态
```

## API 端点文档

### GET /api/auth/google/url

生成 Google OAuth 授权 URL

**响应:**
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "abc123..."
}
```

### GET /api/auth/google/callback

处理 Google OAuth 回调

**Query 参数:**
- `code` (string, required): Google 授权码
- `state` (string, required): 状态码

**响应:**
```json
{
  "user": {
    "id": 1,
    "email": "user@gmail.com",
    "username": "John Doe",
    "role": "user",
    "isActive": true,
    "createdAt": "2026-01-02T00:00:00Z"
  },
  "token": "eyJhbGc..."
}
```

**错误响应:**
- `400 Bad Request`: 缺少 code 或 state
- `401 Unauthorized`: Google 验证失败
- `403 Forbidden`: 用户账号已停用
- `500 Internal Server Error`: 服务器错误

## 安全特性

- **State 参数**: 防止 CSRF 攻击
- **State 过期**: 10分钟自动过期
- **HTTPS Only**: 生产环境必须使用 HTTPS
- **唯一 Google ID**: 防止重复注册
- **JWT Cookie**: HttpOnly, SameSite=Lax

## 本地测试

### 开发环境配置

1. 在 Google Cloud Console 添加本地回调 URL:
   ```
   http://localhost:8080/api/auth/google/callback
   ```

2. 配置环境变量:
   ```bash
   GOOGLE_REDIRECT_URL=http://localhost:8080/api/auth/google/callback
   ```

3. 启动服务:
   ```bash
   make localdev-up
   ```

## 生产环境

确保:
- ✅ 使用 HTTPS
- ✅ 回调 URL 与 Google Console 配置一致
- ✅ 设置正确的 CORS 策略
- ✅ Cookie Secure 标志设为 true
- ✅ 环境变量安全存储

## 故障排查

### 常见问题

1. **redirect_uri_mismatch 错误**
   - 检查 `GOOGLE_REDIRECT_URL` 是否与 Google Console 配置完全一致
   - 确保包含协议 (http/https)

2. **invalid_client 错误**
   - 检查 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`
   - 确认 Google Cloud 项目已启用 Google+ API

3. **State 验证失败**
   - State 已过期 (10分钟)
   - 重新点击登录按钮

4. **用户创建失败**
   - 检查数据库迁移是否成功
   - 查看 API 日志

## 扩展功能

### 可添加的功能

1. **账号绑定**: 允许邮箱用户绑定 Google
2. **头像同步**: 定期更新 Google 头像
3. **Token 刷新**: 使用 refresh_token 延长会话
4. **多OAuth**: 支持 GitHub, Facebook 等
5. **审计日志**: 记录所有登录活动

## 参考文档

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [golang.org/x/oauth2](https://pkg.go.dev/golang.org/x/oauth2)
- [Google API Console](https://console.cloud.google.com/)

## 更新日志

- **2026-01-02**: 实现 Google SSO 登录功能,替换微信登录
