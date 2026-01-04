# Google Cloud Console OAuth 配置详细指南

## 问题
在Google Cloud Console界面中找不到添加重定向URI的地方。

---

## 🔍 详细步骤（带UI说明）

### 步骤1: 访问Google Cloud Console

1. 打开浏览器，访问：
   ```
   https://console.cloud.google.com/apis/credentials
   ```

2. 如果需要登录，使用你的Google账号登录（创建OAuth客户端的账号）

---

### 步骤2: 选择正确的项目

1. 在页面顶部，检查当前选择的项目
   - 点击项目名称下拉菜单
   - 选择包含OAuth客户端ID `591319272586-...` 的项目

---

### 步骤3: 找到OAuth 2.0客户端ID

1. 在 **凭据 (Credentials)** 页面，你会看到几个部分：
   - OAuth 2.0 客户端 ID
   - 服务帐号密钥
   - API密钥

2. 在 **"OAuth 2.0 客户端 ID"** 部分：
   - 找到名称或客户端ID包含 `591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi` 的条目
   - 类型应该是：**Web 应用**

3. 点击这一行最右侧的 **编辑图标**（铅笔图标 ✏️）

---

### 步骤4: 编辑OAuth客户端配置

点击编辑后，你会看到以下页面结构：

```
┌─────────────────────────────────────────────────┐
│ 编辑 OAuth 客户端                                │
├─────────────────────────────────────────────────┤
│                                                 │
│ 名称                                             │
│ [文本框: 你的OAuth客户端名称]                     │
│                                                 │
│ 已获授权的 JavaScript 来源                        │
│ URI 1  [+ 添加 URI]                              │
│ ┌─────────────────────────────────────────┐    │
│ │ http://localhost                         │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ 已获授权的重定向 URI  ⭐ (这里!)                   │
│ URI 1  [+ 添加 URI]                              │
│ ┌─────────────────────────────────────────┐    │
│ │ http://localhost:8080/api/auth/google/  │    │
│ │ callback                                 │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ [保存]  [取消]                                   │
└─────────────────────────────────────────────────┘
```

---

### 步骤5: 添加生产环境重定向URI

1. 在 **"已获授权的重定向 URI"** 部分：
   - 你会看到已有的URI（可能是 `http://localhost:8080/api/auth/google/callback`）
   - 点击 **"+ 添加 URI"** 按钮

2. **添加以下URI**（每个URI单独添加）：

   **如果你的生产环境使用HTTP:**
   ```
   http://donfra.com/api/auth/google/callback
   ```

   **如果你的生产环境使用HTTPS:**
   ```
   https://donfra.com/api/auth/google/callback
   ```

   **建议：两个都添加**（支持HTTP和HTTPS）
   ```
   http://donfra.com/api/auth/google/callback
   https://donfra.com/api/auth/google/callback
   ```

3. **完整的URI列表应该是：**
   ```
   ✅ http://localhost:8080/api/auth/google/callback
   ✅ http://localhost/api/auth/google/callback
   ✅ http://donfra.com/api/auth/google/callback
   ✅ https://donfra.com/api/auth/google/callback
   ```

4. 点击页面底部的 **"保存"** 按钮

---

## 🔧 如果还是找不到编辑入口

### 方法A: 直接URL访问

如果你知道项目ID，可以直接访问：
```
https://console.cloud.google.com/apis/credentials/oauthclient/591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi.apps.googleusercontent.com
```

### 方法B: 从API和服务菜单进入

1. 在左侧导航栏，点击 **"API和服务"**
2. 点击 **"凭据"**
3. 在 **"OAuth 2.0 客户端 ID"** 列表中找到你的客户端
4. 点击客户端名称或编辑图标

### 方法C: 创建新的OAuth客户端（如果找不到现有的）

如果你完全找不到现有的OAuth客户端，可能需要创建一个新的：

1. 在凭据页面，点击顶部的 **"+ 创建凭据"**
2. 选择 **"OAuth 客户端 ID"**
3. 应用类型选择：**"Web 应用"**
4. 填写名称（例如："Donfra Web App"）
5. 在 **"已获授权的重定向 URI"** 中添加：
   ```
   http://localhost:8080/api/auth/google/callback
   http://localhost/api/auth/google/callback
   http://donfra.com/api/auth/google/callback
   https://donfra.com/api/auth/google/callback
   ```
6. 点击 **"创建"**
7. 记录新的客户端ID和客户端密钥
8. 更新你的 `.env.production` 文件

---

## 📱 界面语言问题

如果你的Google Console界面是英文：

- **"已获授权的重定向 URI"** = **"Authorized redirect URIs"**
- **"+ 添加 URI"** = **"+ ADD URI"**
- **"保存"** = **"SAVE"**

---

## ✅ 验证配置

配置完成后，你可以验证：

1. **在OAuth客户端详情页面**，你应该看到：
   ```
   Authorized redirect URIs:
   • http://localhost:8080/api/auth/google/callback
   • http://localhost/api/auth/google/callback
   • http://donfra.com/api/auth/google/callback
   • https://donfra.com/api/auth/google/callback
   ```

2. **下载JSON配置**（可选）：
   - 在OAuth客户端列表，点击右侧的下载图标
   - 打开JSON文件，检查 `redirect_uris` 数组：
   ```json
   {
     "web": {
       "client_id": "591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi.apps.googleusercontent.com",
       "client_secret": "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",
       "redirect_uris": [
         "http://localhost:8080/api/auth/google/callback",
         "http://localhost/api/auth/google/callback",
         "http://donfra.com/api/auth/google/callback",
         "https://donfra.com/api/auth/google/callback"
       ]
     }
   }
   ```

---

## 🚨 常见问题

### Q: 点击保存后没有反应？
**A:** 检查是否有错误提示，常见原因：
- URI格式不正确（必须是完整的URL，包括 `http://` 或 `https://`）
- URI中有多余的空格
- 域名不存在或无法访问

### Q: 保存后需要等多久生效？
**A:** 通常是即时生效，最多等待1-2分钟。

### Q: 我有多个Google账号，如何确认用对了账号？
**A:**
1. 点击右上角的用户头像
2. 检查当前登录的邮箱
3. 确保是创建OAuth客户端的账号

### Q: 我没有权限编辑？
**A:** 你需要以下权限之一：
- 项目所有者 (Owner)
- 项目编辑者 (Editor)
- OAuth客户端管理员

---

## 📞 下一步

配置完成后：

1. **等待1-2分钟**让配置生效

2. **清除浏览器缓存**

3. **重新测试OAuth登录**：
   - 访问：https://donfra.com 或 http://donfra.com
   - 点击Google登录
   - 应该不再出现 `redirect_uri_mismatch` 错误

4. **如果还有问题**，请提供：
   - Google Console中配置的完整URI列表截图
   - 浏览器控制台中的完整错误信息
   - API日志：`docker-compose logs api | grep google`

---

## 🎯 快速检查清单

- [ ] 访问了正确的Google Cloud Console项目
- [ ] 找到了OAuth 2.0 客户端ID（`591319272586-...`）
- [ ] 点击了编辑图标（铅笔）
- [ ] 在"已获授权的重定向 URI"部分添加了生产环境URL
- [ ] 添加的URL完全匹配 `.env.production` 中的 `GOOGLE_REDIRECT_URL`
- [ ] 点击了"保存"按钮
- [ ] 等待了1-2分钟
- [ ] 清除了浏览器缓存
- [ ] 重新测试了OAuth登录流程
