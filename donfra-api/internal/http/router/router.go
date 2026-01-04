package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"donfra-api/internal/config"
	"donfra-api/internal/domain/auth"
	"donfra-api/internal/domain/google"
	"donfra-api/internal/domain/interview"
	"donfra-api/internal/domain/livekit"
	"donfra-api/internal/domain/room"
	"donfra-api/internal/domain/study"
	"donfra-api/internal/domain/user"
	"donfra-api/internal/http/handlers"
	"donfra-api/internal/http/middleware"
)

func New(cfg config.Config, roomSvc *room.Service, studySvc *study.Service, authSvc *auth.AuthService, userSvc *user.Service, googleSvc *google.GoogleOAuthService, interviewSvc interview.Service, livekitSvc *livekit.Service) http.Handler {
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

	h := handlers.New(roomSvc, studySvc, authSvc, userSvc, googleSvc, interviewSvc, livekitSvc)
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

	// ===== Admin Routes =====
	v1.Post("/admin/login", h.AdminLogin)

	// ===== Room Routes =====
	v1.Post("/room/init", h.RoomInit)
	v1.Get("/room/status", h.RoomStatus)
	v1.Post("/room/join", h.RoomJoin)
	// Removed: /room/update-people - now using Redis Pub/Sub for headcount updates
	// Removed: /room/run - code execution now via WebSocket in donfra-ws
	// Admin only: close room (supports both admin token and admin user JWT)
	v1.With(middleware.RequireAdminUser(authSvc, userSvc)).Post("/room/close", h.RoomClose)

	// ===== Lesson Routes =====
	// Public: list published lessons (with optional user auth)
	v1.With(middleware.OptionalAuth(userSvc)).Get("/lessons/summary", h.ListLessonsSummaryHandler)
	v1.With(middleware.OptionalAuth(userSvc)).Get("/lessons", h.ListLessonsHandler)
	v1.With(middleware.OptionalAuth(userSvc)).Get("/lessons/{slug}", h.GetLessonBySlugHandler)

	// Admin only: CRUD operations (supports both admin token and admin user JWT)
	v1.With(middleware.RequireAdminUser(authSvc, userSvc)).Post("/lessons", h.CreateLessonHandler)
	v1.With(middleware.RequireAdminUser(authSvc, userSvc)).Patch("/lessons/{slug}", h.UpdateLessonHandler)
	v1.With(middleware.RequireAdminUser(authSvc, userSvc)).Delete("/lessons/{slug}", h.DeleteLessonHandler)

	// ===== Code Execution Routes =====
	// Removed: /code/execute - code execution now via WebSocket in donfra-ws (see CodePad.tsx)

	// ===== Interview Room Routes =====
	// Authenticated users can create/join/close interview rooms
	v1.With(middleware.RequireAuth(userSvc)).Post("/interview/init", h.InitInterviewRoomHandler)
	v1.Post("/interview/join", h.JoinInterviewRoomHandler) // Public: anyone with invite token can join
	v1.With(middleware.RequireAuth(userSvc)).Post("/interview/close", h.CloseInterviewRoomHandler)
	v1.With(middleware.RequireAuth(userSvc)).Get("/interview/my-rooms", h.GetMyRoomsHandler)

	// ===== LiveKit Live Streaming Routes =====
	// Admin only: create and end sessions
	v1.With(middleware.RequireAdminUser(authSvc, userSvc)).Post("/live/create", h.CreateLiveSession)
	v1.With(middleware.RequireAdminUser(authSvc, userSvc)).Post("/live/end", h.EndLiveSession)
	// Public: anyone can join with session ID
	v1.Post("/live/join", h.JoinLiveSession)

	root.Mount("/api/v1", v1)
	root.Mount("/api", v1)
	return root
}
