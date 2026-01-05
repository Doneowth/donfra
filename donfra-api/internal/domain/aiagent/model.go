package aiagent

import "time"

// AIConversation represents a stored conversation between user and AI
type AIConversation struct {
	ID          int       `json:"id" gorm:"primaryKey"`
	UserID      int       `json:"user_id" gorm:"not null"`
	CodeContent string    `json:"code_content" gorm:"type:text;not null"`
	Question    string    `json:"question" gorm:"type:text"`
	Response    string    `json:"response" gorm:"type:text;not null"`
	Model       string    `json:"model" gorm:"size:50;not null"`
	CreatedAt   time.Time `json:"created_at" gorm:"not null;autoCreateTime"`
}

// TableName overrides the default table name
func (AIConversation) TableName() string {
	return "ai_conversations"
}

// AIRequest represents a request to analyze code
type AIRequest struct {
	CodeContent string `json:"code_content" binding:"required"`
	Question    string `json:"question"`
}

// AIResponse represents the AI's analysis response
type AIResponse struct {
	Response      string `json:"response"`
	Model         string `json:"model"`
	ConversationID int   `json:"conversation_id,omitempty"`
}

// DeepSeekRequest represents the request format for DeepSeek API
type DeepSeekRequest struct {
	Model       string            `json:"model"`
	Messages    []DeepSeekMessage `json:"messages"`
	Temperature float64           `json:"temperature"`
	MaxTokens   int               `json:"max_tokens,omitempty"`
	Stream      bool              `json:"stream,omitempty"`
}

// DeepSeekMessage represents a message in the DeepSeek conversation
type DeepSeekMessage struct {
	Role    string `json:"role"`    // "system", "user", or "assistant"
	Content string `json:"content"`
}

// DeepSeekResponse represents the response from DeepSeek API
type DeepSeekResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// DeepSeekStreamResponse represents a streaming chunk from DeepSeek API
type DeepSeekStreamResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index int `json:"index"`
		Delta struct {
			Role    string `json:"role,omitempty"`
			Content string `json:"content,omitempty"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason,omitempty"`
	} `json:"choices"`
}
