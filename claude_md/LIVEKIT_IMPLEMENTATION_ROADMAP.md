# LiveKit 直播系统实现路线图

## 🎯 实施阶段

---

## Phase 1: 基础设施搭建 (1-2天)

### 1.1 LiveKit 服务器部署

**选项 A: Docker Compose (推荐快速开发)**
```yaml
# infra/docker-compose.livekit.yml
version: '3.8'
services:
  livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml
    ports:
      - "7880:7880"  # HTTP
      - "7881:7881"  # WebSocket
      - "50000-50100:50000-50100/udp"  # RTC
    volumes:
      - ./livekit/livekit.yaml:/etc/livekit.yaml
      - ./livekit/keys:/keys
    networks:
      - donfra

  # 可选: TURN server (用于 NAT 穿透)
  coturn:
    image: coturn/coturn:latest
    network_mode: host
    volumes:
      - ./livekit/turnserver.conf:/etc/coturn/turnserver.conf
```

**选项 B: LiveKit Cloud (推荐生产环境)**
- 注册 https://cloud.livekit.io
- 获取 API Key 和 Secret
- 无需自己维护服务器

### 1.2 LiveKit 配置文件
```yaml
# infra/livekit/livekit.yaml
port: 7880
bind_addresses:
  - "0.0.0.0"

rtc:
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: true
  # 生产环境填入你的公网 IP
  # external_ip: "1.2.3.4"

keys:
  # 开发环境密钥
  devkey: APISECRETdevkey
  # 生产环境从环境变量读取
  # API_KEY: ${LIVEKIT_API_KEY}
  # API_SECRET: ${LIVEKIT_API_SECRET}

# 录制配置 (可选)
# egress:
#   redis:
#     address: redis:6379

# 日志
logging:
  level: debug
  sample: false
```

### 1.3 环境变量配置
```bash
# donfra-api/.env
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_SERVER_URL=ws://localhost:7880  # 或 wss://livekit.donfra.com
LIVEKIT_RECORDING_ENABLED=true
```

---

## Phase 2: 后端 API 实现 (2-3天)

### 2.1 安装依赖
```bash
cd donfra-api
go get github.com/livekit/server-sdk-go
go get github.com/google/uuid
```

### 2.2 创建 Repository
```go
// internal/domain/livekit/repository.go
package livekit

import (
	"context"
	"gorm.io/gorm"
)

type Repository interface {
	// Session CRUD
	CreateSession(ctx context.Context, session *LiveSession) error
	GetSessionByID(ctx context.Context, sessionID string) (*LiveSession, error)
	UpdateSession(ctx context.Context, session *LiveSession) error
	DeleteSession(ctx context.Context, sessionID string) error
	ListSessions(ctx context.Context, filter *ListSessionsRequest) ([]SessionListItem, int, error)

	// Participant
	AddParticipant(ctx context.Context, participant *LiveParticipant) error
	UpdateParticipant(ctx context.Context, participant *LiveParticipant) error
	GetSessionParticipants(ctx context.Context, sessionID string) ([]LiveParticipant, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// 实现各个方法...
```

