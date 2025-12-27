package room

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// Service handles room business logic (validation, token generation, URL building).
// It delegates data persistence to Repository.
type Service struct {
	repo     Repository
	passcode string
	baseURL  string
}

// NewService creates a new room service with the given repository and configuration.
func NewService(repo Repository, passcode, baseURL string) *Service {
	return &Service{
		repo:     repo,
		passcode: passcode,
		baseURL:  baseURL,
	}
}

// Init opens the room with the given passcode and size limit.
// Returns the invite URL and token on success.
func (s *Service) Init(ctx context.Context, pass string, size int) (inviteURL string, token string, err error) {
	// Validate passcode
	if strings.TrimSpace(pass) != s.passcode {
		return "", "", errors.New("invalid passcode")
	}

	// Check if room is already open
	state, err := s.repo.GetState(ctx)
	if err != nil {
		return "", "", fmt.Errorf("failed to get room state: %w", err)
	}

	if state.Open {
		return "", "", errors.New("room already open")
	}

	// Set default limit
	limit := size
	if limit <= 0 {
		limit = 2
	}

	// Generate unique room ID
	roomID := uuid.New().String()

	// Generate cryptographically secure invite token
	token, err = s.generateToken()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate token: %w", err)
	}

	// Create new state
	newState := &RoomState{
		Open:        true,
		RoomID:      roomID,
		InviteToken: token,
		Headcount:   0,
		Limit:       limit,
	}

	// Persist state
	if err := s.repo.SaveState(ctx, newState); err != nil {
		return "", "", fmt.Errorf("failed to save room state: %w", err)
	}

	// Build invite URL
	inviteURL = s.buildInviteURL(roomID, token)

	return inviteURL, token, nil
}

// IsOpen checks if the room is currently open.
func (s *Service) IsOpen(ctx context.Context) bool {
	state, err := s.repo.GetState(ctx)
	if err != nil {
		return false
	}
	return state.Open
}

// GetStatus returns the current room status.
func (s *Service) GetStatus(ctx context.Context) (*RoomState, error) {
	return s.repo.GetState(ctx)
}

// InviteLink returns the full invite URL if room is open, empty string otherwise.
func (s *Service) InviteLink(ctx context.Context) string {
	state, err := s.repo.GetState(ctx)
	if err != nil || !state.Open {
		return ""
	}
	return s.buildInviteURL(state.RoomID, state.InviteToken)
}

// Validate checks if the given token matches the room's invite token and room is open.
func (s *Service) Validate(ctx context.Context, token string) bool {
	state, err := s.repo.GetState(ctx)
	if err != nil {
		return false
	}

	return state.Open && strings.TrimSpace(token) == state.InviteToken
}

// Close closes the room and clears all state.
func (s *Service) Close(ctx context.Context) error {
	return s.repo.Clear(ctx)
}

// UpdateHeadcount updates the current number of participants in the room.
func (s *Service) UpdateHeadcount(ctx context.Context, count int) error {
	state, err := s.repo.GetState(ctx)
	if err != nil {
		return fmt.Errorf("failed to get room state: %w", err)
	}

	state.Headcount = count

	if err := s.repo.SaveState(ctx, state); err != nil {
		return fmt.Errorf("failed to update headcount: %w", err)
	}

	return nil
}

// Headcount returns the current number of participants.
func (s *Service) Headcount(ctx context.Context) int {
	state, err := s.repo.GetState(ctx)
	if err != nil {
		return 0
	}
	return state.Headcount
}

// Limit returns the maximum number of participants allowed.
func (s *Service) Limit(ctx context.Context) int {
	state, err := s.repo.GetState(ctx)
	if err != nil {
		return 0
	}
	return state.Limit
}

// generateToken generates a cryptographically secure random token.
func (s *Service) generateToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// buildInviteURL constructs the full invite URL with room_id, token and role.
func (s *Service) buildInviteURL(roomID, token string) string {
	baseURL := strings.TrimRight(s.baseURL, "/")
	return fmt.Sprintf("%s/coding?room_id=%s&invite=%s&role=agent", baseURL, roomID, token)
}
