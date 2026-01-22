package middleware

import (
	"net/http"
	"strconv"
	"time"

	"donfra-api/internal/pkg/metrics"
)

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{w, http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Metrics middleware records HTTP request metrics for Prometheus
func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip metrics endpoint itself to avoid recursion
		if r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}

		metrics.HTTPRequestsInFlight.Inc()
		defer metrics.HTTPRequestsInFlight.Dec()

		start := time.Now()
		wrapped := newResponseWriter(w)

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(wrapped.statusCode)

		// Normalize path to avoid high cardinality
		path := normalizePath(r.URL.Path)

		metrics.RecordHTTPRequest(r.Method, path, status, duration)
	})
}

// normalizePath normalizes URL paths to reduce cardinality
// e.g., /api/v1/lessons/my-lesson -> /api/v1/lessons/:slug
func normalizePath(path string) string {
	// Common patterns to normalize
	patterns := map[string]string{
		"/api/v1/lessons/":          "/api/v1/lessons/:slug",
		"/api/lessons/":             "/api/lessons/:slug",
		"/api/v1/interview/rooms/":  "/api/v1/interview/rooms/:room_id",
		"/api/interview/rooms/":     "/api/interview/rooms/:room_id",
		"/api/v1/admin/users/":      "/api/v1/admin/users/:id",
		"/api/admin/users/":         "/api/admin/users/:id",
	}

	for prefix, normalized := range patterns {
		if len(path) > len(prefix) && path[:len(prefix)] == prefix {
			// Check if there's more path after the prefix (indicating a parameter)
			remaining := path[len(prefix):]
			// If remaining doesn't contain another slash, it's likely a parameter
			for i, c := range remaining {
				if c == '/' {
					// There's a sub-path, keep the normalized prefix and continue
					return normalized + remaining[i:]
				}
			}
			return normalized
		}
	}

	return path
}
