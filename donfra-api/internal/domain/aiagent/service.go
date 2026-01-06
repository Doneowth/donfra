package aiagent

import (
	"context"
	"fmt"
	"net/http"
)

// Service provides AI code analysis functionality
type Service struct {
	client *DeepSeekClient
}

// NewService creates a new AI agent service
func NewService(apiKey string) *Service {
	return &Service{
		client: NewDeepSeekClient(apiKey),
	}
}

// AnalyzeCode analyzes code and optionally answers a specific question
func (s *Service) AnalyzeCode(ctx context.Context, codeContent, question string) (*AIResponse, error) {
	if codeContent == "" {
		return nil, fmt.Errorf("code content is required")
	}

	// Call DeepSeek API
	deepseekResp, err := s.client.AnalyzeCode(ctx, codeContent, question)
	if err != nil {
		return nil, fmt.Errorf("failed to get AI response: %w", err)
	}

	// Extract response content
	if len(deepseekResp.Choices) == 0 {
		return nil, fmt.Errorf("no response from AI")
	}

	responseContent := deepseekResp.Choices[0].Message.Content

	return &AIResponse{
		Response: responseContent,
		Model:    deepseekResp.Model,
	}, nil
}

// Chat handles conversational AI interaction with optional code context
// Only sends code on first message, subsequent messages use conversation history
func (s *Service) Chat(ctx context.Context, codeContent, question string, history []DeepSeekMessage) (*AIResponse, error) {
	if question == "" {
		return nil, fmt.Errorf("question is required")
	}

	// Call DeepSeek API with conversation history
	deepseekResp, err := s.client.Chat(ctx, codeContent, question, history)
	if err != nil {
		return nil, fmt.Errorf("failed to get AI response: %w", err)
	}

	// Extract response content
	if len(deepseekResp.Choices) == 0 {
		return nil, fmt.Errorf("no response from AI")
	}

	responseContent := deepseekResp.Choices[0].Message.Content

	return &AIResponse{
		Response: responseContent,
		Model:    deepseekResp.Model,
	}, nil
}

// ChatStream handles streaming conversational AI interaction
func (s *Service) ChatStream(ctx context.Context, codeContent, question string, history []DeepSeekMessage) (*http.Response, error) {
	if question == "" {
		return nil, fmt.Errorf("question is required")
	}

	// Call DeepSeek API with streaming
	return s.client.ChatStream(ctx, codeContent, question, history)
}
