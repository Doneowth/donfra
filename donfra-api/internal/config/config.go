package config

import "os"

type Config struct {
	Addr                 string
	Passcode             string
	BaseURL              string
	FrontendURL          string
	CORSOrigin           string
	AdminPass            string
	JWTSecret            string
	DatabaseURL          string
	JaegerEndpoint       string
	RedisAddr            string
	UseRedis             bool
	LiveKitAPIKey        string
	LiveKitAPISecret     string
	LiveKitServerURL     string
	LiveKitPublicURL     string
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func Load() Config {
	return Config{
		Addr:             getenv("ADDR", ":8080"),
		Passcode:         getenv("PASSCODE", "7777"),
		BaseURL:          getenv("BASE_URL", ""),
		FrontendURL:      getenv("FRONTEND_URL", "http://localhost"),
		CORSOrigin:       getenv("CORS_ORIGIN", "http://localhost:3000"),
		AdminPass:        getenv("ADMIN_PASS", "admin"),
		JWTSecret:        getenv("JWT_SECRET", "donfra-secret"),
		DatabaseURL:      getenv("DATABASE_URL", "postgres://donfra:arfnod@localhost:5432/donfra_study?sslmode=disable"),
		JaegerEndpoint:   getenv("JAEGER_ENDPOINT", ""), // e.g., "jaeger:4318" or "localhost:4318"
		RedisAddr:        getenv("REDIS_ADDR", ""),      // e.g., "redis:6379" or "localhost:6379"
		UseRedis:         getenv("USE_REDIS", "false") == "true",
		LiveKitAPIKey:    getenv("LIVEKIT_API_KEY", "devkeydevkeydevkeydevkeydevkeydevkey"),
		LiveKitAPISecret: getenv("LIVEKIT_API_SECRET", "APISECRETdevkeyAPISECRETdevkeyAPISECRETdevkey"),
		LiveKitServerURL: getenv("LIVEKIT_SERVER_URL", "ws://livekit:7880"),
		LiveKitPublicURL: getenv("LIVEKIT_PUBLIC_URL", "/livekit"),
	}
}
