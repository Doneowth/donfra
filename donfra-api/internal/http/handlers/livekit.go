package handlers

import (
	"encoding/json"
	"net/http"

	"donfra-api/internal/pkg/httputil"
)

// CreateLiveSession creates a new live streaming session
func (h *Handlers) CreateLiveSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		Title     string `json:"title"`
		OwnerName string `json:"owner_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Title == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Title is required")
		return
	}

	if req.OwnerName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Owner name is required")
		return
	}

	resp, err := h.livekitSvc.CreateSession(ctx, req.Title, req.OwnerName)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// JoinLiveSession allows a user to join an existing session
func (h *Handlers) JoinLiveSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		SessionID string `json:"session_id"`
		UserName  string `json:"user_name"`
		IsHost    bool   `json:"is_host"`
		IsHidden  bool   `json:"is_hidden"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.SessionID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Session ID is required")
		return
	}

	if req.UserName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "User name is required")
		return
	}

	// Check if user has stealth permission (admin or god)
	var canStealth bool
	if userID, ok := ctx.Value("user_id").(uint); ok {
		user, err := h.userSvc.GetUserByID(ctx, userID)
		if err == nil {
			canStealth = user.Role == "admin" || user.Role == "god"
		}
	}

	// Only users with permission can actually be hidden
	isHidden := req.IsHidden && canStealth

	resp, err := h.livekitSvc.JoinSession(ctx, req.SessionID, req.UserName, req.IsHost, isHidden, canStealth)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to join session")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// EndLiveSession ends a live streaming session
func (h *Handlers) EndLiveSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		SessionID string `json:"session_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.SessionID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Session ID is required")
		return
	}

	resp, err := h.livekitSvc.EndSession(ctx, req.SessionID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to end session")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}
