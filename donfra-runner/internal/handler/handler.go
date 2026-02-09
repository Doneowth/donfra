package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"donfra-runner/internal/runner"
)

type Handler struct {
	runner  *runner.Runner
	limiter *runner.Limiter
	version string
}

func New(r *runner.Runner, l *runner.Limiter, version string) *Handler {
	return &Handler{runner: r, limiter: l, version: version}
}

func (h *Handler) Execute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req runner.ExecuteRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SourceCode == "" {
		writeError(w, http.StatusBadRequest, "source_code is required")
		return
	}

	if req.LanguageID == 0 {
		writeError(w, http.StatusBadRequest, "language_id is required")
		return
	}

	if _, err := runner.GetLanguage(req.LanguageID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	result := h.runner.Execute(r.Context(), req)

	log.Printf("execute lang=%d status=%d duration=%dms stdout_len=%d stderr_len=%d",
		req.LanguageID, result.Status.ID, result.ExecutionTimeMs,
		len(result.Stdout), len(result.Stderr))

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"languages": runner.SupportedLanguageIDs(),
		"version":   h.version,
		"slots": map[string]int{
			"max":    h.limiter.Max(),
			"in_use": h.limiter.InUse(),
			"queued": h.limiter.Queued(),
		},
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
