package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"donfra-api/internal/config"
	"donfra-api/internal/domain/aiagent"
	"donfra-api/internal/domain/google"
	"donfra-api/internal/domain/interview"
	"donfra-api/internal/domain/livekit"
	"donfra-api/internal/domain/study"
	"donfra-api/internal/domain/user"
	"donfra-api/internal/http/handlers"
	"donfra-api/internal/http/middleware"
)

func New(cfg config.Config, studySvc *study.Service, userSvc *user.Service, googleSvc *google.GoogleOAuthService, interviewSvc interview.Service, livekitSvc *livekit.Service, aiAgentSvc *aiagent.Service) http.Handler {
	root := chi.NewRouter()

	// Tracing middleware (must be first to capture all requests)
	root.Use(middleware.Tracing("donfra-api"))

	root.Use(cors.Handler(cors.Options{
		// AllowedOrigins:   []string{"http://localhost", "http://localhost:3000", "http://localhost:7777", "http://donfra.local", "http://97.107.136.151:80"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-CSRF-Token", "Authorization"},
		ExposedHeaders:   []string{"X-Request-Id"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	root.Use(middleware.RequestID)

	root.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	h := handlers.New(studySvc, userSvc, googleSvc, interviewSvc, livekitSvc, aiAgentSvc)
	v1 := chi.NewRouter()

	// ===== User Authentication Routes (Public) =====
	v1.Post("/auth/register", h.Register)
	v1.Post("/auth/login", h.Login)
	v1.Post("/auth/logout", h.Logout)

	// ===== Google OAuth routes =====
	v1.Get("/auth/google/url", h.GoogleAuthURL)
	v1.Get("/auth/google/callback", h.GoogleCallback)

	// ===== User Routes (Protected) =====
	v1.With(middleware.OptionalAuth(userSvc)).Get("/auth/me", h.GetCurrentUser)
	v1.With(middleware.RequireAuth(userSvc)).Post("/auth/refresh", h.RefreshToken)
	v1.With(middleware.RequireAuth(userSvc)).Post("/auth/update-password", h.UpdatePassword)

	// ===== Admin Routes (God User Only) =====
	// God user only: user management (including role changes)
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireGodUser()).Get("/admin/users", h.ListAllUsersHandler)
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireGodUser()).Patch("/admin/users/{id}/role", h.UpdateUserRoleHandler)
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireGodUser()).Patch("/admin/users/{id}/active", h.UpdateUserActiveStatusHandler)

	// ===== Lesson Routes =====
	// Public: list published lessons (with optional user auth)
	v1.With(middleware.OptionalAuth(userSvc)).Get("/lessons/summary", h.ListLessonsSummaryHandler)
	v1.With(middleware.OptionalAuth(userSvc)).Get("/lessons", h.ListLessonsHandler)
	v1.With(middleware.OptionalAuth(userSvc)).Get("/lessons/{slug}", h.GetLessonBySlugHandler)

	// Admin or God: CRUD operations for lessons
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireAdminOrAbove()).Post("/lessons", h.CreateLessonHandler)
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireAdminOrAbove()).Patch("/lessons/{slug}", h.UpdateLessonHandler)
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireAdminOrAbove()).Delete("/lessons/{slug}", h.DeleteLessonHandler)

	// ===== Interview Room Routes =====
	// Admin or above: create interview rooms
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireAdminOrAbove()).Post("/interview/init", h.InitInterviewRoomHandler)
	v1.Post("/interview/join", h.JoinInterviewRoomHandler) // Public: anyone with invite token can join
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireAdminOrAbove()).Post("/interview/close", h.CloseInterviewRoomHandler)
	v1.With(middleware.RequireAuth(userSvc)).Get("/interview/my-rooms", h.GetMyRoomsHandler)
	v1.Get("/interview/rooms/{room_id}/status", h.GetRoomStatusHandler) // Public: get room status by room_id
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireAdminOrAbove()).Get("/interview/rooms/all", h.GetAllRoomsHandler) // Admin or God: get all rooms

	// ===== LiveKit Live Streaming Routes =====
	// Admin or God: create and end sessions
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireAdminOrAbove()).Post("/live/create", h.CreateLiveSession)
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireAdminOrAbove()).Post("/live/end", h.EndLiveSession)
	// Public: anyone can join with session ID
	v1.Post("/live/join", h.JoinLiveSession)

	// ===== AI Agent Routes =====
	// VIP and Admin only: AI-powered code analysis and chat
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireVIPOrAdmin()).Post("/ai/analyze", h.AIAnalyzeCode)
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireVIPOrAdmin()).Post("/ai/chat", h.AIChat)
	v1.With(middleware.RequireAuth(userSvc), middleware.RequireVIPOrAdmin()).Post("/ai/chat/stream", h.AIChatStream)

	root.Mount("/api/v1", v1)
	root.Mount("/api", v1)
	return root
}
