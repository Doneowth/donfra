package aiagent

import (
	"context"
	"fmt"
	"net/http"
)

// Service provides AI code analysis functionality
type Service struct {
	repo   Repository
	client *DeepSeekClient
}

// NewService creates a new AI agent service
func NewService(repo Repository, apiKey string) *Service {
	return &Service{
		repo:   repo,
		client: NewDeepSeekClient(apiKey),
	}
}

// AnalyzeCode analyzes code and optionally answers a specific question
func (s *Service) AnalyzeCode(ctx context.Context, userID int, codeContent, question string) (*AIResponse, error) {
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

	// Store conversation in database
	conversation := &AIConversation{
		UserID:      userID,
		CodeContent: codeContent,
		Question:    question,
		Response:    responseContent,
		Model:       deepseekResp.Model,
	}

	if err := s.repo.Create(ctx, conversation); err != nil {
		// Log error but don't fail the request
		fmt.Printf("Warning: failed to store AI conversation: %v\n", err)
	}

	return &AIResponse{
		Response:      responseContent,
		Model:         deepseekResp.Model,
		ConversationID: conversation.ID,
	}, nil
}

// Chat handles conversational AI interaction with optional code context
// Only sends code on first message, subsequent messages use conversation history
func (s *Service) Chat(ctx context.Context, userID int, codeContent, question string, history []DeepSeekMessage) (*AIResponse, error) {
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

	// Only store if code was provided (initial analysis)
	if codeContent != "" {
		conversation := &AIConversation{
			UserID:      userID,
			CodeContent: codeContent,
			Question:    question,
			Response:    responseContent,
			Model:       deepseekResp.Model,
		}

		if err := s.repo.Create(ctx, conversation); err != nil {
			// Log error but don't fail the request
			fmt.Printf("Warning: failed to store AI conversation: %v\n", err)
		}
	}

	return &AIResponse{
		Response: responseContent,
		Model:    deepseekResp.Model,
	}, nil
}

// GetConversationHistory retrieves recent conversations for a user
func (s *Service) GetConversationHistory(ctx context.Context, userID int, limit int) ([]*AIConversation, error) {
	if limit <= 0 {
		limit = 10 // Default limit
	}
	if limit > 50 {
		limit = 50 // Maximum limit
	}

	conversations, err := s.repo.FindByUserID(ctx, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation history: %w", err)
	}

	return conversations, nil
}

// ChatStream handles streaming conversational AI interaction
func (s *Service) ChatStream(ctx context.Context, codeContent, question string, history []DeepSeekMessage) (*http.Response, error) {
	if question == "" {
		return nil, fmt.Errorf("question is required")
	}

	// Call DeepSeek API with streaming
	return s.client.ChatStream(ctx, codeContent, question, history)
}
