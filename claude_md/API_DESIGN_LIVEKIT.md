# LiveKit 直播 API 设计文档

## 📡 API Endpoints

### 基础 URL
```
Production: https://donfra.com/api/v1/live
Development: http://localhost:8080/api/v1/live
```

---

## 🎬 Session Management

### 1. 创建直播会话
**POST** `/api/v1/live/sessions`

**权限**: 需要认证 + Admin/Mentor 角色

**Request Body**:
```json
{
  "title": "React 高级技巧 - 实时编程",
  "description": "深入讲解 React Hooks 和性能优化",
  "session_type": "teaching",
  "max_participants": 100,
  "is_public": true,
  "is_recorded": true,
  "scheduled_at": "2025-12-27T15:00:00Z"
}
```

**Response** (201 Created):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "invite_link": "https://donfra.com/live/550e8400-e29b-41d4-a716-446655440000",
  "host_token": "eyJhbGc...",
  "created_at": "2025-12-26T10:00:00Z",
  "message": "Live session created successfully"
}
```

---

### 2. 加入直播会话
**POST** `/api/v1/live/sessions/{session_id}/join`

**权限**:
- Public sessions: 任何认证用户
- Private sessions: 需要 invite_token

**Request Body**:
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "invite_token": "optional_for_private",
  "display_name": "John Doe"
}
```

**Response** (200 OK):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "server_url": "wss://livekit.donfra.com",
  "role": "viewer",
  "can_publish": false,
  "can_subscribe": true,
  "message": "Joined session successfully"
}
```

---

### 3. 获取会话详情
**GET** `/api/v1/live/sessions/{session_id}`

**权限**:
- Public: 任何用户
- Private: 需要认证 + invite_token

**Response** (200 OK):
```json
{
  "id": 1,
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "React 高级技巧",
  "description": "深入讲解...",
  "session_type": "teaching",
  "status": "live",
  "max_participants": 100,
  "current_viewers": 45,
  "is_public": true,
  "is_recorded": true,
  "owner_id": 1,
  "owner_name": "Jane Smith",
  "scheduled_at": "2025-12-27T15:00:00Z",
  "started_at": "2025-12-27T15:02:00Z",
  "created_at": "2025-12-26T10:00:00Z"
}
```

---

### 4. 列出直播会话
**GET** `/api/v1/live/sessions`

**Query Parameters**:
- `status`: scheduled | live | ended | cancelled
- `session_type`: teaching | interview | coding | workshop
- `is_public`: true | false
- `owner_id`: Filter by owner
- `page`: 页码 (默认 1)
- `page_size`: 每页数量 (默认 20, 最大 100)

**Response** (200 OK):
```json
{
  "sessions": [
    {
      "id": 1,
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "React 高级技巧",
      "session_type": "teaching",
      "status": "live",
      "current_viewers": 45,
      "max_participants": 100,
      "is_public": true,
      "is_recorded": true,
      "owner_id": 1,
      "owner_name": "Jane Smith",
      "scheduled_at": "2025-12-27T15:00:00Z",
      "started_at": "2025-12-27T15:02:00Z",
      "created_at": "2025-12-26T10:00:00Z"
    }
  ],
  "total_count": 50,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

---

### 5. 更新会话状态
**PATCH** `/api/v1/live/sessions/{session_id}`

**权限**: 仅 Session Owner

**Request Body**:
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "live",
  "scheduled_at": "2025-12-28T15:00:00Z"
}
```

**Response** (200 OK):
```json
{
  "message": "Session updated successfully"
}
```

---

### 6. 开始直播
**POST** `/api/v1/live/sessions/{session_id}/start`

**权限**: 仅 Session Owner

**Response** (200 OK):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "live",
  "started_at": "2025-12-27T15:02:00Z",
  "message": "Session started successfully"
}
```

---

### 7. 结束直播
**POST** `/api/v1/live/sessions/{session_id}/end`

**权限**: 仅 Session Owner

**Response** (200 OK):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ended",
  "ended_at": "2025-12-27T16:30:00Z",
  "duration": 5280,
  "recording_url": "https://recordings.donfra.com/550e8400...",
  "message": "Session ended successfully"
}
```

---

### 8. 获取会话统计
**GET** `/api/v1/live/sessions/{session_id}/stats`

**权限**: Session Owner 或 Admin

**Response** (200 OK):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "live",
  "current_viewers": 45,
  "total_participants": 78,
  "duration": 3600,
  "started_at": "2025-12-27T15:02:00Z",
  "peak_viewers": 52,
  "participants": [
    {
      "user_id": 5,
      "display_name": "John Doe",
      "role": "viewer",
      "joined_at": "2025-12-27T15:05:00Z",
      "duration": 3300
    }
  ]
}
```

---

### 9. 删除会话
**DELETE** `/api/v1/live/sessions/{session_id}`

**权限**: 仅 Session Owner 或 Admin

**Response** (200 OK):
```json
{
  "message": "Session deleted successfully"
}
```

---

## 👥 Participant Management

### 10. 更新参与者角色
**PATCH** `/api/v1/live/sessions/{session_id}/participants/{user_id}`

**权限**: 仅 Session Owner 或 Co-Host

**Request Body**:
```json
{
  "role": "speaker"
}
```

**Response** (200 OK):
```json
{
  "message": "Participant role updated to speaker"
}
```

---

### 11. 踢出参与者
**POST** `/api/v1/live/sessions/{session_id}/participants/{user_id}/kick`

**权限**: 仅 Session Owner 或 Co-Host

