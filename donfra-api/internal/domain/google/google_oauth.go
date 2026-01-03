package google

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var (
	ErrInvalidState     = errors.New("invalid state parameter")
	ErrAuthCodeExchange = errors.New("failed to exchange auth code for access token")
	ErrGetUserInfo      = errors.New("failed to get google user info")
)

// GoogleOAuthService handles Google OAuth login flow
type GoogleOAuthService struct {
	config      *oauth2.Config
	frontendURL string       // Frontend URL for OAuth callback redirect
	redisClient *redis.Client // Redis client for state storage (nil = use in-memory)

	// In-memory state storage (fallback when Redis is not available)
	states   map[string]*StateData
	statesMu *sync.RWMutex
}

type StateData struct {
	CreatedAt time.Time
	ExpiresAt time.Time
}

type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
	Locale        string `json:"locale"`
}

// NewGoogleOAuthService creates a new Google OAuth service
func NewGoogleOAuthService(clientID, clientSecret, redirectURL, frontendURL string, redisClient *redis.Client) *GoogleOAuthService {
	svc := &GoogleOAuthService{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes: []string{
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
			},
			Endpoint: google.Endpoint,
		},
		frontendURL: frontendURL,
		redisClient: redisClient,
		states:      make(map[string]*StateData),
		statesMu:    &sync.RWMutex{},
	}

	// Start cleanup goroutine for expired states (only for in-memory mode)
	if redisClient == nil {
		go svc.cleanupExpiredStates()
	}

	return svc
}

// GenerateAuthURL generates a Google OAuth authorization URL
func (s *GoogleOAuthService) GenerateAuthURL() (string, string, error) {
	state := s.generateState()
	expiration := 10 * time.Minute

	// Store state with expiration (Redis or in-memory)
	if s.redisClient != nil {
		// Use Redis for distributed state storage
		ctx := context.Background()
		key := "google_oauth_state:" + state
		err := s.redisClient.Set(ctx, key, "valid", expiration).Err()
		if err != nil {
			return "", "", fmt.Errorf("failed to store state in Redis: %w", err)
		}
	} else {
		// Fallback to in-memory storage
		s.statesMu.Lock()
		s.states[state] = &StateData{
			CreatedAt: time.Now(),
			ExpiresAt: time.Now().Add(expiration),
		}
		s.statesMu.Unlock()
	}

	// Generate OAuth URL
	authURL := s.config.AuthCodeURL(state, oauth2.AccessTypeOffline)

	return authURL, state, nil
}

// ExchangeCode exchanges authorization code for access token and user info
func (s *GoogleOAuthService) ExchangeCode(ctx context.Context, code, state string) (*GoogleUserInfo, error) {
	// Verify state
	if !s.validateState(state) {
		return nil, ErrInvalidState
	}

	// Exchange code for token
	token, err := s.config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAuthCodeExchange, err)
	}

	// Get user info using access token
	userInfo, err := s.getUserInfo(ctx, token.AccessToken)
	if err != nil {
		return nil, err
	}

	// Remove used state (Redis or in-memory)
	if s.redisClient != nil {
		key := "google_oauth_state:" + state
		s.redisClient.Del(ctx, key)
	} else {
		s.statesMu.Lock()
		delete(s.states, state)
		s.statesMu.Unlock()
	}

	return userInfo, nil
}

// getUserInfo fetches user information from Google API
func (s *GoogleOAuthService) getUserInfo(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
	// Google UserInfo endpoint
	userInfoURL := "https://www.googleapis.com/oauth2/v2/userinfo"

	req, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to create request", ErrGetUserInfo)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGetUserInfo, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: HTTP %d: %s", ErrGetUserInfo, resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to read response", ErrGetUserInfo)
	}

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("%w: invalid response format", ErrGetUserInfo)
	}

	if userInfo.ID == "" {
		return nil, fmt.Errorf("%w: no user id in response", ErrGetUserInfo)
	}

	return &userInfo, nil
}

// generateState creates a cryptographically secure random state
func (s *GoogleOAuthService) generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// validateState checks if the state is valid and not expired
func (s *GoogleOAuthService) validateState(state string) bool {
	if s.redisClient != nil {
		// Check Redis for state validity
		ctx := context.Background()
		key := "google_oauth_state:" + state
		result, err := s.redisClient.Get(ctx, key).Result()
		if err != nil || result == "" {
			return false
		}
		return true
	}

	// Fallback to in-memory validation
	s.statesMu.RLock()
	defer s.statesMu.RUnlock()

	data, exists := s.states[state]
	if !exists {
		return false
	}

	return time.Now().Before(data.ExpiresAt)
}

// GetFrontendURL returns the frontend URL for OAuth callback redirect
func (s *GoogleOAuthService) GetFrontendURL() string {
	if s.frontendURL == "" {
		return "/" // Default to root if not configured
	}
	return s.frontendURL
}

// cleanupExpiredStates periodically removes expired state entries
func (s *GoogleOAuthService) cleanupExpiredStates() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.statesMu.Lock()
		now := time.Now()
		for state, data := range s.states {
			if now.After(data.ExpiresAt) {
				delete(s.states, state)
			}
		}
		s.statesMu.Unlock()
	}
}
