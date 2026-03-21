package livekit

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
	"github.com/redis/go-redis/v9"
)

// Service handles LiveKit live streaming business logic
type Service struct {
	apiKey           string
	apiSecret        string
	serverURL        string
	tokenExpiryHours int
	redisClient      *redis.Client
	lastSeenSessions map[string]bool // Track sessions seen in last cleanup
}

// NewService creates a new LiveKit service
func NewService(apiKey, apiSecret, serverURL string, tokenExpiryHours int, redisClient *redis.Client) *Service {
	if tokenExpiryHours <= 0 {
		tokenExpiryHours = 24 // Default: 24 hours
	}
	return &Service{
		apiKey:           apiKey,
		apiSecret:        apiSecret,
		serverURL:        serverURL,
		tokenExpiryHours: tokenExpiryHours,
		redisClient:      redisClient,
		lastSeenSessions: make(map[string]bool),
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

	// Store session info in Redis and publish event
	createdAt := time.Now()
	if s.redisClient != nil {
		sessionData := map[string]interface{}{
			"session_id": sessionID,
			"title":      title,
			"owner_name": ownerName,
			"created_at": createdAt.Format(time.RFC3339),
		}
		data, _ := json.Marshal(sessionData)
		// Store with 24-hour TTL
		_ = s.redisClient.Set(ctx, "livekit:session:"+sessionID, data, 24*time.Hour).Err()

		// Publish session created event
		sessionItem := SessionListItem{
			SessionID: sessionID,
			Title:     title,
			OwnerName: ownerName,
			CreatedAt: createdAt,
			Status:    "live",
		}
		sessionItemJSON, _ := json.Marshal(sessionItem)
		eventMsg := fmt.Sprintf(`{"type":"created","session":%s}`, string(sessionItemJSON))
		_ = s.redisClient.Publish(ctx, "livekit:sessions:changes", eventMsg).Err()
	}

	return &CreateSessionResponse{
		SessionID:  sessionID,
		ServerURL:  s.serverURL,
		HostToken:  hostToken,
		CreatedAt:  createdAt,
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
	endedAt := time.Now()

	// Remove from Redis and publish ended event
	if s.redisClient != nil {
		_ = s.redisClient.Del(ctx, "livekit:session:"+sessionID).Err()

		// Publish session ended event
		eventMsg := fmt.Sprintf(`{"type":"ended","session_id":"%s"}`, sessionID)
		_ = s.redisClient.Publish(ctx, "livekit:sessions:changes", eventMsg).Err()
	}

	return &EndSessionResponse{
		SessionID: sessionID,
		EndedAt:   endedAt,
		Message:   "Live session ended successfully",
	}, nil
}

// ListActiveSessions lists all active live streaming sessions
func (s *Service) ListActiveSessions(ctx context.Context) (*ListSessionsResponse, error) {
	items := []SessionListItem{}

	if s.redisClient == nil {
		// No Redis configured
		return &ListSessionsResponse{Sessions: items, TotalCount: 0}, nil
	}

	// Scan all session keys
	var cursor uint64
	for {
		keys, newCursor, err := s.redisClient.Scan(ctx, cursor, "livekit:session:*", 100).Result()
		if err != nil {
			return nil, fmt.Errorf("failed to scan sessions: %w", err)
		}

		for _, key := range keys {
			data, err := s.redisClient.Get(ctx, key).Result()
			if err != nil {
				continue
			}

			var sessionData map[string]interface{}
			if err := json.Unmarshal([]byte(data), &sessionData); err != nil {
				continue
			}

			createdAtStr := ""
			if v, ok := sessionData["created_at"]; ok {
				createdAtStr = v.(string)
			}
			createdAt := time.Time{}
			if createdAtStr != "" {
				createdAt, _ = time.Parse(time.RFC3339, createdAtStr)
			}

			items = append(items, SessionListItem{
				SessionID: sessionData["session_id"].(string),
				Title:     sessionData["title"].(string),
				OwnerName: sessionData["owner_name"].(string),
				CreatedAt: createdAt,
				Status:    "live",
			})
		}

		cursor = newCursor
		if cursor == 0 {
			break
		}
	}

	return &ListSessionsResponse{Sessions: items, TotalCount: len(items)}, nil
}

// StreamSessionChanges streams session change events via Redis Pub/Sub
// Returns a channel that emits JSON strings. Closing ctx cancels the subscription.
func (s *Service) StreamSessionChanges(ctx context.Context) (<-chan string, error) {
	if s.redisClient == nil {
		return nil, fmt.Errorf("redis not configured")
	}

	sub := s.redisClient.Subscribe(ctx, "livekit:sessions:changes")
	ch := make(chan string, 8)

	go func() {
		defer sub.Close()
		defer close(ch)
		msgCh := sub.Channel()
		for {
			select {
			case msg, ok := <-msgCh:
				if !ok {
					return
				}
				ch <- msg.Payload
			case <-ctx.Done():
				return
			}
		}
	}()

	return ch, nil
}

// CleanupEmptyRooms detects sessions that have expired from Redis (TTL-based cleanup)
// Uses TTL to auto-expire sessions after 24 hours of no activity.
// This goroutine detects disappeared sessions and publishes cleanup events.
func (s *Service) CleanupEmptyRooms(ctx context.Context) error {
	if s.redisClient == nil {
		return nil // skip if not configured
	}

	// Scan current Redis session keys
	var cursor uint64
	currentSessions := make(map[string]bool)

	for {
		keys, newCursor, err := s.redisClient.Scan(ctx, cursor, "livekit:session:*", 100).Result()
		if err != nil {
			return err
		}

		for _, key := range keys {
			sessionID := strings.TrimPrefix(key, "livekit:session:")
			currentSessions[sessionID] = true
		}

		cursor = newCursor
		if cursor == 0 {
			break
		}
	}

	// Compare with last seen: if session disappeared, publish ended event
	for sessionID := range s.lastSeenSessions {
		if !currentSessions[sessionID] {
			// Session has expired from Redis (TTL), notify clients
			eventMsg := fmt.Sprintf(`{"type":"ended","session_id":"%s"}`, sessionID)
			_ = s.redisClient.Publish(ctx, "livekit:sessions:changes", eventMsg).Err()
		}
	}

	// Update last seen sessions for next cleanup run
	s.lastSeenSessions = currentSessions

	return nil
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
