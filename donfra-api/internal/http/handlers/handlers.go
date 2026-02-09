package handlers

import (
	"context"
	"net/http"

	"donfra-api/internal/domain/aiagent"
	"donfra-api/internal/domain/google"
	"donfra-api/internal/domain/interview"
	"donfra-api/internal/domain/livekit"
	"donfra-api/internal/domain/runner"
	"donfra-api/internal/domain/study"
	"donfra-api/internal/domain/user"
)

// StudyService defines the interface for lesson operations.
type StudyService interface {
	ListPublishedLessonsPaginated(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error)
	ListAllLessonsPaginated(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error)
	ListPublishedLessonsSummaryPaginated(ctx context.Context, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error)
	ListAllLessonsSummaryPaginated(ctx context.Context, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error)
	GetLessonBySlug(ctx context.Context, slug string, hasVipAccess bool) (*study.Lesson, error)
	CreateLesson(ctx context.Context, newLesson *study.Lesson) (*study.Lesson, error)
	UpdateLessonBySlug(ctx context.Context, slug string, updates map[string]any) error
	DeleteLessonBySlug(ctx context.Context, slug string) error
	SubmitForReview(ctx context.Context, slug string, submitterUserID uint) error
	ReviewLesson(ctx context.Context, slug string, reviewerUserID uint, action string) error
	ListPendingReviewLessonsSummaryPaginated(ctx context.Context, excludeUserID uint, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error)
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
	GetCookieMaxAgeDays() int
	UpdatePassword(ctx context.Context, userID uint, currentPassword, newPassword string) error
	ListAllUsers(ctx context.Context) ([]*user.User, error)
	UpdateUserRole(ctx context.Context, userID uint, newRole string) error
	UpdateUserActiveStatus(ctx context.Context, userID uint, isActive bool) error
}

// GoogleService defines the interface for Google OAuth operations.
type GoogleService interface {
	GenerateAuthURL() (authURL string, state string, err error)
	ExchangeCode(ctx context.Context, code, state string) (*google.GoogleUserInfo, error)
	GetFrontendURL() string
}

// InterviewService defines the interface for interview room operations.
type InterviewService interface {
	InitRoom(ctx context.Context, userID uint) (*interview.InitRoomResponse, error)
	JoinRoom(ctx context.Context, inviteToken string) (*interview.JoinRoomResponse, error)
	CloseRoom(ctx context.Context, roomID string, userID uint) error
	GetRoomByID(ctx context.Context, roomID string) (*interview.InterviewRoom, error)
	GetRoomStatus(ctx context.Context, roomID string) (*interview.RoomStatusResponse, error)
	GetAllRooms(ctx context.Context) ([]*interview.InterviewRoom, error)
	UpdateHeadcount(ctx context.Context, roomID string, headcount int) error
	GetActiveRoomsByOwner(ctx context.Context, ownerID uint) ([]*interview.InterviewRoom, error)
}

// LiveKitService defines the interface for LiveKit live streaming operations.
type LiveKitService interface {
	CreateSession(ctx context.Context, title string, ownerName string) (*livekit.CreateSessionResponse, error)
	JoinSession(ctx context.Context, sessionID, userName string, isHost, isHidden, canStealth bool) (*livekit.JoinSessionResponse, error)
	EndSession(ctx context.Context, sessionID string) (*livekit.EndSessionResponse, error)
}

// AIAgentService defines the interface for AI code analysis operations.
type AIAgentService interface {
	AnalyzeCode(ctx context.Context, codeContent, question string) (*aiagent.AIResponse, error)
	Chat(ctx context.Context, codeContent, question string, history []aiagent.DeepSeekMessage) (*aiagent.AIResponse, error)
	ChatStream(ctx context.Context, codeContent, question string, history []aiagent.DeepSeekMessage) (*http.Response, error)
}

// Handlers holds all service dependencies for HTTP handlers.
type Handlers struct {
	studySvc     StudyService
	userSvc      UserService
	googleSvc    GoogleService
	interviewSvc InterviewService
	livekitSvc   LiveKitService
	aiAgentSvc   AIAgentService
	runnerClient *runner.Client
}

// New creates a new Handlers instance with the given services.
func New(studySvc StudyService, userSvc UserService, googleSvc GoogleService, interviewSvc InterviewService, livekitSvc LiveKitService, aiAgentSvc AIAgentService, runnerClient *runner.Client) *Handlers {
	return &Handlers{
		studySvc:     studySvc,
		userSvc:      userSvc,
		googleSvc:    googleSvc,
		interviewSvc: interviewSvc,
		livekitSvc:   livekitSvc,
		aiAgentSvc:   aiAgentSvc,
		runnerClient: runnerClient,
	}
}
