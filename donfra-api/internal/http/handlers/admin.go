package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"donfra-api/internal/pkg/httputil"
)

type adminLoginReq struct {
	Password string `json:"password"`
}

type adminLoginResp struct {
	Token string `json:"token"`
}

func (h *Handlers) AdminLogin(w http.ResponseWriter, r *http.Request) {
	if h.auth == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "auth service unavailable")
		return
	}
	var req adminLoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	token, err := h.auth.IssueAdminToken(strings.TrimSpace(req.Password))
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, adminLoginResp{Token: token})
}
