package config

import (
	"os"
	"strconv"
)

type Config struct {
	Addr        string
	BaseURL     string
	FrontendURL string
	CORSOrigin  string
	JWTSecret   string
	DatabaseURL          string
	JaegerEndpoint       string
	RedisAddr            string
	UseRedis             bool
	LiveKitAPIKey        string
	LiveKitAPISecret     string
	LiveKitServerURL     string
	LiveKitPublicURL     string

	// Token expiration settings
	JWTExpiryHours          int // User JWT token expiry in hours (default: 168 = 7 days)
	CookieMaxAgeDays        int // Auth cookie max age in days (default: 7)
	OAuthStateExpiryMins    int // OAuth state expiry in minutes (default: 10)
	InviteTokenExpiryHours  int // Interview invite token expiry in hours (default: 24)
	LiveKitTokenExpiryHours int // LiveKit room token expiry in hours (default: 24)
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func getenvInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return def
}

func Load() Config {
	return Config{
		Addr:        getenv("ADDR", ":8080"),
		BaseURL:     getenv("BASE_URL", ""),
		FrontendURL: getenv("FRONTEND_URL", "http://localhost"),
		CORSOrigin:  getenv("CORS_ORIGIN", "http://localhost:3000"),
		JWTSecret:   getenv("JWT_SECRET", "donfra-secret"),
		DatabaseURL:      getenv("DATABASE_URL", "postgres://donfra:arfnod@localhost:5432/donfra_study?sslmode=disable"),
		JaegerEndpoint:   getenv("JAEGER_ENDPOINT", ""), // e.g., "jaeger:4318" or "localhost:4318"
		RedisAddr:        getenv("REDIS_ADDR", ""),      // e.g., "redis:6379" or "localhost:6379"
		UseRedis:         getenv("USE_REDIS", "false") == "true",
		LiveKitAPIKey:    getenv("LIVEKIT_API_KEY", "devkeydevkeydevkeydevkeydevkeydevkey"),
		LiveKitAPISecret: getenv("LIVEKIT_API_SECRET", "APISECRETdevkeyAPISECRETdevkeyAPISECRETdevkey"),
		LiveKitServerURL: getenv("LIVEKIT_SERVER_URL", "ws://livekit:7880"),
		LiveKitPublicURL: getenv("LIVEKIT_PUBLIC_URL", "/livekit"),

		// Token expiration settings
		JWTExpiryHours:          getenvInt("JWT_EXPIRY_HOURS", 168),          // 7 days
		CookieMaxAgeDays:        getenvInt("COOKIE_MAX_AGE_DAYS", 7),         // 7 days
		OAuthStateExpiryMins:    getenvInt("OAUTH_STATE_EXPIRY_MINS", 10),    // 10 minutes
		InviteTokenExpiryHours:  getenvInt("INVITE_TOKEN_EXPIRY_HOURS", 24),  // 24 hours
		LiveKitTokenExpiryHours: getenvInt("LIVEKIT_TOKEN_EXPIRY_HOURS", 24), // 24 hours
	}
}
