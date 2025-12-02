package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"donfra-api/internal/domain/auth"
	"donfra-api/internal/domain/room"
	"donfra-api/internal/pkg/httputil"
)

type Handlers struct {
	roomSvc *room.Service
	auth    AuthService
}

type AuthService interface {
	Validate(tokenStr string) (*auth.Claims, error)
	IssueAdminToken(pass string) (string, error)
}

func New(roomSvc *room.Service, auth AuthService) *Handlers {
	return &Handlers{roomSvc: roomSvc, auth: auth}
}

type initReq struct {
	Passcode string `json:"passcode"`
	Size     int    `json:"size"`
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
	url, token, err := h.roomSvc.Init(strings.TrimSpace(req.Passcode), req.Size)
	if err != nil {
		httputil.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, initResp{InviteURL: url, Token: token})
}

type statusResp struct {
	Open       bool   `json:"open"`
	InviteLink string `json:"inviteLink,omitempty"`
	Headcount  int    `json:"headcount,omitempty"`
	Limit      int    `json:"limit,omitempty"`
}

func (h *Handlers) RoomStatus(w http.ResponseWriter, r *http.Request) {
	if h.roomSvc.IsOpen() && h.roomSvc.InviteLink() == "" {
		httputil.WriteError(w, http.StatusInternalServerError, "invite link is empty while room is open")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, statusResp{
		Open:       h.roomSvc.IsOpen(),
		InviteLink: h.roomSvc.InviteLink(),
		Headcount:  h.roomSvc.Headcount(),
		Limit:      h.roomSvc.Limit(),
	})
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

	limit := h.roomSvc.Limit()
	if h.roomSvc.Headcount() >= limit {
		httputil.WriteError(w, http.StatusForbidden, "room is full at the configured limit")
		return
	}

	http.SetCookie(w, &http.Cookie{Name: "room_access", Value: "1", Path: "/", MaxAge: 86400, SameSite: http.SameSiteLaxMode, HttpOnly: false, Secure: false})
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) RoomClose(w http.ResponseWriter, r *http.Request) {
	if !h.requireAdmin(r) {
		httputil.WriteError(w, http.StatusUnauthorized, "admin token required")
		return
	}
	if err := h.roomSvc.Close(); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to close room")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, statusResp{Open: h.roomSvc.IsOpen()})
}

func (h *Handlers) requireAdmin(r *http.Request) bool {
	if h.auth == nil {
		return false
	}
	// Dashboard sends Authorization: Bearer <JWT>. We parse, strip the prefix,
	// and let the auth service validate signature + expiry against the shared secret.
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		return false
	}
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		authHeader = strings.TrimSpace(authHeader[7:])
	}
	if authHeader == "" {
		return false
	}
	claims, err := h.auth.Validate(authHeader)
	if err != nil || claims == nil {
		return false
	}
	subject, err := claims.GetSubject()
	if err != nil {
		return false
	}
	return subject == "admin"
}

func (h *Handlers) RoomUpdatePeople(w http.ResponseWriter, r *http.Request) {
	// Accept JSON body: { "headcount": <int> }
	var req struct {
		Headcount int `json:"headcount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if err := h.roomSvc.UpdateHeadcount(req.Headcount); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to update headcount")
		return
	}

	// Return current headcount as confirmation
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"people": req.Headcount})
}
