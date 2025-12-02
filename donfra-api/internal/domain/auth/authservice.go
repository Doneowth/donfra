package auth

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AuthService issues and validates dashboard JWTs using an HS256 symmetric secret.
// Both the admin passphrase and signing secret should be supplied via environment variables.
type AuthService struct {
	adminPass string
	secret    []byte
}

// New constructs the auth service.
// adminPass is the shared secret the dashboard uses to request a token.
// jwtSecret is the symmetric signing key for HS256; defaults to a built-in fallback if empty.
func NewAuthService(adminPass, jwtSecret string) *AuthService {
	secret := jwtSecret
	if strings.TrimSpace(secret) == "" {
		secret = "donfra-secret"
	}
	return &AuthService{
		adminPass: strings.TrimSpace(adminPass),
		secret:    []byte(secret),
	}
}

type Claims struct {
	jwt.RegisteredClaims
}

// GetSubject satisfies jwt.Claims and allows callers to read the subject without casting.
func (c Claims) GetSubject() (string, error) { return c.Subject, nil }

// IssueAdminToken verifies the provided dashboard password and returns a signed JWT
// with subject "admin". The token uses HS256 and is valid for 24 hours.
// The token is entirely stateless; the server later validates it by verifying the
// signature and standard claims using the same secret key.
func (s *AuthService) IssueAdminToken(pass string) (string, error) {
	if strings.TrimSpace(pass) != s.adminPass {
		return "", errors.New("invalid credentials")
	}

	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "admin",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			Issuer:    "donfra-api",
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(s.secret)
}

// Validate parses the JWT using the shared secret and verifies its signature and standard
// claims (expiration, etc). It returns the typed Claims if the token is valid.
// Because tokens are stateless, invalid or expired tokens simply fail verification.
func (s *AuthService) Validate(tokenStr string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
