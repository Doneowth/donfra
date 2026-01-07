package interview

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrRoomNotFound      = errors.New("room not found")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrInvalidToken      = errors.New("invalid invite token")
	ErrAdminRequired     = errors.New("admin or god user required to create rooms")
	ErrRoomAlreadyExists = errors.New("user already has an active room")
)

// Service defines the interface for interview room business logic
type Service interface {
	InitRoom(ctx context.Context, userID uint) (*InitRoomResponse, error)
	JoinRoom(ctx context.Context, inviteToken string) (*JoinRoomResponse, error)
	CloseRoom(ctx context.Context, roomID string, userID uint) error
	GetRoomByID(ctx context.Context, roomID string) (*InterviewRoom, error)
	GetRoomStatus(ctx context.Context, roomID string) (*RoomStatusResponse, error)
	GetAllRooms(ctx context.Context) ([]*InterviewRoom, error)
	UpdateHeadcount(ctx context.Context, roomID string, headcount int) error
	GetActiveRoomsByOwner(ctx context.Context, ownerID uint) ([]*InterviewRoom, error)
}

// service implements Service interface
type service struct {
	repo      Repository
	jwtSecret []byte
	baseURL   string
}

// NewService creates a new interview room service
func NewService(repo Repository, jwtSecret, baseURL string) Service {
	return &service{
		repo:      repo,
		jwtSecret: []byte(jwtSecret),
		baseURL:   baseURL,
	}
}

// InitRoom creates a new interview room
// Authorization is enforced by middleware (RequireAdminOrAbove)
func (s *service) InitRoom(ctx context.Context, userID uint) (*InitRoomResponse, error) {
	// Check if user already has an active room
	existingRoom, err := s.repo.GetActiveByOwnerID(ctx, userID)
	if err == nil && existingRoom != nil {
		return nil, ErrRoomAlreadyExists
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check existing room: %w", err)
	}

	// Generate unique room ID
	roomID, err := generateRoomID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate room ID: %w", err)
	}

	// Generate invite token (JWT) containing room_id
	token, err := s.generateInviteToken(roomID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate invite token: %w", err)
	}

	// Construct invite link
	inviteLink := fmt.Sprintf("%s/interview?token=%s", s.baseURL, token)

	// Create room in database
	room := &InterviewRoom{
		RoomID:       roomID,
		OwnerID:      userID,
		Headcount:    3, // default headcount 3, one for interviewer and two for candidates
		CodeSnapshot: "",
		InviteLink:   inviteLink,
	}

	if err := s.repo.Create(ctx, room); err != nil {
		return nil, fmt.Errorf("failed to create room: %w", err)
	}

	return &InitRoomResponse{
		RoomID:     roomID,
		InviteLink: inviteLink,
		Message:    "Interview room created successfully",
	}, nil
}

// JoinRoom validates invite token and allows user to join the room
func (s *service) JoinRoom(ctx context.Context, inviteToken string) (*JoinRoomResponse, error) {
	// Validate invite token and extract room_id
	roomID, err := s.validateInviteToken(inviteToken)
	if err != nil {
		return nil, err
	}

	// Verify room exists and is active
	room, err := s.repo.GetByRoomID(ctx, roomID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRoomNotFound
		}
		return nil, fmt.Errorf("failed to get room: %w", err)
	}

	return &JoinRoomResponse{
		RoomID:  room.RoomID,
		Message: "Successfully joined interview room",
	}, nil
}

// CloseRoom soft-deletes a room (only owner can close)
func (s *service) CloseRoom(ctx context.Context, roomID string, userID uint) error {
	// Get room to verify ownership
	room, err := s.repo.GetByRoomID(ctx, roomID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRoomNotFound
		}
		return fmt.Errorf("failed to get room: %w", err)
	}

	// Verify user is the owner
	if room.OwnerID != userID {
		return ErrUnauthorized
	}

	// Soft delete the room
	if err := s.repo.SoftDelete(ctx, roomID); err != nil {
		return fmt.Errorf("failed to close room: %w", err)
	}

	return nil
}

// GetRoomByID retrieves a room by room_id
func (s *service) GetRoomByID(ctx context.Context, roomID string) (*InterviewRoom, error) {
	room, err := s.repo.GetByRoomID(ctx, roomID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRoomNotFound
		}
		return nil, fmt.Errorf("failed to get room: %w", err)
	}
	return room, nil
}

// GetRoomStatus retrieves the status of a specific room
func (s *service) GetRoomStatus(ctx context.Context, roomID string) (*RoomStatusResponse, error) {
	room, err := s.repo.GetByRoomID(ctx, roomID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRoomNotFound
		}
		return nil, fmt.Errorf("failed to get room: %w", err)
	}

	return &RoomStatusResponse{
		RoomID:     room.RoomID,
		OwnerID:    room.OwnerID,
		Headcount:  room.Headcount,
		InviteLink: room.InviteLink,
		CreatedAt:  room.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  room.UpdatedAt.Format(time.RFC3339),
	}, nil
}

// GetAllRooms retrieves all active (non-deleted) rooms
func (s *service) GetAllRooms(ctx context.Context) ([]*InterviewRoom, error) {
	rooms, err := s.repo.GetAllActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get all rooms: %w", err)
	}
	return rooms, nil
}

// UpdateHeadcount updates the participant count for a room
func (s *service) UpdateHeadcount(ctx context.Context, roomID string, headcount int) error {
	return s.repo.UpdateHeadcount(ctx, roomID, headcount)
}

// GetActiveRoomsByOwner retrieves all active rooms owned by a user
func (s *service) GetActiveRoomsByOwner(ctx context.Context, ownerID uint) ([]*InterviewRoom, error) {
	rooms, err := s.repo.GetAllActiveByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get active rooms: %w", err)
	}
	return rooms, nil
}

// generateRoomID generates a random room ID using UUID v4
func generateRoomID() (string, error) {
	id := uuid.New()
	return id.String(), nil
}

// InviteTokenClaims represents the JWT claims for interview room invite tokens
type InviteTokenClaims struct {
	RoomID string `json:"room_id"`
	jwt.RegisteredClaims
}

// generateInviteToken creates a JWT token for room invitation
func (s *service) generateInviteToken(roomID string) (string, error) {
	claims := InviteTokenClaims{
		RoomID: roomID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "interview_room",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			Issuer:    "donfra-api",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// validateInviteToken validates the invite token and returns the room_id
func (s *service) validateInviteToken(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenString, &InviteTokenClaims{}, func(t *jwt.Token) (interface{}, error) {
		return s.jwtSecret, nil
	})
	if err != nil {
		return "", ErrInvalidToken
	}

	claims, ok := token.Claims.(*InviteTokenClaims)
	if !ok || !token.Valid {
		return "", ErrInvalidToken
	}

	if claims.Subject != "interview_room" {
		return "", ErrInvalidToken
	}

	if claims.RoomID == "" {
		return "", ErrInvalidToken
	}

	return claims.RoomID, nil
}
