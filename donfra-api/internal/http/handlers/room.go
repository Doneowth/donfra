package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"donfra-api/internal/domain/room"
	"donfra-api/internal/pkg/httputil"
)

type Handlers struct {
	roomSvc *room.Service
}

func New(roomSvc *room.Service) *Handlers {
	return &Handlers{roomSvc: roomSvc}
}

type initReq struct {
	Passcode string `json:"passcode"`
}
type initResp struct {
	InviteURL string `json:"inviteUrl"`
	Token     string `json:"token,omitempty"`
}

func (h *Handlers) RoomInit(w http.ResponseWriter, r *http.Request) {
	var req initReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	url, token, err := h.roomSvc.Init(strings.TrimSpace(req.Passcode))
	if err != nil {
		httputil.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, initResp{InviteURL: url, Token: token})
}

type statusResp struct {
	Open       bool   `json:"open"`
	InviteLink string `json:"inviteLink,omitempty"`
}

func (h *Handlers) RoomStatus(w http.ResponseWriter, r *http.Request) {
	if h.roomSvc.IsOpen() && h.roomSvc.InviteLink() == "" {
		httputil.WriteError(w, http.StatusInternalServerError, "invite link is empty while room is open")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, statusResp{Open: h.roomSvc.IsOpen(), InviteLink: h.roomSvc.InviteLink()})
}

type joinReq struct {
	Token string `json:"token"`
}

func (h *Handlers) RoomJoin(w http.ResponseWriter, r *http.Request) {
	var req joinReq
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

	http.SetCookie(w, &http.Cookie{Name: "room_access", Value: "1", Path: "/", MaxAge: 86400, SameSite: http.SameSiteLaxMode, HttpOnly: false, Secure: false})
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) RoomClose(w http.ResponseWriter, r *http.Request) {
	if err := h.roomSvc.Close(); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to close room")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, statusResp{Open: h.roomSvc.IsOpen()})
}
