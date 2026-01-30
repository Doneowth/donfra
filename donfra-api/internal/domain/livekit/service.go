package livekit

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
)

// Service handles LiveKit live streaming business logic
type Service struct {
	apiKey           string
	apiSecret        string
	serverURL        string
	tokenExpiryHours int
}

// NewService creates a new LiveKit service
func NewService(apiKey, apiSecret, serverURL string, tokenExpiryHours int) *Service {
	if tokenExpiryHours <= 0 {
		tokenExpiryHours = 24 // Default: 24 hours
	}
	return &Service{
		apiKey:           apiKey,
		apiSecret:        apiSecret,
		serverURL:        serverURL,
		tokenExpiryHours: tokenExpiryHours,
	}
}

// CreateSession creates a new live streaming session
func (s *Service) CreateSession(ctx context.Context, title string, ownerName string) (*CreateSessionResponse, error) {
	// Generate unique session ID
	sessionID := uuid.New().String()

	// Generate host access token (host is not hidden by default, but has stealth capability)
	hostToken, err := s.generateAccessToken(sessionID, ownerName, "host", false, true)
	if err != nil {
		return nil, fmt.Errorf("failed to generate host token: %w", err)
	}

	return &CreateSessionResponse{
		SessionID:  sessionID,
		ServerURL:  s.serverURL,
		HostToken:  hostToken,
		CreatedAt:  time.Now(),
		Message:    "Live session created successfully",
	}, nil
}

// JoinSession allows a user to join an existing session
func (s *Service) JoinSession(ctx context.Context, sessionID, userName string, isHost, isHidden, canStealth bool) (*JoinSessionResponse, error) {
	role := "viewer"
	if isHost {
		role = "host"
	}

	accessToken, err := s.generateAccessToken(sessionID, userName, role, isHidden, canStealth)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Hidden users cannot publish video/audio (stealth observers)
	canPublish := !isHidden

	return &JoinSessionResponse{
		SessionID:    sessionID,
		AccessToken:  accessToken,
		ServerURL:    s.serverURL,
		Role:         role,
		CanPublish:   canPublish,
		CanSubscribe: true,    // Everyone can subscribe (watch)
		Message:      "Joined session successfully",
	}, nil
}

// EndSession ends a live streaming session
func (s *Service) EndSession(ctx context.Context, sessionID string) (*EndSessionResponse, error) {
	// For MVP, we just return success - LiveKit will handle room cleanup automatically
	// In production, you might want to:
	// 1. Call LiveKit API to delete the room
	// 2. Update database to mark session as ended
	// 3. Notify all participants via webhook

	return &EndSessionResponse{
		SessionID: sessionID,
		EndedAt:   time.Now(),
		Message:   "Live session ended successfully",
	}, nil
}

// generateAccessToken generates a LiveKit access token with permissions
func (s *Service) generateAccessToken(sessionID, userName, role string, isHidden, canStealth bool) (string, error) {
	at := auth.NewAccessToken(s.apiKey, s.apiSecret)

	// Hidden users cannot publish video/audio (stealth observers)
	canPublish := !isHidden
	canSubscribe := true
	canPublishData := true // Allow chat/data

	grant := &auth.VideoGrant{
		RoomJoin:       true,
		Room:           sessionID,
		CanPublish:     &canPublish,
		CanSubscribe:   &canSubscribe,
		CanPublishData: &canPublishData,
		// Note: NOT using grant.Hidden because we need admins to see hidden participants
		// Hidden status is handled via metadata + frontend filtering
	}

	// Host gets admin privileges
	if role == "host" {
		grant.RoomAdmin = true
	}

	// Admins with stealth capability can update their own metadata (to toggle hidden status)
	if canStealth {
		grant.SetCanUpdateOwnMetadata(true)
	}

	// Set metadata with stealth info (JSON format)
	metadata := fmt.Sprintf(`{"isHidden":%t,"canStealth":%t}`, isHidden, canStealth)

	at.SetVideoGrant(grant).
		SetIdentity(userName).
		SetName(userName).
		SetMetadata(metadata).
		SetValidFor(time.Duration(s.tokenExpiryHours) * time.Hour)

	return at.ToJWT()
}
