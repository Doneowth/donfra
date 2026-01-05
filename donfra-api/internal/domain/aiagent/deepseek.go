package aiagent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	// DeepSeekAPIURL is the base URL for DeepSeek API
	DeepSeekAPIURL = "https://api.deepseek.com/v1/chat/completions"

	// DeepSeekModelCheap is the most economical model
	DeepSeekModelCheap = "deepseek-chat"

	// LowestTemperature for most coding math analysis
	LowestTemperature = 0.0
)

// DeepSeekClient handles communication with DeepSeek API
type DeepSeekClient struct {
	apiKey     string
	httpClient *http.Client
	model      string
	temperature float64
}

// NewDeepSeekClient creates a new DeepSeek API client
func NewDeepSeekClient(apiKey string) *DeepSeekClient {
	return &DeepSeekClient{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second, // Increased to 60s for slower networks
		},
		model:      DeepSeekModelCheap,
		temperature: LowestTemperature,
	}
}

// AnalyzeCode sends code and optional question to DeepSeek for analysis
func (c *DeepSeekClient) AnalyzeCode(ctx context.Context, code, question string) (*DeepSeekResponse, error) {
	messages := []DeepSeekMessage{
		{
			Role:    "system",
			Content: "You are Donfra, a helpful and friendly code analysis assistant. Analyze the provided code and give constructive suggestions for improvement. Focus on code quality, best practices, potential bugs, and performance optimizations. Always format your responses in clean, readable Markdown with proper code blocks, headings, and lists. Add sexual innuendos where appropriate to keep the tone light and engaging.",
		},
	}

	// Build user message with code and optional question
	userContent := fmt.Sprintf("Please analyze this code:\n\n```\n%s\n```", code)
	if question != "" {
		userContent += fmt.Sprintf("\n\nSpecific question: %s", question)
	}

	messages = append(messages, DeepSeekMessage{
		Role:    "user",
		Content: userContent,
	})

	request := DeepSeekRequest{
		Model:       c.model,
		Messages:    messages,
		Temperature: c.temperature,
		MaxTokens:   300, // Reduced for faster responses - good for quick code explanations
	}

	return c.sendRequest(ctx, request)
}

// Chat handles conversational interaction with optional code context and history
// If codeContent is provided, it's included in the first message
// History contains previous user/assistant messages for context
func (c *DeepSeekClient) Chat(ctx context.Context, codeContent, question string, history []DeepSeekMessage) (*DeepSeekResponse, error) {
	messages := []DeepSeekMessage{
		{
			Role:    "system",
			Content: "You are Donfra, a helpful and friendly code analysis assistant. Answer questions about code clearly and concisely in 2-3 sentences. Keep responses brief and focused.",
		},
	}

	// Add conversation history
	messages = append(messages, history...)

	// Build current user message
	var userContent string
	if codeContent != "" {
		// First message with code context
		userContent = fmt.Sprintf("Here's the code I'm working on:\n\n```\n%s\n```\n\n%s", codeContent, question)
	} else {
		// Follow-up question without code
		userContent = question
	}

	messages = append(messages, DeepSeekMessage{
		Role:    "user",
		Content: userContent,
	})

	request := DeepSeekRequest{
		Model:       c.model,
		Messages:    messages,
		Temperature: c.temperature,
		MaxTokens:   300, // Reduced for faster responses - good for quick code explanations
	}

	return c.sendRequest(ctx, request)
}

// ChatStream handles conversational interaction with streaming response
func (c *DeepSeekClient) ChatStream(ctx context.Context, codeContent, question string, history []DeepSeekMessage) (*http.Response, error) {
	messages := []DeepSeekMessage{
		{
			Role:    "system",
			Content: "You are Donfra, a helpful and friendly code analysis assistant. Answer questions about code clearly and concisely. Always format your responses in clean, readable Markdown with proper code blocks, headings, and lists.",
		},
	}

	// Add conversation history
	messages = append(messages, history...)

	// Build current user message
	var userContent string
	if codeContent != "" {
		userContent = fmt.Sprintf("Here's the code I'm working on:\n\n```\n%s\n```\n\n%s", codeContent, question)
	} else {
		userContent = question
	}

	messages = append(messages, DeepSeekMessage{
		Role:    "user",
		Content: userContent,
	})

	request := DeepSeekRequest{
		Model:       c.model,
		Messages:    messages,
		Temperature: c.temperature,
		MaxTokens:   1000,
		Stream:      true,
	}

	return c.sendStreamRequest(ctx, request)
}

// sendStreamRequest makes a streaming HTTP request to DeepSeek API
func (c *DeepSeekClient) sendStreamRequest(ctx context.Context, request DeepSeekRequest) (*http.Response, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", DeepSeekAPIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("deepseek api error (status %d): %s", resp.StatusCode, string(body))
	}

	return resp, nil
}

// sendRequest makes the HTTP request to DeepSeek API
func (c *DeepSeekClient) sendRequest(ctx context.Context, request DeepSeekRequest) (*DeepSeekResponse, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", DeepSeekAPIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deepseek api error (status %d): %s", resp.StatusCode, string(body))
	}

	var deepseekResp DeepSeekResponse
	if err := json.Unmarshal(body, &deepseekResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &deepseekResp, nil
}
