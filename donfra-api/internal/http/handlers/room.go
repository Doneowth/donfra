package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"donfra-api/internal/domain/room"
	"donfra-api/internal/pkg/httputil"
)

func (h *Handlers) RoomInit(w http.ResponseWriter, r *http.Request) {
	var req room.InitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	url, token, err := h.roomSvc.Init(r.Context(), strings.TrimSpace(req.Passcode), req.Size)
	if err != nil {
		httputil.WriteError(w, http.StatusConflict, err.Error())
		return
	}

	// Get room state to retrieve room_id
	state, err := h.roomSvc.GetStatus(r.Context())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get room state")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, room.InitResponse{InviteURL: url, RoomID: state.RoomID, Token: token})
}

func (h *Handlers) RoomStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if h.roomSvc.IsOpen(ctx) && h.roomSvc.InviteLink(ctx) == "" {
		httputil.WriteError(w, http.StatusInternalServerError, "invite link is empty while room is open")
		return
	}

	state, err := h.roomSvc.GetStatus(ctx)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get room state")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, room.StatusResponse{
		Open:       h.roomSvc.IsOpen(ctx),
		RoomID:     state.RoomID,
		InviteLink: h.roomSvc.InviteLink(ctx),
		Headcount:  h.roomSvc.Headcount(ctx),
		Limit:      h.roomSvc.Limit(ctx),
	})
}

func (h *Handlers) RoomJoin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req room.JoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if !h.roomSvc.IsOpen(ctx) {
		httputil.WriteError(w, http.StatusConflict, "room is not open")
		return
	}

	if ok := h.roomSvc.Validate(ctx, req.Token); !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "invalid token")
		return
	}

	limit := h.roomSvc.Limit(ctx)
	if h.roomSvc.Headcount(ctx) >= limit {
		httputil.WriteError(w, http.StatusForbidden, "room is full at the configured limit")
		return
	}

	http.SetCookie(w, &http.Cookie{Name: "room_access", Value: "1", Path: "/", MaxAge: 86400, SameSite: http.SameSiteLaxMode, HttpOnly: false, Secure: false})
	httputil.WriteJSON(w, http.StatusOK, room.JoinResponse{Success: true})
}

// RoomClose closes the room. Requires admin authentication via middleware.
func (h *Handlers) RoomClose(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := h.roomSvc.Close(ctx); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to close room")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, room.StatusResponse{Open: h.roomSvc.IsOpen(ctx)})
}

