package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"donfra-runner/internal/handler"
	"donfra-runner/internal/runner"
)

const version = "2.0.0"

func main() {
	addr := envOrDefault("ADDR", ":8090")
	jailMode := runner.JailMode(envOrDefault("JAIL_MODE", "direct"))
	maxConcurrent := envIntOrDefault("MAX_CONCURRENT", 4)
	defaultTimeoutMs := envIntOrDefault("DEFAULT_TIMEOUT_MS", 5000)
	maxTimeoutMs := envIntOrDefault("MAX_TIMEOUT_MS", 10000)
	maxOutputBytes := envIntOrDefault("MAX_OUTPUT_BYTES", 65536)

	limiter := runner.NewLimiter(maxConcurrent)

	cfg := runner.Config{
		JailMode:    jailMode,
		MaxTimeoutMs:   maxTimeoutMs,
		DefaultTimeout: defaultTimeoutMs,
		MaxOutputBytes: maxOutputBytes,
	}

	// Initialize K8s executor when in k8s jail mode.
	var k8sExecutor *runner.K8sExecutor
	if jailMode == runner.JailK8sJob {
		redisAddr := envOrDefault("REDIS_ADDR", "redis:6379")
		jailImage := envOrDefault("JAIL_IMAGE", "doneowth/donfra-jail:1.0.0")
		k8sNamespace := envOrDefault("K8S_NAMESPACE", "donfra-eng")

		// Parse Redis host:port
		redisHost := "redis"
		redisPort := "6379"
		if parts := strings.SplitN(redisAddr, ":", 2); len(parts) == 2 {
			redisHost = parts[0]
			redisPort = parts[1]
		}
		_ = redisHost // used only for logging below

		redisClient := redis.NewClient(&redis.Options{
			Addr: redisAddr,
		})

		// Verify Redis connectivity.
		pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer pingCancel()
		if err := redisClient.Ping(pingCtx).Err(); err != nil {
			log.Fatalf("redis connection failed (%s): %v", redisAddr, err)
		}
		log.Printf("[runner] redis connected: %s", redisAddr)

		// Initialize K8s in-cluster client.
		k8sCfg, err := rest.InClusterConfig()
		if err != nil {
			log.Fatalf("k8s in-cluster config failed: %v", err)
		}
		kubeClient, err := kubernetes.NewForConfig(k8sCfg)
		if err != nil {
			log.Fatalf("k8s client init failed: %v", err)
		}
		log.Printf("[runner] k8s client initialized (namespace: %s)", k8sNamespace)

		k8sExecutor = runner.NewK8sExecutor(kubeClient, redisClient, k8sNamespace, jailImage, cfg)
		log.Printf("[runner] jail image: %s, redis: %s:%s", jailImage, redisHost, redisPort)
	}

	r := runner.New(cfg, limiter, k8sExecutor)
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
		log.Printf("donfra-runner %s listening on %s (jail=%s, max_concurrent=%d, timeout=%dms)",
			version, addr, jailMode, maxConcurrent, defaultTimeoutMs)
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
