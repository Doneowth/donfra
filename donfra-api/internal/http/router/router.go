package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"donfra-api/internal/config"
	"donfra-api/internal/domain/auth"
	"donfra-api/internal/domain/room"
	"donfra-api/internal/domain/study"
	"donfra-api/internal/http/handlers"
	"donfra-api/internal/http/middleware"
)

func New(cfg config.Config, roomSvc *room.Service, studySvc *study.Service, authSvc *auth.AuthService) http.Handler {
	root := chi.NewRouter()

	// Tracing middleware (must be first to capture all requests)
	root.Use(middleware.Tracing("donfra-api"))

	root.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:7777", "http://97.107.136.151:80"},
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

	h := handlers.New(roomSvc, studySvc, authSvc)
	v1 := chi.NewRouter()
	v1.Post("/admin/login", h.AdminLogin)
	v1.Post("/room/init", h.RoomInit)
	v1.Get("/room/status", h.RoomStatus)
	v1.Post("/room/join", h.RoomJoin)
	// Removed: /room/update-people - now using Redis Pub/Sub for headcount updates
	v1.Post("/room/close", h.RoomClose)
	v1.Post("/room/run", h.RunCode)

	// Lesson routes with optional admin middleware for read operations
	v1.With(middleware.OptionalAdmin(authSvc)).Get("/lessons", h.ListLessonsHandler)
	v1.With(middleware.OptionalAdmin(authSvc)).Get("/lessons/{slug}", h.GetLessonBySlugHandler)
	v1.With(middleware.AdminOnly(authSvc)).Post("/lessons", h.CreateLessonHandler)
	v1.With(middleware.AdminOnly(authSvc)).Patch("/lessons/{slug}", h.UpdateLessonHandler)
	v1.With(middleware.AdminOnly(authSvc)).Delete("/lessons/{slug}", h.DeleteLessonHandler)

	root.Mount("/api/v1", v1)
	root.Mount("/api", v1)
	return root
}
