package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Request-Id") == "" {
			var b [8]byte
			_, _ = rand.Read(b[:])
			w.Header().Set("X-Request-Id", hex.EncodeToString(b[:]))
		}
		next.ServeHTTP(w, r)
	})
}
