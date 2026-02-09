package handlers

import (
	"encoding/json"
	"net/http"

	"donfra-api/internal/domain/runner"
	"donfra-api/internal/pkg/httputil"
)

func (h *Handlers) ExecuteCode(w http.ResponseWriter, r *http.Request) {
	var req runner.ExecuteRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.SourceCode == "" {
		httputil.WriteError(w, http.StatusBadRequest, "source_code is required")
		return
	}

	if req.LanguageID == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "language_id is required")
		return
	}

	if req.TimeoutMs == 0 {
		req.TimeoutMs = 5000
	}

	result, err := h.runnerClient.Execute(r.Context(), req)
	if err != nil {
		httputil.WriteError(w, http.StatusBadGateway, "Code execution service unavailable")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}
