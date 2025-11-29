package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"donfra-api/internal/config"
	"donfra-api/internal/domain/room"
	"donfra-api/internal/http/handlers"
	"donfra-api/internal/http/middleware"
)

func New(cfg config.Config, roomSvc *room.Service) http.Handler {
	root := chi.NewRouter()
	root.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:7777", "http://97.107.136.151:80"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-CSRF-Token", "Authorization"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	root.Use(middleware.RequestID)

	root.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	h := handlers.New(roomSvc)
	v1 := chi.NewRouter()
	v1.Post("/room/init", h.RoomInit)
	v1.Get("/room/status", h.RoomStatus)
	v1.Post("/room/join", h.RoomJoin)
	v1.Post("/room/close", h.RoomClose)
	v1.Post("/room/run", h.RunCode)

	root.Mount("/api/v1", v1)
	root.Mount("/api", v1)
	return root
}
