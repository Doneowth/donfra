package handlers

import (
	"context"
	"net/http"

	"donfra-api/internal/domain/aiagent"
	"donfra-api/internal/domain/auth"
	"donfra-api/internal/domain/google"
	"donfra-api/internal/domain/interview"
	"donfra-api/internal/domain/livekit"
	"donfra-api/internal/domain/room"
	"donfra-api/internal/domain/study"
	"donfra-api/internal/domain/user"
)

// RoomService defines the interface for room operations.
type RoomService interface {
	Init(ctx context.Context, passcode string, size int) (inviteURL string, token string, err error)
	IsOpen(ctx context.Context) bool
	GetStatus(ctx context.Context) (*room.RoomState, error)
	InviteLink(ctx context.Context) string
	Headcount(ctx context.Context) int
	Limit(ctx context.Context) int
	Validate(ctx context.Context, token string) bool
	Close(ctx context.Context) error
	UpdateHeadcount(ctx context.Context, count int) error
}

// StudyService defines the interface for lesson operations.
type StudyService interface {
	ListPublishedLessons(ctx context.Context, hasVipAccess bool) ([]study.Lesson, error)
	ListAllLessons(ctx context.Context, hasVipAccess bool) ([]study.Lesson, error)
	ListPublishedLessonsPaginated(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error)
	ListAllLessonsPaginated(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error)
	ListPublishedLessonsSummaryPaginated(ctx context.Context, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error)
	ListAllLessonsSummaryPaginated(ctx context.Context, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error)
	GetLessonBySlug(ctx context.Context, slug string, hasVipAccess bool) (*study.Lesson, error)
	CreateLesson(ctx context.Context, newLesson *study.Lesson) (*study.Lesson, error)
	UpdateLessonBySlug(ctx context.Context, slug string, updates map[string]any) error
	DeleteLessonBySlug(ctx context.Context, slug string) error
}

// AuthService defines the interface for authentication operations.
type AuthService interface {
	Validate(tokenStr string) (*auth.Claims, error)
	IssueAdminToken(pass string) (string, error)
}

// UserService defines the interface for user operations.
type UserService interface {
	Register(ctx context.Context, req *user.RegisterRequest) (*user.User, error)
	Login(ctx context.Context, req *user.LoginRequest) (*user.User, string, error)
	LoginOrRegisterWithGoogle(ctx context.Context, googleID, email, name, avatar string) (*user.User, string, error)
	ValidateToken(tokenString string) (*user.Claims, error)
	GetUserByID(ctx context.Context, id uint) (*user.User, error)
	GetUserByEmail(ctx context.Context, email string) (*user.User, error)
	GetJWTSecret() string
	GetJWTExpiry() int
	UpdatePassword(ctx context.Context, userID uint, currentPassword, newPassword string) error
}

// GoogleService defines the interface for Google OAuth operations.
type GoogleService interface {
	GenerateAuthURL() (authURL string, state string, err error)
	ExchangeCode(ctx context.Context, code, state string) (*google.GoogleUserInfo, error)
	GetFrontendURL() string
}

// InterviewService defines the interface for interview room operations.
type InterviewService interface {
	InitRoom(ctx context.Context, userID uint, isAdmin bool) (*interview.InitRoomResponse, error)
	JoinRoom(ctx context.Context, inviteToken string) (*interview.JoinRoomResponse, error)
	CloseRoom(ctx context.Context, roomID string, userID uint) error
	GetRoomByID(ctx context.Context, roomID string) (*interview.InterviewRoom, error)
	UpdateHeadcount(ctx context.Context, roomID string, headcount int) error
	GetActiveRoomsByOwner(ctx context.Context, ownerID uint) ([]*interview.InterviewRoom, error)
}

// LiveKitService defines the interface for LiveKit live streaming operations.
type LiveKitService interface {
	CreateSession(ctx context.Context, title string, ownerName string) (*livekit.CreateSessionResponse, error)
	JoinSession(ctx context.Context, sessionID, userName string, isHost bool) (*livekit.JoinSessionResponse, error)
	EndSession(ctx context.Context, sessionID string) (*livekit.EndSessionResponse, error)
}

// AIAgentService defines the interface for AI code analysis operations.
type AIAgentService interface {
	AnalyzeCode(ctx context.Context, userID int, codeContent, question string) (*aiagent.AIResponse, error)
	Chat(ctx context.Context, userID int, codeContent, question string, history []aiagent.DeepSeekMessage) (*aiagent.AIResponse, error)
	ChatStream(ctx context.Context, codeContent, question string, history []aiagent.DeepSeekMessage) (*http.Response, error)
	GetConversationHistory(ctx context.Context, userID int, limit int) ([]*aiagent.AIConversation, error)
}

// Handlers holds all service dependencies for HTTP handlers.
type Handlers struct {
	roomSvc      RoomService
	studySvc     StudyService
	authSvc      AuthService
	userSvc      UserService
	googleSvc    GoogleService
	interviewSvc InterviewService
	livekitSvc   LiveKitService
	aiAgentSvc   AIAgentService
}

// New creates a new Handlers instance with the given services.
func New(roomSvc RoomService, studySvc StudyService, authSvc AuthService, userSvc UserService, googleSvc GoogleService, interviewSvc InterviewService, livekitSvc LiveKitService, aiAgentSvc AIAgentService) *Handlers {
	return &Handlers{
		roomSvc:      roomSvc,
		studySvc:     studySvc,
		authSvc:      authSvc,
		userSvc:      userSvc,
		googleSvc:    googleSvc,
		interviewSvc: interviewSvc,
		livekitSvc:   livekitSvc,
		aiAgentSvc:   aiAgentSvc,
	}
}
