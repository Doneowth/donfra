package interview

import (
	"context"

	"gorm.io/gorm"
)

// Repository defines the interface for interview room data access
type Repository interface {
	Create(ctx context.Context, room *InterviewRoom) error
	GetByRoomID(ctx context.Context, roomID string) (*InterviewRoom, error)
	GetActiveByOwnerID(ctx context.Context, ownerID uint) (*InterviewRoom, error)
	GetAllActiveByOwnerID(ctx context.Context, ownerID uint) ([]*InterviewRoom, error)
	GetAllActive(ctx context.Context) ([]*InterviewRoom, error)
	Update(ctx context.Context, room *InterviewRoom) error
	SoftDelete(ctx context.Context, roomID string) error
	UpdateHeadcount(ctx context.Context, roomID string, headcount int) error
	UpdateCodeSnapshot(ctx context.Context, roomID string, code string) error
}

// repository implements Repository interface using GORM
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new interview room repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create creates a new interview room
func (r *repository) Create(ctx context.Context, room *InterviewRoom) error {
	return r.db.WithContext(ctx).Create(room).Error
}

// GetByRoomID retrieves a room by room_id (excludes soft-deleted)
func (r *repository) GetByRoomID(ctx context.Context, roomID string) (*InterviewRoom, error) {
	var room InterviewRoom
	err := r.db.WithContext(ctx).
		Where("room_id = ?", roomID).
		First(&room).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// GetActiveByOwnerID retrieves the active (non-deleted) room owned by a user
func (r *repository) GetActiveByOwnerID(ctx context.Context, ownerID uint) (*InterviewRoom, error) {
	var room InterviewRoom
	err := r.db.WithContext(ctx).
		Where("owner_id = ?", ownerID).
		Order("created_at DESC").
		First(&room).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// GetAllActiveByOwnerID retrieves all active (non-deleted) rooms owned by a user
func (r *repository) GetAllActiveByOwnerID(ctx context.Context, ownerID uint) ([]*InterviewRoom, error) {
	var rooms []*InterviewRoom
	err := r.db.WithContext(ctx).
		Where("owner_id = ?", ownerID).
		Order("created_at DESC").
		Find(&rooms).Error
	if err != nil {
		return nil, err
	}
	return rooms, nil
}

// GetAllActive retrieves all active (non-deleted) rooms
func (r *repository) GetAllActive(ctx context.Context) ([]*InterviewRoom, error) {
	var rooms []*InterviewRoom
	err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Find(&rooms).Error
	if err != nil {
		return nil, err
	}
	return rooms, nil
}

// Update updates an existing interview room
func (r *repository) Update(ctx context.Context, room *InterviewRoom) error {
	return r.db.WithContext(ctx).Save(room).Error
}

// SoftDelete soft-deletes a room by room_id
func (r *repository) SoftDelete(ctx context.Context, roomID string) error {
	return r.db.WithContext(ctx).
		Where("room_id = ?", roomID).
		Delete(&InterviewRoom{}).Error
}

// UpdateHeadcount updates the headcount for a room
func (r *repository) UpdateHeadcount(ctx context.Context, roomID string, headcount int) error {
	return r.db.WithContext(ctx).
		Model(&InterviewRoom{}).
		Where("room_id = ?", roomID).
		Update("headcount", headcount).Error
}

// UpdateCodeSnapshot updates the code snapshot for a room
func (r *repository) UpdateCodeSnapshot(ctx context.Context, roomID string, code string) error {
	return r.db.WithContext(ctx).
		Model(&InterviewRoom{}).
		Where("room_id = ?", roomID).
		Update("code_snapshot", code).Error
}
