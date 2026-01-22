package handlers

import (
	"encoding/json"
	"net/http"
)

// CreateLiveSession creates a new live streaming session
func (h *Handlers) CreateLiveSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		Title     string `json:"title"`
		OwnerName string `json:"owner_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "Title is required", http.StatusBadRequest)
		return
	}

	if req.OwnerName == "" {
		http.Error(w, "Owner name is required", http.StatusBadRequest)
		return
	}

	resp, err := h.livekitSvc.CreateSession(ctx, req.Title, req.OwnerName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
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
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" {
		http.Error(w, "Session ID is required", http.StatusBadRequest)
		return
	}

	if req.UserName == "" {
		http.Error(w, "User name is required", http.StatusBadRequest)
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
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// EndLiveSession ends a live streaming session
func (h *Handlers) EndLiveSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		SessionID string `json:"session_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" {
		http.Error(w, "Session ID is required", http.StatusBadRequest)
		return
	}

	resp, err := h.livekitSvc.EndSession(ctx, req.SessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
