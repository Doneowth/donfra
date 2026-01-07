package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"donfra-api/internal/domain/user"
	"donfra-api/internal/pkg/httputil"
)

// Register handles user registration requests.
// POST /api/auth/register
func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req user.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Register user
	newUser, err := h.userSvc.Register(ctx, &req)
	if err != nil {
		switch {
		case errors.Is(err, user.ErrInvalidEmail):
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, user.ErrPasswordTooShort):
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, user.ErrEmailAlreadyExists):
			httputil.WriteError(w, http.StatusConflict, err.Error())
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to register user")
		}
		return
	}

	// Return user without token (client can login separately)
	httputil.WriteJSON(w, http.StatusCreated, map[string]interface{}{
		"user": newUser.ToPublic(),
	})
}

// Login handles user login requests.
// POST /api/auth/login
func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req user.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Authenticate user
	authenticatedUser, token, err := h.userSvc.Login(ctx, &req)
	if err != nil {
		switch {
		case errors.Is(err, user.ErrInvalidCredentials):
			httputil.WriteError(w, http.StatusUnauthorized, err.Error())
		case errors.Is(err, user.ErrUserInactive):
			httputil.WriteError(w, http.StatusForbidden, err.Error())
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "login failed")
		}
		return
	}

	// Set JWT token as HTTP-only cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    token,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60, // 7 days in seconds
		HttpOnly: true,              // Prevent XSS attacks
		Secure:   false,             // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
	})

	// Return user and token (token in cookie + optionally in response body)
	httputil.WriteJSON(w, http.StatusOK, user.LoginResponse{
		User:  authenticatedUser.ToPublic(),
		Token: token, // Optional: for clients that need it
	})
}

// Logout handles user logout requests.
// POST /api/auth/logout
func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	// Clear the auth token cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1, // Delete cookie immediately
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"message": "logged out successfully",
	})
}

// GetCurrentUser returns the currently authenticated user.
// GET /api/auth/me
// Uses OptionalAuth middleware - returns null user if not authenticated.
func (h *Handlers) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract user ID from context (set by OptionalAuth middleware)
	userID, ok := ctx.Value("user_id").(uint)
	if !ok {
		// Not authenticated - return null user instead of error
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
			"user": nil,
		})
		return
	}

	// Fetch user from database
	currentUser, err := h.userSvc.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found")
		} else {
			httputil.WriteError(w, http.StatusInternalServerError, "failed to get user")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"user": currentUser.ToPublic(),
	})
}

// RefreshToken refreshes the user's JWT token.
// POST /api/auth/refresh
// Requires authentication middleware.
func (h *Handlers) RefreshToken(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract user ID from context
	userID, ok := ctx.Value("user_id").(uint)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// Fetch user
	currentUser, err := h.userSvc.GetUserByID(ctx, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to refresh token")
		return
	}

	// Generate new token
	token, err := user.GenerateToken(currentUser, h.userSvc.GetJWTSecret(), h.userSvc.GetJWTExpiry())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	// Set new cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    token,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
	})
}

// UpdatePassword handles password update requests.
// POST /api/auth/update-password
// Requires authentication middleware.
func (h *Handlers) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract user ID from context
	userID, ok := ctx.Value("user_id").(uint)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// Parse request body
	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Update password
	err := h.userSvc.UpdatePassword(ctx, userID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		switch {
		case errors.Is(err, user.ErrIncorrectPassword):
			httputil.WriteError(w, http.StatusUnauthorized, err.Error())
		case errors.Is(err, user.ErrPasswordTooShort):
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, user.ErrUserNotFound):
			httputil.WriteError(w, http.StatusNotFound, "user not found")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to update password")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"message": "password updated successfully",
	})
}

// GoogleAuthURL generates a Google OAuth authorization URL.
// GET /api/auth/google/url
func (h *Handlers) GoogleAuthURL(w http.ResponseWriter, r *http.Request) {
	authURL, state, err := h.googleSvc.GenerateAuthURL()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to generate auth URL")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"auth_url": authURL,
		"state":    state,
	})
}

// GoogleCallback handles the Google OAuth callback.
// GET /api/auth/google/callback?code=xxx&state=xxx
func (h *Handlers) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		httputil.WriteError(w, http.StatusBadRequest, "missing code or state parameter")
		return
	}

	// Exchange code for user info
	userInfo, err := h.googleSvc.ExchangeCode(ctx, code, state)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "failed to verify Google login: "+err.Error())
		return
	}

	// Login or register user with Google info
	_, token, err := h.userSvc.LoginOrRegisterWithGoogle(
		ctx,
		userInfo.ID,
		userInfo.Email,
		userInfo.Name,
		userInfo.Picture,
	)
	if err != nil {
		switch {
		case errors.Is(err, user.ErrUserInactive):
			httputil.WriteError(w, http.StatusForbidden, err.Error())
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "Google login failed")
		}
		return
	}

	// Set JWT token as HTTP-only cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    token,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60, // 7 days in seconds
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
	})

	// Redirect to frontend homepage after successful login
	redirectURL := h.googleSvc.GetFrontendURL()
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// ListAllUsersHandler handles GET /api/admin/users
// Returns all users (admin only)
func (h *Handlers) ListAllUsersHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	users, err := h.userSvc.ListAllUsers(ctx)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to list users")
		return
	}

	// Convert to public format
	publicUsers := make([]user.UserPublic, len(users))
	for i, u := range users {
		publicUsers[i] = *u.ToPublic()
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"users": publicUsers,
	})
}

// UpdateUserRoleHandler handles PATCH /api/admin/users/:id/role
// Updates a user's role (admin only)
func (h *Handlers) UpdateUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse request body
	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Get user ID from URL parameter
	userIDStr := chi.URLParam(r, "id")
	if userIDStr == "" {
		httputil.WriteError(w, http.StatusBadRequest, "user ID is required")
		return
	}

	var userID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	// Update role
	if err := h.userSvc.UpdateUserRole(ctx, userID, req.Role); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found")
		} else {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"message": "User role updated successfully",
	})
}

// UpdateUserActiveStatusHandler handles PATCH /api/admin/users/:id/active
// Updates a user's active status (admin only)
func (h *Handlers) UpdateUserActiveStatusHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse request body
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Get user ID from URL parameter
	userIDStr := chi.URLParam(r, "id")
	if userIDStr == "" {
		httputil.WriteError(w, http.StatusBadRequest, "user ID is required")
		return
	}

	var userID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	// Update active status
	if err := h.userSvc.UpdateUserActiveStatus(ctx, userID, req.IsActive); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found")
		} else {
			httputil.WriteError(w, http.StatusInternalServerError, "failed to update user status")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"message": "User active status updated successfully",
	})
}
