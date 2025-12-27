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
	apiKey    string
	apiSecret string
	serverURL string
}

// NewService creates a new LiveKit service
func NewService(apiKey, apiSecret, serverURL string) *Service {
	return &Service{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		serverURL: serverURL,
	}
}

// CreateSession creates a new live streaming session
func (s *Service) CreateSession(ctx context.Context, title string, ownerName string) (*CreateSessionResponse, error) {
	// Generate unique session ID
	sessionID := uuid.New().String()

	// Generate host access token
	hostToken, err := s.generateAccessToken(sessionID, ownerName, "host")
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
func (s *Service) JoinSession(ctx context.Context, sessionID, userName string, isHost bool) (*JoinSessionResponse, error) {
	role := "viewer"
	if isHost {
		role = "host"
	}

	accessToken, err := s.generateAccessToken(sessionID, userName, role)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	return &JoinSessionResponse{
		SessionID:    sessionID,
		AccessToken:  accessToken,
		ServerURL:    s.serverURL,
		Role:         role,
		CanPublish:   isHost,  // Host can publish audio/video/screen
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
func (s *Service) generateAccessToken(sessionID, userName, role string) (string, error) {
	at := auth.NewAccessToken(s.apiKey, s.apiSecret)

	// Set permissions based on role
	canPublish := role == "host"
	canSubscribe := true
	canPublishData := true  // Allow chat/data

	grant := &auth.VideoGrant{
		RoomJoin:       true,
		Room:           sessionID,
		CanPublish:     &canPublish,
		CanSubscribe:   &canSubscribe,
		CanPublishData: &canPublishData,
	}

	// Host gets admin privileges
	if role == "host" {
		grant.RoomAdmin = true
	}

	// at.AddGrant(grant).
	// 	SetIdentity(userName).
	// 	SetName(userName).
	// 	SetValidFor(24 * time.Hour)
	at.SetVideoGrant(grant).
		SetIdentity(userName).
		SetName(userName).
		SetValidFor(24 * time.Hour)
		
	return at.ToJWT()
}
