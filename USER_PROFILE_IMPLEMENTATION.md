# User Profile Page Implementation

## 概述

实现了一个功能完整的用户个人资料页面 (`/user`)，包含账户信息显示、密码更新和面试房间管理功能。

## 功能特性

### 1. 账户信息展示
- 用户名 (Username)
- 邮箱 (Email)
- 角色 (Role: user/admin)
- 注册时间 (Member Since)

### 2. 密码更新
所有用户都可以更新密码：
- 需要输入当前密码
- 新密码最少 8 个字符
- 需要确认新密码
- 实时验证和错误提示
- 成功后显示确认消息

### 3. 面试房间管理（仅管理员）
管理员用户额外功能：
- 查看所有活跃的面试房间
- 创建新的面试房间
- 复制邀请链接（点击链接框即可复制）
- 在新窗口打开房间
- 关闭房间
- 显示房间在线人数
- 显示房间创建时间

## 技术实现

### 后端 API

#### 1. 密码更新 API
**路径**: `POST /api/auth/update-password`
**认证**: 需要登录
**请求体**:
```json
{
  "current_password": "当前密码",
  "new_password": "新密码"
}
```
**响应**:
```json
{
  "message": "password updated successfully"
}
```

#### 2. 获取用户房间 API
**路径**: `GET /api/interview/my-rooms`
**认证**: 需要登录
**响应**:
```json
{
  "rooms": [
    {
      "id": 1,
      "room_id": "uuid-string",
      "owner_id": 1,
      "headcount": 2,
      "code_snapshot": "",
      "invite_link": "http://...",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 前端实现

#### 文件结构
```
donfra-ui/
├── app/
│   └── user/
│       └── page.tsx          # 用户资料页面
├── lib/
│   └── api.ts                # API 客户端（已更新）
└── public/
    └── styles/
        └── main.css          # 样式（已添加 user-info-value）
```

#### 样式设计
- 使用 SFV2.mp4 作为背景视频
- 遵循现有的 007 × Defender 主题设计
- 使用相同的颜色方案：
  - 背景：深色渐变
  - 主色调：brass (#A98E64)
  - 字体：Orbitron (标题), IBM Plex Mono (正文)
- 响应式设计，移动端友好

#### 导航集成
在首页 header 的用户菜单中添加了 "Profile" 链接：
```
用户菜单
├── Profile → 跳转到 /user
└── Sign Out → 登出
```

## 安全特性

1. **密码验证**
   - 验证当前密码是否正确
   - 最小长度要求（8 字符）
   - 密码哈希存储（bcrypt）

2. **权限控制**
   - 只能更新自己的密码
   - 只有管理员可以看到房间管理功能
   - 只有房间所有者可以关闭房间

3. **认证要求**
   - 所有 API 调用都需要有效的 auth_token cookie
   - 未登录用户会被重定向到首页

## 测试

### 测试脚本
```bash
# 密码更新功能测试
./smoke/test-password-update.sh

# 用户资料页面完整测试
./smoke/test-user-page.sh
```

### 测试覆盖
- ✅ 用户注册和登录
- ✅ 查看个人资料
- ✅ 更新密码
- ✅ 使用新密码登录
- ✅ 错误密码拒绝
- ✅ 密码长度验证
- ✅ 管理员创建房间
- ✅ 管理员查看房间列表
- ✅ 管理员关闭房间

## 使用指南

### 普通用户
1. 登录后点击右上角用户名
2. 选择 "Profile"
3. 查看账户信息
4. 如需更新密码：
   - 输入当前密码
   - 输入新密码（最少 8 字符）
   - 确认新密码
   - 点击 "Update Password"

### 管理员用户
除了普通用户功能外，还可以：
1. 查看所有活跃的面试房间
2. 点击 "+ Create Room" 创建新房间
3. 点击邀请链接可复制到剪贴板
4. 点击 "Join" 在新窗口打开房间
5. 点击 "Close" 关闭不需要的房间

## 相关文件

### 后端
- `donfra-api/internal/domain/user/service.go` - 密码更新逻辑
- `donfra-api/internal/http/handlers/user.go` - 密码更新处理器
- `donfra-api/internal/domain/interview/repository.go` - 房间查询
- `donfra-api/internal/domain/interview/service.go` - 房间业务逻辑
- `donfra-api/internal/http/handlers/interview.go` - 房间 API 处理器
- `donfra-api/internal/http/router/router.go` - 路由配置

### 前端
- `donfra-ui/app/user/page.tsx` - 用户资料页面
- `donfra-ui/app/page.tsx` - 首页（添加 Profile 链接）
- `donfra-ui/lib/api.ts` - API 客户端
- `donfra-ui/public/styles/main.css` - 样式表

### 测试
- `smoke/test-password-update.sh` - 密码更新测试
- `smoke/test-user-page.sh` - 用户资料页面完整测试

## 构建和部署

```bash
# 构建后端
cd donfra-api
go build ./cmd/donfra-api

# 构建前端
cd donfra-ui
npm run build

# 使用 Docker Compose
make localdev-up

# 或使用 Kubernetes
make k8s-rebuild
```

## 后续优化建议

1. **用户体验**
   - 添加头像上传功能
   - 添加用户名编辑功能
   - 房间列表添加搜索/过滤功能
   - 添加房间详情查看（代码快照）

2. **功能增强**
   - 邮箱更新功能
   - 双因素认证（2FA）
   - 密码强度指示器
   - 房间使用统计

3. **性能优化**
   - 房间列表分页
   - 实时房间状态更新（WebSocket）
   - 缓存用户信息

## 依赖项

- React 18
- Next.js 14
- Framer Motion 11
- Go 1.24
- GORM
- PostgreSQL 16