### 2.3 创建 Service
```go
// internal/domain/livekit/service.go
package livekit

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	lksdk "github.com/livekit/server-sdk-go"
)

type Service interface {
	CreateSession(ctx context.Context, ownerID uint, req *CreateSessionRequest) (*CreateSessionResponse, error)
	JoinSession(ctx context.Context, userID uint, req *JoinSessionRequest) (*JoinSessionResponse, error)
	GetSession(ctx context.Context, sessionID string) (*LiveSession, error)
	UpdateSession(ctx context.Context, sessionID string, ownerID uint, req *UpdateSessionRequest) error
	StartSession(ctx context.Context, sessionID string, ownerID uint) error
	EndSession(ctx context.Context, sessionID string, ownerID uint) error
	// ...
}

type service struct {
	repo         Repository
	apiKey       string
	apiSecret    string
	serverURL    string
	baseURL      string
	jwtSecret    []byte
}

func NewService(repo Repository, apiKey, apiSecret, serverURL, baseURL, jwtSecret string) Service {
	return &service{
		repo:      repo,
		apiKey:    apiKey,
		apiSecret: apiSecret,
		serverURL: serverURL,
		baseURL:   baseURL,
		jwtSecret: []byte(jwtSecret),
	}
}

// 生成 LiveKit Access Token
func (s *service) generateAccessToken(sessionID, userID, userName, role string) (string, error) {
	at := lksdk.NewAccessToken(s.apiKey, s.apiSecret)

	// 设置权限
	canPublish := role == RoleHost || role == RoleCoHost || role == RoleSpeaker
	canSubscribe := true
	canPublishData := true

	grant := &lksdk.VideoGrant{
		RoomJoin:       true,
		Room:           sessionID,
		CanPublish:     &canPublish,
		CanSubscribe:   &canSubscribe,
		CanPublishData: &canPublishData,
	}

	// Host 拥有管理员权限
	if role == RoleHost {
		roomAdmin := true
		grant.RoomAdmin = &roomAdmin
	}

	at.AddGrant(grant).
		SetIdentity(userID).
		SetName(userName).
		SetValidFor(24 * time.Hour)

	return at.ToJWT()
}

// CreateSession 实现
func (s *service) CreateSession(ctx context.Context, ownerID uint, req *CreateSessionRequest) (*CreateSessionResponse, error) {
	// 生成 session_id
	sessionID := uuid.New().String()

	// 创建 LiveKit room (可选,LiveKit 会自动创建)
	// roomClient := lksdk.NewRoomServiceClient(s.serverURL, s.apiKey, s.apiSecret)
	// room, err := roomClient.CreateRoom(ctx, &livekit.CreateRoomRequest{
	// 	Name: sessionID,
	// 	MaxParticipants: uint32(req.MaxParticipants),
	// })

	// 生成 invite token (JWT)
	var inviteToken string
	if !req.IsPublic {
		// 为私密会话生成邀请 token
		inviteToken = "..." // 使用 JWT 生成
	}

	// 保存到数据库
	session := &LiveSession{
		SessionID:       sessionID,
		OwnerID:         ownerID,
		Title:           req.Title,
		Description:     req.Description,
		SessionType:     req.SessionType,
		Status:          SessionStatusScheduled,
		MaxParticipants: req.MaxParticipants,
		IsPublic:        req.IsPublic,
		IsRecorded:      req.IsRecorded,
		InviteToken:     inviteToken,
		ScheduledAt:     req.ScheduledAt,
	}

	if err := s.repo.CreateSession(ctx, session); err != nil {
		return nil, err
	}

	// 生成 host access token
	hostToken, err := s.generateAccessToken(sessionID, fmt.Sprintf("%d", ownerID), "Host", RoleHost)
	if err != nil {
		return nil, err
	}

	// 生成邀请链接
	inviteLink := fmt.Sprintf("%s/live/%s", s.baseURL, sessionID)
	if inviteToken != "" {
		inviteLink += "?token=" + inviteToken
	}

	return &CreateSessionResponse{
		SessionID:  sessionID,
		InviteLink: inviteLink,
		HostToken:  hostToken,
		CreatedAt:  session.CreatedAt,
		Message:    "Live session created successfully",
	}, nil
}

// JoinSession 实现
func (s *service) JoinSession(ctx context.Context, userID uint, req *JoinSessionRequest) (*JoinSessionResponse, error) {
	// 获取 session
	session, err := s.repo.GetSessionByID(ctx, req.SessionID)
	if err != nil {
		return nil, err
	}

	// 检查权限
	if !session.IsPublic && req.InviteToken == "" {
		return nil, fmt.Errorf("private session requires invite token")
	}

	// 验证 invite token (如果需要)
	// ...

	// 确定角色
	role := RoleViewer
	if session.OwnerID == userID {
		role = RoleHost
	}

	// 生成 access token
	accessToken, err := s.generateAccessToken(
		req.SessionID,
		fmt.Sprintf("%d", userID),
		req.DisplayName,
		role,
	)
	if err != nil {
		return nil, err
	}

	// 记录参与者
	participant := &LiveParticipant{
		SessionID: req.SessionID,
		UserID:    userID,
		Role:      role,
		JoinedAt:  time.Now(),
	}
	if err := s.repo.AddParticipant(ctx, participant); err != nil {
		return nil, err
	}

	return &JoinSessionResponse{
		SessionID:    req.SessionID,
		AccessToken:  accessToken,
		ServerURL:    s.serverURL,
		Role:         role,
		CanPublish:   role != RoleViewer,
		CanSubscribe: true,
		Message:      "Joined session successfully",
	}, nil
}

// 其他方法实现...
```