**Response** (200 OK):
```json
{
  "message": "Participant removed from session"
}
```

---

## 🎥 Recording Management

### 12. 开始录制
**POST** `/api/v1/live/sessions/{session_id}/recording/start`

**权限**: 仅 Session Owner

**Response** (200 OK):
```json
{
  "message": "Recording started",
  "recording_id": "rec_123456"
}
```

---

### 13. 停止录制
**POST** `/api/v1/live/sessions/{session_id}/recording/stop`

**权限**: 仅 Session Owner

**Response** (200 OK):
```json
{
  "message": "Recording stopped",
  "recording_url": "https://recordings.donfra.com/rec_123456.mp4"
}
```

---

### 14. 获取录播列表
**GET** `/api/v1/live/recordings`

**Query Parameters**:
- `session_id`: Filter by session
- `owner_id`: Filter by owner
- `page`, `page_size`: Pagination

**Response** (200 OK):
```json
{
  "recordings": [
    {
      "id": 1,
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "React 高级技巧",
      "recording_url": "https://recordings.donfra.com/rec_123456.mp4",
      "duration": 5280,
      "size_bytes": 524288000,
      "created_at": "2025-12-27T16:30:00Z"
    }
  ],
  "total_count": 10,
  "page": 1,
  "page_size": 20
}
```

---

## 🔐 权限模型

### 角色层级
1. **Host (主持人)** - Session 创建者
   - 开始/结束会话
   - 录制控制
   - 修改参与者角色
   - 踢出参与者
   - 全部音视频权限

2. **Co-Host (联合主持人)**
   - 修改参与者角色
   - 踢出参与者
   - 全部音视频权限

3. **Speaker (演讲者)**
   - 发布音视频
   - 屏幕共享

4. **Viewer (观众)**
   - 仅观看
   - 文字聊天

### 访问控制规则

| 操作 | Host | Co-Host | Speaker | Viewer | Guest |
|------|------|---------|---------|--------|-------|
| 创建会话 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 开始会话 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 结束会话 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 加入 Public 会话 | ✅ | ✅ | ✅ | ✅ | ✅ (登录后) |
| 加入 Private 会话 | ✅ | ✅ (with token) | ✅ (with token) | ✅ (with token) | ❌ |
| 发布音视频 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 屏幕共享 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 修改角色 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 踢出用户 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 录制控制 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 文字聊天 | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 🔒 认证流程

### 1. 创建会话
```
User (Admin/Mentor) → POST /api/v1/live/sessions (with auth_token cookie)
→ API validates user role
→ Generate session_id (UUID)
→ Generate invite_token (JWT) for private sessions
→ Return session_id + invite_link + host_token (LiveKit token)
```

### 2. 加入会话
```
User → POST /api/v1/live/sessions/{id}/join (with display_name)
→ API checks:
  - Is session public? OR
  - Does user have valid invite_token?
  - Is user authenticated?
→ Determine role based on:
  - Is owner? → Host
  - Has co-host permission? → Co-Host
  - Default → Viewer
→ Generate LiveKit access_token with permissions
→ Return access_token + server_url
```

### 3. LiveKit Token 结构
```json
{
  "video": {
    "roomJoin": true,
    "canPublish": true/false,
    "canSubscribe": true,
    "canPublishData": true,
    "room": "session_id",
    "roomAdmin": true/false
  },
  "identity": "user_id",
  "name": "display_name"
}
```

---

## 🎨 前端 UI 设计概要

### 页面结构
1. `/live` - 直播广场 (列出所有 public sessions)
2. `/live/create` - 创建直播 (Admin/Mentor only)
3. `/live/{session_id}` - 直播间
4. `/live/my-sessions` - 我的直播历史
5. `/live/recordings` - 录播回放

### 主要组件
- `LiveSessionCard` - 会话卡片
- `LivePlayer` - 直播播放器 (基于 LiveKit React SDK)
- `ControlBar` - 主持人控制台
- `ParticipantList` - 参与者列表
- `ChatPanel` - 聊天面板

---

## 🚀 技术栈

### 后端
- **LiveKit Go SDK** - 生成 access tokens
- **LiveKit Server** - 自部署或使用 LiveKit Cloud
- **PostgreSQL** - 存储会话数据
- **Redis** - 实时统计缓存

### 前端
- **@livekit/react-components** - UI 组件
- **@livekit/components-react** - 高级组件
- **livekit-client** - 客户端 SDK

### 部署
- **LiveKit Server**: Docker Compose 或 Kubernetes
- **TURN/STUN**: Coturn 或 LiveKit Cloud
- **录制存储**: S3 / MinIO

---

## 📊 数据库 Schema

```sql
-- live_sessions table
CREATE TABLE live_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  session_type VARCHAR(50) NOT NULL DEFAULT 'teaching',
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  max_participants INTEGER NOT NULL DEFAULT 50,
  is_recorded BOOLEAN DEFAULT FALSE,
  recording_url VARCHAR(500),
  is_public BOOLEAN DEFAULT FALSE,
  invite_token VARCHAR(500),
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- live_participants table
CREATE TABLE live_participants (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL REFERENCES live_sessions(session_id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMP NOT NULL,
  left_at TIMESTAMP,
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sessions_owner ON live_sessions(owner_id);
CREATE INDEX idx_sessions_status ON live_sessions(status);
CREATE INDEX idx_sessions_type ON live_sessions(session_type);
CREATE INDEX idx_participants_session ON live_participants(session_id);
CREATE INDEX idx_participants_user ON live_participants(user_id);
```
