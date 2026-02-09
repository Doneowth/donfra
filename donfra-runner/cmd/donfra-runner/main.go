package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"donfra-runner/internal/handler"
	"donfra-runner/internal/runner"
)

const version = "1.0.0"

func main() {
	addr := envOrDefault("ADDR", ":8090")
	sandboxMode := runner.SandboxMode(envOrDefault("SANDBOX_MODE", "direct"))
	nsjailPath := envOrDefault("NSJAIL_PATH", "/usr/bin/nsjail")
	configDir := envOrDefault("NSJAIL_CONFIG_DIR", "/etc/nsjail")
	maxConcurrent := envIntOrDefault("MAX_CONCURRENT", 4)
	defaultTimeoutMs := envIntOrDefault("DEFAULT_TIMEOUT_MS", 5000)
	maxTimeoutMs := envIntOrDefault("MAX_TIMEOUT_MS", 10000)
	maxOutputBytes := envIntOrDefault("MAX_OUTPUT_BYTES", 65536)

	limiter := runner.NewLimiter(maxConcurrent)

	r := runner.New(runner.Config{
		SandboxMode:    sandboxMode,
		NsjailPath:     nsjailPath,
		ConfigDir:      configDir,
		MaxTimeoutMs:   maxTimeoutMs,
		DefaultTimeout: defaultTimeoutMs,
		MaxOutputBytes: maxOutputBytes,
	}, limiter)

	h := handler.New(r, limiter, version)

	mux := http.NewServeMux()
	mux.HandleFunc("/execute", h.Execute)
	mux.HandleFunc("/health", h.Health)

	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("donfra-runner %s listening on %s (sandbox=%s, max_concurrent=%d, timeout=%dms)",
			version, addr, sandboxMode, maxConcurrent, defaultTimeoutMs)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-done
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}

	log.Println("shutdown complete")
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envIntOrDefault(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