### 2.4 创建 Handlers
```go
// internal/http/handlers/livekit.go
package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"donfra-api/internal/domain/livekit"
	"donfra-api/internal/pkg/httputil"

	"github.com/go-chi/chi/v5"
)

func (h *Handlers) CreateLiveSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 获取当前用户 ID (从 auth middleware)
	userID, ok := ctx.Value("user_id").(uint)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// 检查用户角色 (仅 admin/mentor)
	userRole, _ := ctx.Value("user_role").(string)
	if userRole != "admin" && userRole != "mentor" {
		httputil.WriteError(w, http.StatusForbidden, "only admin/mentor can create live sessions")
		return
	}

	var req livekit.CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.livekitSvc.CreateSession(ctx, userID, &req)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, resp)
}

func (h *Handlers) JoinLiveSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	sessionID := chi.URLParam(r, "session_id")

	userID, ok := ctx.Value("user_id").(uint)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req livekit.JoinSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.SessionID = sessionID

	resp, err := h.livekitSvc.JoinSession(ctx, userID, &req)
	if err != nil {
		httputil.WriteError(w, http.StatusForbidden, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// 其他 handler 方法...
```

### 2.5 注册路由
```go
// internal/http/router/router.go

// LiveKit routes
r.Route("/api/v1/live", func(r chi.Router) {
	// Public
	r.Get("/sessions", handlers.ListLiveSessions)
	r.Get("/sessions/{session_id}", handlers.GetLiveSession)

	// Authenticated
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		r.Post("/sessions", handlers.CreateLiveSession)
		r.Post("/sessions/{session_id}/join", handlers.JoinLiveSession)
		r.Patch("/sessions/{session_id}", handlers.UpdateLiveSession)
		r.Post("/sessions/{session_id}/start", handlers.StartLiveSession)
		r.Post("/sessions/{session_id}/end", handlers.EndLiveSession)
		r.Delete("/sessions/{session_id}", handlers.DeleteLiveSession)

		// Participant management
		r.Patch("/sessions/{session_id}/participants/{user_id}", handlers.UpdateParticipantRole)
		r.Post("/sessions/{session_id}/participants/{user_id}/kick", handlers.KickParticipant)

		// Recording
		r.Post("/sessions/{session_id}/recording/start", handlers.StartRecording)
		r.Post("/sessions/{session_id}/recording/stop", handlers.StopRecording)
	})
})
```

### 2.6 数据库迁移
```go
// cmd/migrate/main.go
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&livekit.LiveSession{},
		&livekit.LiveParticipant{},
	)
}
```

---

## Phase 3: 前端实现 (3-4天)

### 3.1 安装依赖
```bash
cd donfra-ui
npm install @livekit/components-react livekit-client
npm install @livekit/components-styles
```

### 3.2 创建 LiveKit 上下文
```typescript
// lib/livekit-context.tsx
'use client'

import { createContext, useContext, useState } from 'react'

interface LiveKitContextType {
  accessToken: string | null
  serverUrl: string | null
  sessionId: string | null
  setConnection: (token: string, url: string, id: string) => void
  disconnect: () => void
}

const LiveKitContext = createContext<LiveKitContextType>(null!)

export function LiveKitProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const setConnection = (token: string, url: string, id: string) => {
    setAccessToken(token)
    setServerUrl(url)
    setSessionId(id)
  }

  const disconnect = () => {
    setAccessToken(null)
    setServerUrl(null)
    setSessionId(null)
  }

  return (
    <LiveKitContext.Provider value={{ accessToken, serverUrl, sessionId, setConnection, disconnect }}>
      {children}
    </LiveKitContext.Provider>
  )
}

export const useLiveKit = () => useContext(LiveKitContext)
```

### 3.3 创建直播间组件
```typescript
// components/LiveRoom.tsx
'use client'

import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'
import { useLiveKit } from '@/lib/livekit-context'
import { useRouter } from 'next/navigation'

interface LiveRoomProps {
  sessionId: string
  accessToken: string
  serverUrl: string
  role: 'host' | 'viewer'
}

export default function LiveRoom({ sessionId, accessToken, serverUrl, role }: LiveRoomProps) {
  const router = useRouter()
  const { disconnect } = useLiveKit()

  const handleDisconnect = () => {
    disconnect()
    router.push('/live')
  }

  return (
    <div className="live-room-container">
      <LiveKitRoom
        token={accessToken}
        serverUrl={serverUrl}
        connect={true}
        audio={role === 'host'}
        video={role === 'host'}
        onDisconnected={handleDisconnect}
        style={{ height: '100vh' }}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  )
}
```

### 3.4 创建直播广场页面
```typescript
// app/live/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import LiveSessionCard from '@/components/LiveSessionCard'

export default function LivePage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.live.listSessions({ status: 'live', is_public: true })
        setSessions(data.sessions)
      } catch (err) {
        console.error('Failed to fetch sessions:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div className="live-page">
      <header>
        <h1>直播广场</h1>
        <a href="/live/create" className="btn-create">创建直播</a>
      </header>

      <div className="session-grid">
        {sessions.map(session => (
          <LiveSessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  )
}
```

