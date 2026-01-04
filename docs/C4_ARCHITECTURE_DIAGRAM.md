# Donfra API - C4 Architecture Diagrams

C4模型（Context, Container, Component, Code）是一种用于软件架构可视化的层次化方法。

---

## Level 1: System Context Diagram (系统上下文图)

展示Donfra系统与外部实体的交互。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Donfra Platform                                  │
│                    (Educational Mentorship System)                       │
└─────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐          ┌──────────────┐          ┌──────────────┐
│               │          │              │          │              │
│   Students    │          │   Mentors    │          │  Admin Users │
│               │          │              │          │              │
│ - View lessons│          │ - Create     │          │ - Manage     │
│ - Join rooms  │          │   rooms      │          │   content    │
│ - Google login│          │ - Collab     │          │ - Monitor    │
│               │          │   coding     │          │   system     │
└───────────────┘          └──────────────┘          └──────────────┘
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   │
                                   ▼
        ┌─────────────────────────────────────────────────────┐
        │              External Services                      │
        ├─────────────────────────────────────────────────────┤
        │                                                     │
        │  ┌─────────────────┐      ┌──────────────────┐    │
        │  │ Google Identity │      │ LiveKit Server   │    │
        │  │ (OAuth 2.0)     │      │ (Video Streaming)│    │
        │  └─────────────────┘      └──────────────────┘    │
        │                                                     │
        │  ┌─────────────────┐      ┌──────────────────┐    │
        │  │  PostgreSQL 16  │      │  Redis Cache     │    │
        │  │  (Database)     │      │  (State/PubSub)  │    │
        │  └─────────────────┘      └──────────────────┘    │
        │                                                     │
        │  ┌─────────────────┐                               │
        │  │ Jaeger/OTLP     │                               │
        │  │ (Tracing)       │                               │
        │  └─────────────────┘                               │
        └─────────────────────────────────────────────────────┘
```

**关系说明：**
- **用户** → Donfra Platform: 通过浏览器访问（HTTPS）
- **Donfra** → Google: OAuth 2.0认证流程
- **Donfra** → LiveKit: 获取视频流access token
- **Donfra** → PostgreSQL: 持久化数据存储
- **Donfra** → Redis: 缓存、状态管理、Pub/Sub
- **Donfra** → Jaeger: 发送分布式追踪数据

---

## Level 2: Container Diagram (容器图)

展示Donfra平台内部的主要容器（应用/数据库）。

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            Donfra Platform                                    │
│                                                                               │
│  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────┐│
│  │                  │         │                  │         │              ││
│  │  donfra-ui       │  HTTP   │  donfra-api      │  WS     │  donfra-ws   ││
│  │  (Next.js SSR)   │◄───────►│  (Go REST API)   │◄───────►│  (Node.js)   ││
│  │                  │         │                  │         │              ││
│  │  Port: 3000      │         │  Port: 8080      │         │  Port: 6789  ││
│  │                  │         │                  │         │              ││
│  │  - React 18      │         │  - Chi Router    │         │  - Yjs CRDT  ││
│  │  - Monaco Editor │         │  - JWT Auth      │         │  - y-websocket││
│  │  - Excalidraw    │         │  - GORM ORM      │         │  - Collab    ││
│  │  - Framer Motion │         │  - OpenTelemetry │         │    State     ││
│  │                  │         │                  │         │              ││
│  └──────────────────┘         └──────────────────┘         └──────────────┘│
│           │                            │  │  │  │                 │         │
│           │                            │  │  │  │                 │         │
│           └────────────────────────────┘  │  │  │                 │         │
│                   Browser requests        │  │  │                 │         │
│                                           │  │  │                 │         │
└───────────────────────────────────────────┼──┼──┼─────────────────┼─────────┘
                                            │  │  │                 │
                     ┌──────────────────────┘  │  └─────────────────┼────┐
                     │                         │                    │    │
                     ▼                         ▼                    ▼    │
          ┌─────────────────────┐   ┌──────────────────┐   ┌───────────────┐
          │  PostgreSQL 16      │   │  Redis 6         │   │ Google OAuth  │
          │  (Primary Database) │   │  (Cache/PubSub)  │   │ API           │
          │                     │   │                  │   │               │
          │  Tables:            │   │  Keys:           │   │ Endpoints:    │
          │  - users            │   │  - room:state:*  │   │ - /o/oauth2   │
          │  - lessons          │   │  - google_oauth  │   │ - /token      │
          │  - interview_rooms  │   │    _state:*      │   │ - /userinfo   │
          │  - live_sessions    │   │  - room:headcount│   │               │
          │                     │   │    :*            │   │               │
          └─────────────────────┘   └──────────────────┘   └───────────────┘
                     │                         │                    │
                     └─────────────────────────┼────────────────────┘
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  LiveKit Server  │
                                    │  (Video Infra)   │
                                    │                  │
                                    │  Port: 7880      │
                                    │  WebRTC bridge   │
                                    └──────────────────┘
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  Jaeger          │
                                    │  (Tracing)       │
                                    │                  │
                                    │  Port: 4318      │
                                    │  OTLP collector  │
                                    └──────────────────┘
```

