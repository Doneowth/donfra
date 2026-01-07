package user

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// PostgresRepository implements the Repository interface using PostgreSQL via GORM.
type PostgresRepository struct {
	db *gorm.DB
}

// NewPostgresRepository creates a new PostgreSQL-backed user repository.
func NewPostgresRepository(db *gorm.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// Create creates a new user in the database.
func (r *PostgresRepository) Create(ctx context.Context, user *User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// FindByEmail retrieves a user by email address.
func (r *PostgresRepository) FindByEmail(ctx context.Context, email string) (*User, error) {
	var user User
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Return nil instead of error for "not found"
		}
		return nil, err
	}
	return &user, nil
}

// FindByID retrieves a user by their ID.
func (r *PostgresRepository) FindByID(ctx context.Context, id uint) (*User, error) {
	var user User
	err := r.db.WithContext(ctx).First(&user, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// FindByGoogleID retrieves a user by their Google ID.
func (r *PostgresRepository) FindByGoogleID(ctx context.Context, googleID string) (*User, error) {
	var user User
	err := r.db.WithContext(ctx).Where("google_id = ?", googleID).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Return nil instead of error for "not found"
		}
		return nil, err
	}
	return &user, nil
}

// Update updates an existing user.
func (r *PostgresRepository) Update(ctx context.Context, user *User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// UpdateFields updates specific fields of a user by ID.
func (r *PostgresRepository) UpdateFields(ctx context.Context, id uint, fields map[string]interface{}) error {
	result := r.db.WithContext(ctx).Model(&User{}).Where("id = ?", id).Updates(fields)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// Delete soft-deletes a user by ID.
func (r *PostgresRepository) Delete(ctx context.Context, id uint) error {
	result := r.db.WithContext(ctx).Delete(&User{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ExistsByEmail checks if a user with the given email exists.
func (r *PostgresRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&User{}).Where("email = ?", email).Count(&count).Error
	return count > 0, err
}

// ListAll retrieves all users (for admin purposes).
func (r *PostgresRepository) ListAll(ctx context.Context) ([]*User, error) {
	var users []*User
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&users).Error
	return users, err
}
