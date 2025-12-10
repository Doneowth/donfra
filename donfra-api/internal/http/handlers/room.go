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
	url, token, err := h.roomSvc.Init(strings.TrimSpace(req.Passcode), req.Size)
	if err != nil {
		httputil.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, room.InitResponse{InviteURL: url, Token: token})
}

func (h *Handlers) RoomStatus(w http.ResponseWriter, r *http.Request) {
	if h.roomSvc.IsOpen() && h.roomSvc.InviteLink() == "" {
		httputil.WriteError(w, http.StatusInternalServerError, "invite link is empty while room is open")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, room.StatusResponse{
		Open:       h.roomSvc.IsOpen(),
		InviteLink: h.roomSvc.InviteLink(),
		Headcount:  h.roomSvc.Headcount(),
		Limit:      h.roomSvc.Limit(),
	})
}

func (h *Handlers) RoomJoin(w http.ResponseWriter, r *http.Request) {
	var req room.JoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if !h.roomSvc.IsOpen() {
		httputil.WriteError(w, http.StatusConflict, "room is not open")
		return
	}

	if ok := h.roomSvc.Validate(req.Token); !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "invalid token")
		return
	}

	limit := h.roomSvc.Limit()
	if h.roomSvc.Headcount() >= limit {
		httputil.WriteError(w, http.StatusForbidden, "room is full at the configured limit")
		return
	}

	http.SetCookie(w, &http.Cookie{Name: "room_access", Value: "1", Path: "/", MaxAge: 86400, SameSite: http.SameSiteLaxMode, HttpOnly: false, Secure: false})
	httputil.WriteJSON(w, http.StatusOK, room.JoinResponse{Success: true})
}

// RoomClose closes the room. Requires admin authentication via middleware.
func (h *Handlers) RoomClose(w http.ResponseWriter, r *http.Request) {
	if err := h.roomSvc.Close(); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to close room")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, room.StatusResponse{Open: h.roomSvc.IsOpen()})
}

func (h *Handlers) RoomUpdatePeople(w http.ResponseWriter, r *http.Request) {
	var req room.UpdateHeadcountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if err := h.roomSvc.UpdateHeadcount(req.Headcount); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to update headcount")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, room.UpdateHeadcountResponse{Headcount: req.Headcount})
}