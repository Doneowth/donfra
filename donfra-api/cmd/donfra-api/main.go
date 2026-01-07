package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"donfra-api/internal/config"
	"donfra-api/internal/domain/aiagent"
	"donfra-api/internal/domain/db"
	"donfra-api/internal/domain/google"
	"donfra-api/internal/domain/interview"
	"donfra-api/internal/domain/livekit"
	"donfra-api/internal/domain/study"
	"donfra-api/internal/domain/user"
	"donfra-api/internal/http/router"
	"donfra-api/internal/pkg/tracing"

	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()

	// Initialize Jaeger tracing
	shutdown, err := tracing.InitTracer("donfra-api", cfg.JaegerEndpoint)
	if err != nil {
		log.Fatalf("failed to initialize tracer: %v", err)
	}
	defer func() {
		if err := shutdown(context.Background()); err != nil {
			log.Printf("failed to shutdown tracer: %v", err)
		}
	}()

	conn, err := db.InitFromEnv()
	if err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}

	// Initialize Redis client (optional)
	var redisClient *redis.Client
	if cfg.UseRedis && cfg.RedisAddr != "" {
		redisClient = redis.NewClient(&redis.Options{
			Addr: cfg.RedisAddr,
		})
		// Test Redis connection
		if err := redisClient.Ping(context.Background()).Err(); err != nil {
			log.Fatalf("failed to connect to Redis at %s: %v", cfg.RedisAddr, err)
		}
		log.Printf("[donfra-api] connected to Redis at %s", cfg.RedisAddr)
	}

	studySvc := study.NewService(conn)

	// Initialize user service with PostgreSQL repository
	userRepo := user.NewPostgresRepository(conn)
	userSvc := user.NewService(userRepo, cfg.JWTSecret, 168) // 168 hours = 7 days
	log.Println("[donfra-api] user service initialized")

	// Initialize interview room service with PostgreSQL repository
	interviewRepo := interview.NewRepository(conn)
	interviewSvc := interview.NewService(interviewRepo, cfg.JWTSecret, cfg.BaseURL)
	log.Println("[donfra-api] interview room service initialized")

	// Initialize LiveKit service (use PublicURL for client connections)
	livekitSvc := livekit.NewService(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret, cfg.LiveKitPublicURL)
	log.Println("[donfra-api] livekit service initialized")

	// Initialize Google OAuth service
	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	googleClientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	googleRedirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	if googleRedirectURL == "" {
		googleRedirectURL = "http://localhost:8080/api/auth/google/callback"
	}
	googleSvc := google.NewGoogleOAuthService(googleClientID, googleClientSecret, googleRedirectURL, cfg.FrontendURL, redisClient)
	if redisClient != nil {
		log.Printf("[donfra-api] google oauth service initialized with Redis (redirect: %s, frontend: %s)", googleRedirectURL, cfg.FrontendURL)
	} else {
		log.Printf("[donfra-api] google oauth service initialized with in-memory storage (redirect: %s, frontend: %s)", googleRedirectURL, cfg.FrontendURL)
	}

	// Initialize AI agent service
	deepSeekAPIKey := os.Getenv("DEEPSEEK_API_KEY")
	if deepSeekAPIKey == "" {
		deepSeekAPIKey = "91" // Default API key
	}
	aiAgentSvc := aiagent.NewService(deepSeekAPIKey)
	log.Println("[donfra-api] AI agent service initialized")

	r := router.New(cfg, studySvc, userSvc, googleSvc, interviewSvc, livekitSvc, aiAgentSvc)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("[donfra-api] listening on %s", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[donfra-api] shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server forced to shutdown: %v", err)
	}

	// Close Redis connection if open
	if redisClient != nil {
		if err := redisClient.Close(); err != nil {
			log.Printf("[donfra-api] error closing Redis: %v", err)
		}
	}

	log.Println("[donfra-api] server exited")
}
