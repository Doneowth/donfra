package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"donfra-api/internal/domain/aiagent"
	"donfra-api/internal/pkg/httputil"
	"donfra-api/internal/pkg/metrics"
)

// AnalyzeCodeRequest represents the request body for code analysis
type AnalyzeCodeRequest struct {
	CodeContent string `json:"code_content"`
	Question    string `json:"question"`
}

// ChatRequest represents the request body for chat
type ChatRequest struct {
	CodeContent string `json:"code_content"` // Optional: only sent on first message
	Question    string `json:"question"`
	History     []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"history"`
}

// AIChat handles POST /api/ai/chat
// Requires authentication and VIP/admin access (enforced by middleware)
func (h *Handlers) AIChat(w http.ResponseWriter, r *http.Request) {
	// Parse request
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.Question == "" {
		httputil.WriteError(w, http.StatusBadRequest, "question is required")
		return
	}

	// Convert history to DeepSeekMessage format
	history := make([]aiagent.DeepSeekMessage, len(req.History))
	for i, msg := range req.History {
		history[i] = aiagent.DeepSeekMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	// Call AI service with conversation history
	resp, err := h.aiAgentSvc.Chat(r.Context(), req.CodeContent, req.Question, history)
	if err != nil {
		metrics.RecordAIRequest("chat", false)
		httputil.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("AI chat failed: %v", err))
		return
	}

	metrics.RecordAIRequest("chat", true)
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// AIChatStream handles POST /api/ai/chat/stream
// Requires authentication and VIP/admin access (enforced by middleware)
// Returns Server-Sent Events (SSE) stream
func (h *Handlers) AIChatStream(w http.ResponseWriter, r *http.Request) {
	// Parse request
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.Question == "" {
		httputil.WriteError(w, http.StatusBadRequest, "question is required")
		return
	}

	// Convert history to DeepSeekMessage format
	history := make([]aiagent.DeepSeekMessage, len(req.History))
	for i, msg := range req.History {
		history[i] = aiagent.DeepSeekMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	// Call AI service with streaming
	resp, err := h.aiAgentSvc.ChatStream(r.Context(), req.CodeContent, req.Question, history)
	if err != nil {
		metrics.RecordAIRequest("chat_stream", false)
		httputil.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("AI chat stream failed: %v", err))
		return
	}
	metrics.RecordAIRequest("chat_stream", true)
	defer resp.Body.Close()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Create a flusher
	flusher, ok := w.(http.Flusher)
	if !ok {
		httputil.WriteError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	// Stream the response
	scanner := bufio.NewScanner(resp.Body)
	var fullResponse string
	fmt.Printf("[DEBUG] Starting to stream response\n")
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Printf("[DEBUG] Received line: %q\n", line)
		if line == "" {
			continue
		}

		// SSE format: data: <json>
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")

			// Check for [DONE] message
			if data == "[DONE]" {
				fmt.Printf("[DEBUG] Stream completed, total length: %d\n", len(fullResponse))
				// TODO: Store fullResponse in database if needed
				// For now, streaming conversations are ephemeral
				break
			}

			// Parse the chunk
			var chunk aiagent.DeepSeekStreamResponse
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				fmt.Printf("[DEBUG] Failed to parse chunk: %v\n", err)
				continue
			}

			// Extract content from delta
			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				content := chunk.Choices[0].Delta.Content
				fullResponse += content
				fmt.Printf("[DEBUG] Sending chunk: %q\n", content)

				// Send to client in SSE format with content only
				// Frontend expects: "data: <content>\n\n"
				fmt.Fprintf(w, "data: %s\n\n", content)
				flusher.Flush()
			}
		}
	}
	fmt.Printf("[DEBUG] Scanner done\n")

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
	}
}

// AIAnalyzeCode handles POST /api/ai/analyze
// Requires authentication and VIP/admin access (enforced by middleware)
func (h *Handlers) AIAnalyzeCode(w http.ResponseWriter, r *http.Request) {
	// Parse request
	var req AnalyzeCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.CodeContent == "" {
		httputil.WriteError(w, http.StatusBadRequest, "code_content is required")
		return
	}

	// Call AI service
	resp, err := h.aiAgentSvc.AnalyzeCode(r.Context(), req.CodeContent, req.Question)
	if err != nil {
		metrics.RecordAIRequest("analyze", false)
		httputil.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("AI analysis failed: %v", err))
		return
	}

	metrics.RecordAIRequest("analyze", true)
	httputil.WriteJSON(w, http.StatusOK, resp)
}