### 3.5 创建直播间页面
```typescript
// app/live/[session_id]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import LiveRoom from '@/components/LiveRoom'

export default function LiveSessionPage({ params }: { params: Promise<{ session_id: string }> }) {
  const { session_id } = use(params)
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [accessToken, setAccessToken] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [role, setRole] = useState('viewer')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const joinSession = async () => {
      try {
        // 获取用户信息
        const user = await api.auth.me()

        // 加入会话
        const joinResp = await api.live.joinSession(session_id, {
          session_id,
          display_name: user.user.username,
        })

        setAccessToken(joinResp.access_token)
        setServerUrl(joinResp.server_url)
        setRole(joinResp.role)

        // 获取会话详情
        const sessionData = await api.live.getSession(session_id)
        setSession(sessionData)
      } catch (err) {
        console.error('Failed to join session:', err)
        router.push('/live')
      } finally {
        setLoading(false)
      }
    }

    joinSession()
  }, [session_id])

  if (loading) return <div>Joining session...</div>

  return (
    <LiveRoom
      sessionId={session_id}
      accessToken={accessToken}
      serverUrl={serverUrl}
      role={role}
    />
  )
}
```

### 3.6 更新 API 客户端
```typescript
// lib/api.ts
export const api = {
  // ... existing apis

  live: {
    createSession: (data: CreateSessionRequest) =>
      postJSON<CreateSessionResponse>("/live/sessions", data),

    joinSession: (sessionId: string, data: JoinSessionRequest) =>
      postJSON<JoinSessionResponse>(`/live/sessions/${sessionId}/join`, data),

    getSession: (sessionId: string) =>
      getJSON<LiveSession>(`/live/sessions/${sessionId}`),

    listSessions: (params: ListSessionsRequest) =>
      getJSON<ListSessionsResponse>(`/live/sessions?${new URLSearchParams(params as any)}`),

    updateSession: (sessionId: string, data: UpdateSessionRequest) =>
      patchJSON(`/live/sessions/${sessionId}`, data),

    startSession: (sessionId: string) =>
      postJSON(`/live/sessions/${sessionId}/start`, {}),

    endSession: (sessionId: string) =>
      postJSON(`/live/sessions/${sessionId}/end`, {}),
  }
}
```

---

## Phase 4: 测试与优化 (1-2天)

### 4.1 本地测试清单
- [ ] 创建直播会话
- [ ] 主播加入会话
- [ ] 观众加入会话
- [ ] 音视频正常传输
- [ ] 屏幕共享功能
- [ ] 聊天功能
- [ ] 角色权限控制
- [ ] 录制功能
- [ ] 会话结束流程

### 4.2 性能优化
- WebRTC 连接质量监控
- 自适应码率
- 网络抖动处理
- 断线重连

### 4.3 安全加固
- JWT token 过期策略
- 速率限制 (防刷)
- CORS 配置
- 私密会话访问控制

---

## Phase 5: 部署上线 (1天)

### 5.1 生产环境配置
```bash
# 更新 docker-compose.yml
docker-compose -f infra/docker-compose.yml up -d livekit

# 配置 Caddy 反向代理
# 添加 LiveKit 路由到 Caddyfile
```

### 5.2 监控告警
- LiveKit 服务器健康检查
- 直播会话数量监控
- 并发用户数监控
- 带宽使用监控

---

## 📊 预估工时

| 阶段 | 工作量 | 人员 |
|------|--------|------|
| Phase 1: 基础设施 | 1-2天 | 后端 |
| Phase 2: 后端 API | 2-3天 | 后端 |
| Phase 3: 前端实现 | 3-4天 | 前端 |
| Phase 4: 测试优化 | 1-2天 | 全栈 |
| Phase 5: 部署上线 | 1天 | DevOps |
| **总计** | **8-12天** | - |

---

## 🚀 快速开始指南

### 1. 安装 LiveKit Server
```bash
cd infra
docker-compose -f docker-compose.livekit.yml up -d
```

### 2. 配置环境变量
```bash
cp donfra-api/.env.example donfra-api/.env
# 编辑 .env 填入 LiveKit 配置
```

### 3. 运行迁移
```bash
cd donfra-api
go run cmd/migrate/main.go
```

### 4. 启动后端
```bash
make run
```

### 5. 启动前端
```bash
cd donfra-ui
npm run dev
```

### 6. 访问测试
```
http://localhost:3000/live
```

---

## 📚 参考资料

- [LiveKit 官方文档](https://docs.livekit.io/)
- [LiveKit Go SDK](https://github.com/livekit/server-sdk-go)
- [LiveKit React Components](https://github.com/livekit/components-js)
- [WebRTC 最佳实践](https://webrtc.org/getting-started/overview)
