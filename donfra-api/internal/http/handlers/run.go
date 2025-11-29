package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"donfra-api/internal/domain/run"
	"donfra-api/internal/pkg/httputil"
)

type runReq struct {
	Code string `json:"code"`
}
type runResp struct {
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
}

func (h *Handlers) RunCode(w http.ResponseWriter, r *http.Request) {
	if !h.roomSvc.IsOpen() {
		httputil.WriteError(w, http.StatusForbidden, "room is not open")
		return
	}
	var req runReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Code == "" {
		httputil.WriteError(w, http.StatusBadRequest, "code cannot be empty")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	stdout, stderr, err := run.RunPython(ctx, req.Code)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			httputil.WriteJSON(w, http.StatusOK, runResp{Stdout: stdout, Stderr: "Execution timed out"})
			return
		}
		httputil.WriteJSON(w, http.StatusOK, runResp{Stdout: stdout, Stderr: stderr})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, runResp{Stdout: stdout, Stderr: stderr})
}
