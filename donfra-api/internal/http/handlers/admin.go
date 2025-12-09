package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"donfra-api/internal/domain/auth"
	"donfra-api/internal/pkg/httputil"
)

func (h *Handlers) AdminLogin(w http.ResponseWriter, r *http.Request) {
	if h.auth == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "auth service unavailable")
		return
	}
	var req auth.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	token, err := h.auth.IssueAdminToken(strings.TrimSpace(req.Password))
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, auth.TokenResponse{Token: token})
}
