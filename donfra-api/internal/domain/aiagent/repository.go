package aiagent

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// Repository defines the interface for AI conversation storage
type Repository interface {
	Create(ctx context.Context, conversation *AIConversation) error
	FindByUserID(ctx context.Context, userID int, limit int) ([]*AIConversation, error)
	FindByID(ctx context.Context, id int) (*AIConversation, error)
}

// PostgresRepository implements Repository using PostgreSQL
type PostgresRepository struct {
	db *gorm.DB
}

// NewPostgresRepository creates a new PostgreSQL-based repository
func NewPostgresRepository(db *gorm.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// Create stores a new AI conversation
func (r *PostgresRepository) Create(ctx context.Context, conversation *AIConversation) error {
	if err := r.db.WithContext(ctx).Create(conversation).Error; err != nil {
		return fmt.Errorf("failed to create ai conversation: %w", err)
	}
	return nil
}

// FindByUserID retrieves recent conversations for a user
func (r *PostgresRepository) FindByUserID(ctx context.Context, userID int, limit int) ([]*AIConversation, error) {
	var conversations []*AIConversation
	query := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	if err := query.Find(&conversations).Error; err != nil {
		return nil, fmt.Errorf("failed to find conversations: %w", err)
	}

	return conversations, nil
}

// FindByID retrieves a specific conversation by ID
func (r *PostgresRepository) FindByID(ctx context.Context, id int) (*AIConversation, error) {
	var conversation AIConversation
	if err := r.db.WithContext(ctx).First(&conversation, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find conversation: %w", err)
	}
	return &conversation, nil
}
