package auth

import "github.com/golang-jwt/jwt/v5"

// Claims represents the JWT claims for authenticated users.
// It extends the standard JWT registered claims with custom fields if needed.
type Claims struct {
	jwt.RegisteredClaims
}

// GetSubject satisfies jwt.Claims and allows callers to read the subject without casting.
func (c Claims) GetSubject() (string, error) {
	return c.Subject, nil
}

// LoginRequest represents the credentials provided during authentication.
type LoginRequest struct {
	Password string `json:"password"`
}

// TokenResponse represents the authentication token returned to the client.
type TokenResponse struct {
	Token string `json:"token"`
}
