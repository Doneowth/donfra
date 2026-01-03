package user

import (
	"context"
	"errors"
	"regexp"
	"strings"
)

var (
	// ErrInvalidEmail is returned when the email format is invalid.
	ErrInvalidEmail = errors.New("invalid email format")
	// ErrPasswordTooShort is returned when the password is too short.
	ErrPasswordTooShort = errors.New("password must be at least 8 characters")
	// ErrEmailAlreadyExists is returned when attempting to register with an existing email.
	ErrEmailAlreadyExists = errors.New("email already exists")
	// ErrUserNotFound is returned when a user cannot be found.
	ErrUserNotFound = errors.New("user not found")
	// ErrInvalidCredentials is returned when login credentials are invalid.
	ErrInvalidCredentials = errors.New("invalid email or password")
	// ErrUserInactive is returned when attempting to login with an inactive account.
	ErrUserInactive = errors.New("account is inactive")
	// ErrIncorrectPassword is returned when the current password is incorrect.
	ErrIncorrectPassword = errors.New("current password is incorrect")
	// ErrGoogleIDRequired is returned when Google ID is missing.
	ErrGoogleIDRequired = errors.New("google id is required")
)

// Email validation regex (simple version)
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// Service handles user business logic.
type Service struct {
	repo        Repository
	jwtSecret   string
	jwtExpiry   int // JWT expiry in hours
}

// NewService creates a new user service.
func NewService(repo Repository, jwtSecret string, jwtExpiry int) *Service {
	if jwtExpiry <= 0 {
		jwtExpiry = 168 // Default: 7 days
	}
	return &Service{
		repo:      repo,
		jwtSecret: jwtSecret,
		jwtExpiry: jwtExpiry,
	}
}

// Register registers a new user.
func (s *Service) Register(ctx context.Context, req *RegisterRequest) (*User, error) {
	// Validate email
	email := strings.TrimSpace(strings.ToLower(req.Email))
	if !emailRegex.MatchString(email) {
		return nil, ErrInvalidEmail
	}

	// Validate password
	if len(req.Password) < 8 {
		return nil, ErrPasswordTooShort
	}

	// Check if email already exists
	exists, err := s.repo.ExistsByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrEmailAlreadyExists
	}

	// Hash password
	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	// Create user
	user := &User{
		Email:    email,
		Password: hashedPassword,
		Username: strings.TrimSpace(req.Username),
		Role:     "user", // Default role
		IsActive: true,
	}

	// If username is empty, use email prefix
	if user.Username == "" {
		user.Username = strings.Split(email, "@")[0]
	}

	// Save to database
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// Login authenticates a user and returns the user and a JWT token.
func (s *Service) Login(ctx context.Context, req *LoginRequest) (*User, string, error) {
	// Normalize email
	email := strings.TrimSpace(strings.ToLower(req.Email))

	// Find user by email
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, "", err
	}
	if user == nil {
		return nil, "", ErrInvalidCredentials
	}

	// Check if user is active
	if !user.IsActive {
		return nil, "", ErrUserInactive
	}

	// Verify password
	if err := VerifyPassword(user.Password, req.Password); err != nil {
		return nil, "", ErrInvalidCredentials
	}

	// Generate JWT token
	token, err := GenerateToken(user, s.jwtSecret, s.jwtExpiry)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

// ValidateToken validates a JWT token and returns the claims.
func (s *Service) ValidateToken(tokenString string) (*Claims, error) {
	return ValidateToken(tokenString, s.jwtSecret)
}

// GetUserByID retrieves a user by their ID.
func (s *Service) GetUserByID(ctx context.Context, id uint) (*User, error) {
	user, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// GetUserByEmail retrieves a user by their email.
func (s *Service) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// GetJWTSecret returns the JWT secret used by the service.
func (s *Service) GetJWTSecret() string {
	return s.jwtSecret
}

// GetJWTExpiry returns the JWT expiry duration in hours.
func (s *Service) GetJWTExpiry() int {
	return s.jwtExpiry
}

// UpdatePassword updates a user's password after verifying the current password.
func (s *Service) UpdatePassword(ctx context.Context, userID uint, currentPassword, newPassword string) error {
	// Fetch the user
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrUserNotFound
	}

	// Verify current password
	if err := VerifyPassword(user.Password, currentPassword); err != nil {
		return ErrIncorrectPassword
	}

	// Validate new password
	if len(newPassword) < 8 {
		return ErrPasswordTooShort
	}

	// Hash new password
	hashedPassword, err := HashPassword(newPassword)
	if err != nil {
		return err
	}

	// Update password in database
	user.Password = hashedPassword
	if err := s.repo.Update(ctx, user); err != nil {
		return err
	}

	return nil
}

// LoginOrRegisterWithGoogle logs in or registers a user via Google OAuth.
// If the user with the given Google ID exists, they are logged in.
// If not, a new user is created using their Google account info.
func (s *Service) LoginOrRegisterWithGoogle(ctx context.Context, googleID, email, name, avatar string) (*User, string, error) {
	if googleID == "" {
		return nil, "", ErrGoogleIDRequired
	}

	// Try to find user by Google ID
	user, err := s.repo.FindByGoogleID(ctx, googleID)
	if err != nil {
		return nil, "", err
	}

	// If user exists, log them in
	if user != nil {
		if !user.IsActive {
			return nil, "", ErrUserInactive
		}

		// Update avatar if changed
		if avatar != "" && user.GoogleAvatar != avatar {
			user.GoogleAvatar = avatar
			s.repo.Update(ctx, user)
		}

		// Generate JWT token
		token, err := GenerateToken(user, s.jwtSecret, s.jwtExpiry)
		if err != nil {
			return nil, "", err
		}

		return user, token, nil
	}

	// User doesn't exist, create new account using Google info
	// Use email from Google if available, otherwise create placeholder
	userEmail := email
	if userEmail == "" {
		userEmail = "google_" + googleID + "@placeholder.donfra.com"
	}

	// Generate random password (user won't need it as they login via Google)
	placeholderPassword, err := HashPassword("google_oauth_" + googleID)
	if err != nil {
		return nil, "", err
	}

	// Use name from Google, or fallback to email prefix
	username := name
	if username == "" {
		username = strings.Split(userEmail, "@")[0]
	}

	// Create new user
	newUser := &User{
		Email:        userEmail,
		Password:     placeholderPassword,
		Username:     username,
		Role:         "user",
		IsActive:     true,
		GoogleID:     googleID,
		GoogleAvatar: avatar,
	}

	if err := s.repo.Create(ctx, newUser); err != nil {
		return nil, "", err
	}

	// Generate JWT token
	token, err := GenerateToken(newUser, s.jwtSecret, s.jwtExpiry)
	if err != nil {
		return nil, "", err
	}

	return newUser, token, nil
}

// GetUserByGoogleID retrieves a user by their Google ID.
func (s *Service) GetUserByGoogleID(ctx context.Context, googleID string) (*User, error) {
	user, err := s.repo.FindByGoogleID(ctx, googleID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}