**容器职责：**

| 容器 | 技术栈 | 职责 |
|------|--------|------|
| **donfra-ui** | Next.js 14, React 18 | 服务端渲染前端，Monaco编辑器，Excalidraw白板 |
| **donfra-api** | Go 1.24, Chi v5 | REST API，认证，业务逻辑，数据持久化 |
| **donfra-ws** | Node.js, Yjs | WebSocket服务器，实时协作同步 |
| **PostgreSQL** | Postgres 16 | 主数据库，用户、课程、房间数据 |
| **Redis** | Redis 6 | 分布式缓存，房间状态，OAuth state，Pub/Sub |
| **LiveKit** | WebRTC | 视频流媒体基础设施 |
| **Jaeger** | OTLP | 分布式追踪收集器 |

---

## Level 3: Component Diagram (组件图) - donfra-api

展示API容器内部的主要组件。

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              donfra-api                                       │
│                           (Go REST API Service)                               │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         HTTP Layer                                   │    │
│  │  ┌────────────┐    ┌───────────────┐    ┌──────────────────┐       │    │
│  │  │  Chi Router│───►│  Middleware   │───►│    Handlers      │       │    │
│  │  │  (v5.1.0)  │    │               │    │                  │       │    │
│  │  │            │    │ - Tracing     │    │ - room.go        │       │    │
│  │  │ Routes:    │    │ - CORS        │    │ - study.go       │       │    │
│  │  │ /api/*     │    │ - RequestID   │    │ - user.go        │       │    │
│  │  │ /api/v1/*  │    │ - Auth        │    │ - admin.go       │       │    │
│  │  │            │    │   (Optional/  │    │ - interview.go   │       │    │
│  │  │            │    │    Required)  │    │ - livekit.go     │       │    │
│  │  └────────────┘    └───────────────┘    └──────────────────┘       │    │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                         │
│  ┌─────────────────────────────────▼─────────────────────────────────────┐  │
│  │                        Service Layer (Domain Logic)                   │  │
│  │                                                                        │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │ RoomService   │  │ StudyService │  │ UserService  │              │  │
│  │  │               │  │              │  │              │              │  │
│  │  │ - Init()      │  │ - List       │  │ - Register() │              │  │
│  │  │ - Validate()  │  │   Published  │  │ - Login()    │              │  │
│  │  │ - GetStatus() │  │ - GetBySlug()│  │ - LoginOr    │              │  │
│  │  │ - Close()     │  │ - Create()   │  │   RegisterWith│             │  │
│  │  │ - Update      │  │ - Update()   │  │   Google()   │              │  │
│  │  │   Headcount() │  │ - Delete()   │  │ - Validate   │              │  │
│  │  │               │  │              │  │   Token()    │              │  │
│  │  └───────┬───────┘  └──────┬───────┘  └──────┬───────┘              │  │
│  │          │                 │                 │                       │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │ AuthService   │  │ Interview    │  │ LiveKit      │              │  │
│  │  │               │  │ Service      │  │ Service      │              │  │
│  │  │ - IssueAdmin  │  │              │  │              │              │  │
│  │  │   Token()     │  │ - InitRoom() │  │ - Create     │              │  │
│  │  │ - Validate()  │  │ - JoinRoom() │  │   Session()  │              │  │
│  │  │               │  │ - CloseRoom()│  │ - JoinSession│              │  │
│  │  │               │  │ - Update     │  │   ()         │              │  │
│  │  │               │  │   Headcount()│  │ - EndSession │              │  │
│  │  │               │  │              │  │   ()         │              │  │
│  │  └───────────────┘  └──────────────┘  └──────────────┘              │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────┐            │  │
│  │  │          GoogleOAuthService                          │            │  │
│  │  │                                                      │            │  │
│  │  │  - GenerateAuthURL()  → State storage (Redis)       │            │  │
│  │  │  - ExchangeCode()     → Google API call             │            │  │
│  │  │  - validateState()    → State validation            │            │  │
│  │  │  - GetFrontendURL()   → Redirect configuration      │            │  │
│  │  │                                                      │            │  │
│  │  └──────────────────────────────────────────────────────┘            │  │
│  └────────────────────────────────┬───────────────────────────────────────┘
│                                   │                                         │
│  ┌────────────────────────────────▼───────────────────────────────────────┐│
│  │                      Repository Layer (Data Access)                    ││
│  │                                                                         ││
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐   ││
│  │  │ Room Repository │  │ User Repository  │  │ Lesson Repository  │   ││
│  │  │                 │  │ (PostgreSQL)     │  │ (PostgreSQL GORM)  │   ││
│  │  │ Interface:      │  │                  │  │                    │   ││
│  │  │ - GetState()    │  │ - FindByID()     │  │ - FindBySlug()     │   ││
│  │  │ - SaveState()   │  │ - FindByEmail()  │  │ - Create()         │   ││
│  │  │ - Clear()       │  │ - FindByGoogleID │  │ - Update()         │   ││
│  │  │                 │  │   ()             │  │ - Delete()         │   ││
│  │  │ Implementations:│  │ - Create()       │  │ - List()           │   ││
│  │  │ ┌─────────────┐ │  │ - Update()       │  │                    │   ││
│  │  │ │ Memory Repo │ │  │ - ExistsByEmail │  │                    │   ││
│  │  │ │ (sync.Mutex)│ │  │   ()             │  │                    │   ││
│  │  │ └─────────────┘ │  │                  │  │                    │   ││
│  │  │ ┌─────────────┐ │  │                  │  │                    │   ││
│  │  │ │ Redis Repo  │ │  │                  │  │                    │   ││
│  │  │ │ (go-redis)  │ │  │                  │  │                    │   ││
│  │  │ └─────────────┘ │  │                  │  │                    │   ││
│  │  └─────────────────┘  └──────────────────┘  └────────────────────┘   ││
│  │                                                                         ││
│  │  ┌──────────────────────────────────────────────────────────────┐     ││
│  │  │          Headcount Subscriber (Redis Pub/Sub)                │     ││
│  │  │                                                              │     ││
│  │  │  - Subscribe to "room:headcount:{roomId}"                   │     ││
│  │  │  - Parse headcount messages from donfra-ws                  │     ││
│  │  │  - Call RoomService.UpdateHeadcount()                       │     ││
│  │  │                                                              │     ││
│  │  └──────────────────────────────────────────────────────────────┘     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Supporting Components                           │    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐   │    │
│  │  │ Config       │  │ Tracing        │  │ JWT Utilities        │   │    │
│  │  │ (env vars)   │  │ (OpenTelemetry)│  │ (jwt/v5)             │   │    │
│  │  │              │  │                │  │                      │   │    │
│  │  │ - Load()     │  │ - InitTracer() │  │ - GenerateToken()    │   │    │
│  │  │ - Validate() │  │ - TracingMW()  │  │ - ValidateToken()    │   │    │
│  │  └──────────────┘  └────────────────┘  └──────────────────────┘   │    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌────────────────┐                              │    │
│  │  │ Password     │  │ HTTP Utils     │                              │    │
│  │  │ (bcrypt)     │  │ (WriteJSON,    │                              │    │
│  │  │              │  │  WriteError)   │                              │    │
│  │  │ - Hash()     │  │                │                              │    │
│  │  │ - Check()    │  │                │                              │    │
│  │  └──────────────┘  └────────────────┘                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────────┘
              │              │              │              │
              ▼              ▼              ▼              ▼
      ┌──────────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────────┐
      │ PostgreSQL   │ │  Redis   │ │ Google API  │ │ LiveKit API  │
      │              │ │          │ │             │ │              │
      │ Tables:      │ │ Keys:    │ │ OAuth flow  │ │ Token gen    │
      │ - users      │ │ - room:* │ │             │ │              │
      │ - lessons    │ │ - google │ │             │ │              │
      │ - interview  │ │   _oauth │ │             │ │              │
      │   _rooms     │ │   _state │ │             │ │              │
      │ - live       │ │          │ │             │ │              │
      │   _sessions  │ │          │ │             │ │              │
      └──────────────┘ └──────────┘ └─────────────┘ └──────────────┘
```

**组件职责：**

### HTTP Layer
- **Chi Router**: 路由注册和URL匹配
- **Middleware**: 横切关注点（认证、追踪、CORS）
- **Handlers**: HTTP请求解析和响应构造

### Service Layer
- **RoomService**: 协作房间状态管理
- **StudyService**: 课程CRUD和VIP访问控制
- **UserService**: 用户注册、登录、JWT管理
- **AuthService**: 管理员认证
- **InterviewService**: 面试房间管理
- **LiveKitService**: 视频流token生成
- **GoogleOAuthService**: OAuth 2.0流程，state管理

### Repository Layer
- **抽象Repository接口**: 定义数据访问契约
- **具体实现**: Memory（开发）、Redis（生产）、PostgreSQL（持久化）
- **HeadcountSubscriber**: 监听WebSocket服务器的实时更新

### Supporting Components
- **Config**: 环境变量加载和验证
- **Tracing**: OpenTelemetry集成
- **JWT Utilities**: Token生成和验证（HS256）
- **Password**: bcrypt哈希
- **HTTP Utils**: JSON响应辅助函数

---

## Level 4: Code Diagram (代码图) - User Authentication Flow

展示用户认证流程的代码级交互。

```
┌────────────────────────────────────────────────────────────────────────┐
│              User Registration & Login Flow (Code Level)               │
└────────────────────────────────────────────────────────────────────────┘

┌──────────┐                                                   ┌──────────┐
│  Client  │                                                   │ Database │
│ (Browser)│                                                   │(Postgres)│
└────┬─────┘                                                   └────┬─────┘
     │                                                              │
     │  POST /api/auth/register                                    │
     │  {email, password, username}                                │
     ├─────────────────────────────────────────────┐               │
     │                                             │               │
     ▼                                             ▼               │
┌─────────────────┐                        ┌──────────────────────┐│
│ Handlers.       │                        │ Middleware Stack     ││
│ Register()      │                        │                      ││
│                 │                        │ 1. Tracing           ││
│ 1. Parse JSON   │                        │ 2. CORS              ││
│    body         │◄───────────────────────│ 3. RequestID         ││
│ 2. Validate     │                        │                      ││
│    input        │                        └──────────────────────┘│
│ 3. Call service │                                                │
└────┬────────────┘                                                │
     │                                                              │
     │ UserService.Register(ctx, req)                              │
     ├──────────────────────┐                                      │
     │                      ▼                                      │
     │              ┌────────────────────────┐                     │
     │              │ UserService.Register() │                     │
     │              │                        │                     │
     │              │ 1. emailRegex.Match()  │                     │
     │              │    ✓ Validate email    │                     │
     │              │                        │                     │
     │              │ 2. len(password) >= 8  │                     │
     │              │    ✓ Validate password │                     │
     │              │                        │                     │
     │              │ 3. repo.ExistsByEmail()│──────────────────┐  │
     │              │    ✓ Check duplicate   │                  │  │
     │              │                        │                  ▼  │
     │              │ 4. HashPassword()      │          ┌──────────────────┐
     │              │    bcrypt.Generate     │          │ Repository.      │
     │              │    Cost(DefaultCost)   │          │ ExistsByEmail()  │
     │              │                        │          │                  │
     │              │ 5. Create User{...}    │          │ SELECT COUNT(*)  │
     │              │                        │          │ FROM users       │
     │              │ 6. repo.Create(user)   │──────────► WHERE email=?    │
     │              │                        │          │                  │
     │              └────────┬───────────────┘          └──────────────────┘
     │                       │                                      │
     │                       │ User{ID, Email, ...}                 │
     │◄──────────────────────┘                                      │
     │                                                               │
     │ WriteJSON(201, {user: user.ToPublic()})                      │
     ├──────────────────────────────────────────────────────────────┤
     │                                                               │
     ▼                                                               │
┌─────────────────────┐                                             │
│ HTTP Response       │                                             │
│ 201 Created         │                                             │
│                     │                                             │
│ {                   │                                             │
│   "user": {         │                                             │
│     "id": 123,      │                                             │
│     "email": "...", │                                             │
│     "username":"...",                                             │
│     "role": "user"  │                                             │
│   }                 │                                             │
│ }                   │                                             │
└─────────────────────┘                                             │
     │                                                               │
     │  POST /api/auth/login                                        │
     │  {email, password}                                           │
     ├───────────────────────────────────────────────┐              │
     │                                               │              │
     ▼                                               ▼              │
┌─────────────────┐                        ┌──────────────────┐    │
│ Handlers.Login()│                        │ Middleware       │    │
│                 │◄───────────────────────│ (same as above)  │    │
│ 1. Parse JSON   │                        └──────────────────┘    │
│ 2. Call service │                                                 │
└────┬────────────┘                                                 │
     │                                                               │
     │ UserService.Login(ctx, req)                                  │
     ├──────────────────────┐                                       │
     │                      ▼                                       │
     │              ┌────────────────────────────┐                  │
     │              │ UserService.Login()        │                  │
     │              │                            │                  │
     │              │ 1. repo.FindByEmail()      │──────────────┐   │
     │              │    Fetch user from DB      │              │   │
     │              │                            │              ▼   │
     │              │ 2. CheckPassword()         │      ┌──────────────────┐
     │              │    bcrypt.Compare          │      │ Repository.      │
     │              │    (hashed, provided)      │      │ FindByEmail()    │
     │              │                            │      │                  │
     │              │ 3. user.IsActive?          │      │ SELECT *         │
     │              │    Check status            │      │ FROM users       │
     │              │                            │      │ WHERE email=?    │
     │              │ 4. GenerateToken()         │◄─────┤ LIMIT 1          │
     │              │    ┌──────────────────┐   │      └──────────────────┘
     │              │    │ JWT Generation   │   │              │
     │              │    │                  │   │              │
     │              │    │ Claims{          │   │              │
     │              │    │   UserID,        │   │              │
     │              │    │   Email,         │   │              │
     │              │    │   Role,          │   │              │
     │              │    │   Exp: +7days    │   │              │
     │              │    │ }                │   │              │
     │              │    │                  │   │              │
     │              │    │ jwt.SignWith     │   │              │
     │              │    │ Claims(HS256,    │   │              │
     │              │    │  secret)         │   │              │
     │              │    └──────────────────┘   │              │
     │              │                            │              │
     │              └────────┬───────────────────┘              │
     │                       │                                  │
     │                       │ (User, token)                    │
     │◄──────────────────────┘                                  │
     │                                                           │
     │ SetCookie("auth_token", token, {                         │
     │   HttpOnly: true,                                        │
     │   SameSite: Lax,                                         │
     │   MaxAge: 7days                                          │
     │ })                                                       │
     │                                                           │
     │ WriteJSON(200, {user, token})                            │
     ├───────────────────────────────────────────────────────────┤
     │                                                           │
     ▼                                                           │
┌─────────────────────┐                                         │
│ HTTP Response       │                                         │
│ 200 OK              │                                         │
│                     │                                         │
│ Set-Cookie:         │                                         │
│   auth_token=<JWT>  │                                         │
│                     │                                         │
│ {                   │                                         │
│   "user": {...},    │                                         │
│   "token": "..."    │                                         │
│ }                   │                                         │
└─────────────────────┘                                         │
     │                                                           │
     │  Subsequent requests with Cookie: auth_token=<JWT>       │
     ├───────────────────────────────────────────────┐          │
     │                                               │          │
     ▼                                               ▼          │
┌─────────────────┐                        ┌──────────────────┐│
│ Protected       │                        │ RequireAuth      ││
│ Endpoint        │◄───────────────────────│ Middleware       ││
│                 │                        │                  ││
│ GET /api/auth/me│                        │ 1. r.Cookie      ││
└────┬────────────┘                        │    ("auth_token")││
     │                                     │                  ││
     │                                     │ 2. ValidateToken ││
     │                                     │    (tokenStr)    ││
     │                                     │                  ││
     │                                     │ 3. Parse & verify││
     │                                     │    JWT signature ││
     │                                     │                  ││
     │                                     │ 4. Check expiry  ││
     │                                     │                  ││
     │                                     │ 5. Inject context││
     │                                     │    ctx["user_id"]││
     │                                     │    ctx["email"]  ││
     │                                     │    ctx["role"]   ││
     │                                     │                  ││
     │                                     └──────────────────┘│
     │                                                          │
     │ ctx.Value("user_id")                                    │
     │ UserService.GetUserByID(userID)                         │
     ├─────────────────────────────────────────────────────────┤
     │                                                          │
     ▼                                                          │
┌─────────────────────┐                                        │
│ HTTP Response       │                                        │
│ 200 OK              │                                        │
│                     │                                        │
│ {                   │                                        │
│   "user": {         │                                        │
│     "id": 123,      │                                        │
│     "email": "...", │                                        │
│     "role": "user"  │                                        │
│   }                 │                                        │
│ }                   │                                        │
└─────────────────────┘                                        │
                                                               │
```

**关键代码交互：**

1. **注册流程**:
   - Handler → Service → Repository → Database
   - Email验证（正则表达式）
   - 密码验证（8字符最小长度）
   - bcrypt哈希（cost=10）
   - 数据库插入

2. **登录流程**:
   - Handler → Service → Repository → Database
   - 查找用户（by email）
   - 密码验证（bcrypt.Compare）
   - 活跃状态检查
   - JWT生成（HS256, 7天有效期）
   - Cookie设置（HttpOnly, SameSite=Lax）

3. **受保护路由访问**:
   - Middleware提取cookie
   - JWT验证（签名、过期时间）
   - 上下文注入（user_id, email, role）
   - Handler使用上下文数据

---

## API Endpoints Summary (按功能分组)

### 认证相关 (Authentication)
```
POST   /api/auth/register           - 用户注册
POST   /api/auth/login              - 用户登录
POST   /api/auth/logout             - 用户登出
GET    /api/auth/me                 - 获取当前用户 (OptionalAuth)
POST   /api/auth/refresh            - 刷新JWT token (RequireAuth)
POST   /api/auth/update-password    - 更新密码 (RequireAuth)
GET    /api/auth/google/url         - 获取Google OAuth URL
GET    /api/auth/google/callback    - Google OAuth回调
POST   /api/admin/login             - 管理员登录
```

### 协作房间 (Collaborative Rooms)
```
POST   /api/room/init               - 开启房间 (需要passcode)
GET    /api/room/status             - 查询房间状态
POST   /api/room/join               - 加入房间 (需要invite token)
POST   /api/room/close              - 关闭房间 (RequireAdminUser)
```

### 课程管理 (Lessons)
```
GET    /api/lessons                 - 列出课程 (OptionalAuth, VIP过滤)
GET    /api/lessons/summary         - 列出课程摘要 (OptionalAuth)
GET    /api/lessons/:slug           - 获取单个课程 (OptionalAuth, VIP检查)
POST   /api/lessons                 - 创建课程 (RequireAdminUser)
PATCH  /api/lessons/:slug           - 更新课程 (RequireAdminUser)
DELETE /api/lessons/:slug           - 删除课程 (RequireAdminUser)
```

### 面试房间 (Interview Rooms)
```
POST   /api/interview/init          - 创建面试房间 (RequireAuth, admin only)
POST   /api/interview/join          - 加入面试房间 (需要invite token)
POST   /api/interview/close         - 关闭面试房间 (RequireAuth, owner only)
GET    /api/interview/my-rooms      - 获取我的面试房间 (RequireAuth)
```

### 直播流 (Live Streaming)
```
POST   /api/live/create             - 创建直播会话 (RequireAdminUser)
POST   /api/live/join               - 加入直播会话
POST   /api/live/end                - 结束直播会话 (RequireAdminUser)
```

---

## 技术栈总结

| 层级 | 技术 | 版本 |
|------|------|------|
| **Runtime** | Go | 1.24 |
| **Web Framework** | Chi Router | v5.1.0 |
| **ORM** | GORM | v1.31.1 |
| **Database Driver** | PostgreSQL | 16 |
| **Cache** | Redis | v9.17.2 (client) |
| **JWT** | golang-jwt/jwt | v5.3.0 |
| **OAuth** | golang.org/x/oauth2 | v0.34.0 |
| **LiveKit SDK** | livekit/protocol | v1.43.2 |
| **Tracing** | OpenTelemetry | v1.39.0 |
| **Password** | bcrypt | (标准库) |

---

## 数据流图示例

### Google OAuth流程

```
用户浏览器                API Server              Google              Redis           PostgreSQL
    │                         │                      │                 │                  │
    │ 1. Click "Google Login" │                      │                 │                  │
    ├──GET /auth/google/url──►│                      │                 │                  │
    │                          │                      │                 │                  │
    │                          │──GenerateState()────►│                 │                  │
    │                          │                      │                 │                  │
    │                          │──Store state─────────┼────────────────►│                  │
    │                          │  (TTL: 10min)        │                 │                  │
    │                          │                      │                 │                  │
    │◄─{auth_url, state}───────│                      │                 │                  │
    │                          │                      │                 │                  │
    │ 2. Redirect to Google    │                      │                 │                  │
    ├──────────────────────────┼──────────────────────►                 │                  │
    │                          │                      │                 │                  │
    │                          │   User authorizes    │                 │                  │
    │◄─────────────────────────┼──────────────────────┤                 │                  │
    │                          │                      │                 │                  │
    │ 3. Callback with code    │                      │                 │                  │
    ├─GET /auth/google/callback?code=X&state=Y───────►│                 │                  │
    │                          │                      │                 │                  │
    │                          │──ValidateState()─────┼────────────────►│                  │
    │                          │◄─────────────────────┼─────────────────┤                  │
    │                          │                      │                 │                  │
    │                          │──ExchangeCode()──────►                 │                  │
    │                          │◄─UserInfo────────────┤                 │                  │
    │                          │                      │                 │                  │
    │                          │──FindByGoogleID()────┼─────────────────┼─────────────────►│
    │                          │◄─User or nil─────────┼─────────────────┼──────────────────┤
    │                          │                      │                 │                  │
    │                          │──Create/Update User──┼─────────────────┼─────────────────►│
    │                          │                      │                 │                  │
    │                          │──GenerateToken()─────┤                 │                  │
    │                          │                      │                 │                  │
    │                          │──Delete state────────┼────────────────►│                  │
    │                          │                      │                 │                  │
    │◄─Set-Cookie: auth_token──┤                      │                 │                  │
    │◄─302 Redirect to frontend│                      │                 │                  │
    │                          │                      │                 │                  │
```

---

## 安全架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Transport Security                                      │
│     ├─ HTTPS (TLS) - Production                            │
│     └─ HTTP - Local Development                            │
│                                                             │
│  2. CORS Protection                                         │
│     ├─ Allowed Origins: localhost:3000, donfra.local       │
│     ├─ Credentials: true                                   │
│     └─ Exposed Headers: X-Request-Id                       │
│                                                             │
│  3. Authentication                                          │
│     ├─ JWT (HS256) - User sessions (7 days)                │
│     ├─ JWT (HS256) - Admin tokens (75 min)                 │
│     ├─ OAuth 2.0 - Google login with CSRF protection       │
│     └─ Password - bcrypt hashed (cost 10)                  │
│                                                             │
│  4. Authorization                                           │
│     ├─ Role-based access (user, admin, mentor)             │
│     ├─ VIP content filtering                               │
│     ├─ Room ownership validation                           │
│     └─ Interview room capacity checks                      │
│                                                             │
│  5. State Management                                        │
│     ├─ OAuth state - Redis with TTL (10 min)               │
│     ├─ Room state - Redis or Memory                        │
│     └─ Session - JWT in HttpOnly cookie                    │
│                                                             │
│  6. Input Validation                                        │
│     ├─ Email format (regex)                                │
│     ├─ Password length (8+ chars)                          │
│     ├─ Slug format                                         │
│     └─ JSON schema validation                              │
│                                                             │
│  7. Rate Limiting & Monitoring                             │
│     ├─ OpenTelemetry tracing                               │
│     ├─ Request ID tracking                                 │
│     └─ Jaeger distributed tracing                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 扩展性考虑

### 水平扩展 (Horizontal Scaling)

```
                          Load Balancer
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
         ┌──────────┐    ┌──────────┐    ┌──────────┐
         │ API Pod 1│    │ API Pod 2│    │ API Pod 3│
         └────┬─────┘    └────┬─────┘    └────┬─────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
       ┌──────────────┐              ┌──────────────┐
       │ PostgreSQL   │              │ Redis Cluster│
       │ (Primary +   │              │ (Distributed │
       │  Replicas)   │              │  State)      │
       └──────────────┘              └──────────────┘
```

**关键点：**
- **无状态API**: 所有状态存储在Redis/PostgreSQL
- **Redis**: 用于分布式房间状态、OAuth state、Pub/Sub
- **数据库**: 使用读写分离（Primary + Read Replicas）
- **LiveKit**: 独立的视频流基础设施

---

## 总结

Donfra API采用**清晰的分层架构**和**依赖注入模式**，具有以下特点：

✅ **模块化设计** - 每个domain服务独立封装业务逻辑
✅ **可插拔存储** - Repository模式支持内存/Redis切换
✅ **多种认证方式** - JWT + OAuth 2.0 + Admin token
✅ **VIP内容控制** - 服务层实现访问控制
✅ **实时协作** - WebSocket + Redis Pub/Sub
✅ **可观测性** - OpenTelemetry + Jaeger追踪
✅ **安全第一** - bcrypt密码、CSRF保护、CORS策略
✅ **水平扩展就绪** - 无状态设计 + 分布式缓存

这个架构非常适合教育平台的需求，支持实时协作、视频流、OAuth登录等复杂功能。
