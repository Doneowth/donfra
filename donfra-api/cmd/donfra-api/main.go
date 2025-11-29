package main

import (
	"log"
	"net/http"
	"time"

	"donfra-api/internal/config"
	"donfra-api/internal/domain/room"
	"donfra-api/internal/http/router"
)

func main() {
	cfg := config.Load()

	store := room.NewMemoryStore()
	roomSvc := room.NewService(store, cfg.Passcode, cfg.BaseURL)
	r := router.New(cfg, roomSvc)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("[donfra-api] listening on %s", cfg.Addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
