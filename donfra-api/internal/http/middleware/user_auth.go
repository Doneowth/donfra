package middleware

import (
	"context"
	"net/http"

	"donfra-api/internal/domain/user"
	"donfra-api/internal/pkg/httputil"
)

// UserAuthService defines the interface for user authentication.
type UserAuthService interface {
	ValidateToken(tokenString string) (*user.Claims, error)
}

// RequireAuth is a middleware that requires a valid JWT token in the cookie.
// It validates the token and injects the user ID into the request context.
func RequireAuth(userSvc UserAuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try to get token from cookie
			cookie, err := r.Cookie("auth_token")
			if err != nil {
				httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			// Validate token
			claims, err := userSvc.ValidateToken(cookie.Value)
			if err != nil {
				httputil.WriteError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			// Inject user information into context
			ctx := r.Context()
			ctx = context.WithValue(ctx, "user_id", claims.UserID)
			ctx = context.WithValue(ctx, "user_email", claims.Email)
			ctx = context.WithValue(ctx, "user_role", claims.Role)

			// Continue to next handler
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth is a middleware that optionally validates JWT token.
// If a valid token is present, it injects user info into context.
// If no token or invalid token, it continues without user info.
func OptionalAuth(userSvc UserAuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try to get token from cookie
			cookie, err := r.Cookie("auth_token")
			if err == nil {
				// Validate token
				claims, err := userSvc.ValidateToken(cookie.Value)
				if err == nil {
					// Inject user information into context
					ctx := r.Context()
					ctx = context.WithValue(ctx, "user_id", claims.UserID)
					ctx = context.WithValue(ctx, "user_email", claims.Email)
					ctx = context.WithValue(ctx, "user_role", claims.Role)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			// Continue without user info
			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole is a middleware that requires the user to have a specific role.
// Must be used after RequireAuth middleware.
func RequireRole(requiredRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get role from context (set by RequireAuth)
			role, ok := r.Context().Value("user_role").(string)
			if !ok {
				httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			// Check if user has required role
			if role != requiredRole {
				httputil.WriteError(w, http.StatusForbidden, "insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireVIPOrAbove is a middleware that requires the user to be VIP, admin, or god.
// Must be used after RequireAuth middleware.
func RequireVIPOrAbove() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get role from context (set by RequireAuth)
			role, ok := r.Context().Value("user_role").(string)
			if !ok {
				httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			// Check if user is VIP, admin, or god
			if role != "vip" && role != "admin" && role != "god" {
				httputil.WriteError(w, http.StatusForbidden, "VIP access required")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireVIPOrAdmin is deprecated. Use RequireVIPOrAbove instead.
func RequireVIPOrAdmin() func(http.Handler) http.Handler {
	return RequireVIPOrAbove()
}
