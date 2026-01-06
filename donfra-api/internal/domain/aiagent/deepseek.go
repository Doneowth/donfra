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

	// CodeAnalysisTemperature balances accuracy with natural responses (0.3-0.5 recommended for code)
	// See: https://api-docs.deepseek.com/quick_start/parameter_settings
	CodeAnalysisTemperature = 0.4

	// MaxTokensQuick for brief responses (code explanations, quick answers)
	MaxTokensQuick = 2000

	// MaxTokensDetailed for comprehensive analysis (streaming, detailed reviews)
	// DeepSeek recommends max 8192 for optimal quality
	// See: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-deepseek.html
	MaxTokensDetailed = 8192
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
		model:       DeepSeekModelCheap,
		temperature: CodeAnalysisTemperature,
	}
}

// AnalyzeCode sends code and optional question to DeepSeek for analysis
func (c *DeepSeekClient) AnalyzeCode(ctx context.Context, code, question string) (*DeepSeekResponse, error) {
	messages := []DeepSeekMessage{
		{
			Role:    "system",
			Content: "You are Donfra, an expert coding interview coach. Your goal is to help candidates improve their interview performance.\n\nWhen analyzing code:\n1. **Correctness**: Does it solve the problem? Any bugs or edge cases?\n2. **Time Complexity**: Big O analysis with clear explanation\n3. **Space Complexity**: Memory usage analysis\n4. **Code Quality**: Readability, naming, structure\n5. **Optimization**: Suggest better approaches if applicable\n6. **Interview Tips**: What would impress an interviewer?\n\nBe constructive but honest. Format responses in clean Markdown with code blocks and clear headings.",
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
		MaxTokens:   MaxTokensQuick, // Good balance for code analysis
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
			Content: "You are Donfra, an expert coding interview coach. When answering questions:\n\n**For code review questions**: Analyze correctness, complexity (time/space), edge cases, and optimization opportunities.\n\n**For concept questions**: Explain clearly with examples. Relate to interview scenarios when relevant.\n\n**For debugging help**: Guide the candidate to find the issue (like an interviewer would), don't just give the answer.\n\n**For optimization questions**: Suggest better approaches and explain trade-offs.\n\nKeep responses concise but thorough. Use Markdown formatting for readability.",
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
		MaxTokens:   MaxTokensQuick, // Good balance for conversational responses
	}

	return c.sendRequest(ctx, request)
}

// ChatStream handles conversational interaction with streaming response
func (c *DeepSeekClient) ChatStream(ctx context.Context, codeContent, question string, history []DeepSeekMessage) (*http.Response, error) {
	messages := []DeepSeekMessage{
		{
			Role:    "system",
			Content: "You are Donfra, an expert coding interview coach. When answering questions:\n\n**For code review questions**: Analyze correctness, complexity (time/space), edge cases, and optimization opportunities.\n\n**For concept questions**: Explain clearly with examples. Relate to interview scenarios when relevant.\n\n**For debugging help**: Guide the candidate to find the issue (like an interviewer would), don't just give the answer.\n\n**For optimization questions**: Suggest better approaches and explain trade-offs.\n\nFormat responses in clean Markdown with code blocks and clear headings.",
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
		MaxTokens:   MaxTokensDetailed, // Max 8192 recommended by DeepSeek for quality
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
