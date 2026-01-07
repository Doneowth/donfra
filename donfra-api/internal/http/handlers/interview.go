package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"donfra-api/internal/domain/interview"
	"donfra-api/internal/pkg/httputil"
	"donfra-api/internal/pkg/tracing"
)

// InitInterviewRoomHandler handles POST /api/interview/init
// Creates a new interview room for the authenticated admin user
// Only admin users can create rooms
func (h *Handlers) InitInterviewRoomHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.InitInterviewRoom")
	defer span.End()

	if h.interviewSvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "interview service unavailable")
		return
	}

	// Get user ID from context (set by RequireAuth middleware)
	userID, ok := ctx.Value("user_id").(uint)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "user authentication required")
		return
	}

	// Create room (authorization already enforced by middleware)
	resp, err := h.interviewSvc.InitRoom(ctx, userID)
	if err != nil {
		tracing.RecordError(span, err)
		switch {
		case errors.Is(err, interview.ErrAdminRequired):
			httputil.WriteError(w, http.StatusForbidden, "admin or god user required to create interview rooms")
		case errors.Is(err, interview.ErrRoomAlreadyExists):
			httputil.WriteError(w, http.StatusConflict, "user already has an active room")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to create room")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// JoinInterviewRoomHandler handles POST /api/interview/join
// Allows users to join a room via invite token
func (h *Handlers) JoinInterviewRoomHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.JoinInterviewRoom")
	defer span.End()

	if h.interviewSvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "interview service unavailable")
		return
	}

	// Parse request body
	var req interview.JoinRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.InviteToken == "" {
		httputil.WriteError(w, http.StatusBadRequest, "invite_token is required")
		return
	}

	// Join room
	resp, err := h.interviewSvc.JoinRoom(ctx, req.InviteToken)
	if err != nil {
		tracing.RecordError(span, err)
		switch {
		case errors.Is(err, interview.ErrInvalidToken):
			httputil.WriteError(w, http.StatusUnauthorized, "invalid or expired invite token")
		case errors.Is(err, interview.ErrRoomNotFound):
			httputil.WriteError(w, http.StatusNotFound, "room not found or has been closed")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to join room")
		}
		return
	}

	// Set room_access cookie for subsequent requests
	http.SetCookie(w, &http.Cookie{
		Name:     "room_access",
		Value:    resp.RoomID,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400, // 24 hours
	})

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// CloseInterviewRoomHandler handles POST /api/interview/close
// Closes (soft-deletes) a room owned by the authenticated user
func (h *Handlers) CloseInterviewRoomHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.CloseInterviewRoom")
	defer span.End()

	if h.interviewSvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "interview service unavailable")
		return
	}

	// Get user ID from context (set by RequireAuth middleware)
	userID, ok := ctx.Value("user_id").(uint)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "user authentication required")
		return
	}

	// Parse request body
	var req interview.CloseRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.RoomID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "room_id is required")
		return
	}

	// Close room
	err := h.interviewSvc.CloseRoom(ctx, req.RoomID, userID)
	if err != nil {
		tracing.RecordError(span, err)
		switch {
		case errors.Is(err, interview.ErrRoomNotFound):
			httputil.WriteError(w, http.StatusNotFound, "room not found")
		case errors.Is(err, interview.ErrUnauthorized):
			httputil.WriteError(w, http.StatusForbidden, "only room owner can close the room")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to close room")
		}
		return
	}

	// Clear room_access cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "room_access",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	httputil.WriteJSON(w, http.StatusOK, interview.CloseRoomResponse{
		RoomID:  req.RoomID,
		Message: "Room closed successfully",
	})
}

// GetMyRoomsHandler handles GET /api/interview/my-rooms
// Returns all active rooms owned by the authenticated user
func (h *Handlers) GetMyRoomsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.GetMyRooms")
	defer span.End()

	if h.interviewSvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "interview service unavailable")
		return
	}

	// Get user ID from context (set by RequireAuth middleware)
	userID, ok := ctx.Value("user_id").(uint)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "user authentication required")
		return
	}

	// Get all active rooms for this user
	rooms, err := h.interviewSvc.GetActiveRoomsByOwner(ctx, userID)
	if err != nil {
		tracing.RecordError(span, err)
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get rooms")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"rooms": rooms,
	})
}

// GetRoomStatusHandler handles GET /api/interview/rooms/:room_id/status
// Returns the status of a specific room
func (h *Handlers) GetRoomStatusHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.GetRoomStatus")
	defer span.End()

	if h.interviewSvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "interview service unavailable")
		return
	}

	// Get room_id from URL parameter
	roomID := chi.URLParam(r, "room_id")
	if roomID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "room_id is required")
		return
	}

	// Get room status
	status, err := h.interviewSvc.GetRoomStatus(ctx, roomID)
	if err != nil {
		tracing.RecordError(span, err)
		if errors.Is(err, interview.ErrRoomNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "room not found")
		} else {
			httputil.WriteError(w, http.StatusInternalServerError, "failed to get room status")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, status)
}

// GetAllRoomsHandler handles GET /api/interview/rooms/all
// Returns all active rooms (admin only)
func (h *Handlers) GetAllRoomsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.GetAllRooms")
	defer span.End()

	if h.interviewSvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "interview service unavailable")
		return
	}

	// Get all active rooms
	rooms, err := h.interviewSvc.GetAllRooms(ctx)
	if err != nil {
		tracing.RecordError(span, err)
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get rooms")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"rooms": rooms,
	})
}
