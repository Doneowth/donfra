package middleware

import (
	"net/http"

	"donfra-api/internal/pkg/httputil"
)

// RequireGodUser requires the user to have role=god (super admin).
// This is the highest level of access, typically reserved for platform administrators.
// Must be used after RequireAuth middleware.
func RequireGodUser() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value("user_role").(string)
			if !ok || role != "god" {
				httputil.WriteError(w, http.StatusForbidden, "god user access required")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAdminOrAbove requires the user to have role=admin or role=god.
// This allows both admins and god users to access admin features.
// Must be used after RequireAuth middleware.
func RequireAdminOrAbove() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value("user_role").(string)
			if !ok {
				httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}
			if role != "admin" && role != "god" {
				httputil.WriteError(w, http.StatusForbidden, "admin access required")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
