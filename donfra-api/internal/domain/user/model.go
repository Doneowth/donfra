package user

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system.
type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Email        string         `gorm:"uniqueIndex;not null" json:"email"`
	Password     string         `gorm:"not null" json:"-"` // Never expose password in JSON
	Username     string         `gorm:"index" json:"username"`
	Role         string         `gorm:"not null;default:'user'" json:"role"` // user, admin, mentor
	IsActive     bool           `gorm:"not null;default:true" json:"isActive"`
	GoogleID     string         `gorm:"uniqueIndex" json:"-"` // Google OAuth ID (unique identifier)
	GoogleAvatar string         `json:"-"`                    // Google profile picture URL
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
}

// TableName specifies the table name for GORM.
func (User) TableName() string {
	return "users"
}

// UserPublic represents the public user information returned to clients.
type UserPublic struct {
	ID        uint      `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
}

// ToPublic converts a User to UserPublic (safe for API responses).
func (u *User) ToPublic() *UserPublic {
	return &UserPublic{
		ID:        u.ID,
		Email:     u.Email,
		Username:  u.Username,
		Role:      u.Role,
		IsActive:  u.IsActive,
		CreatedAt: u.CreatedAt,
	}
}

// RegisterRequest represents a user registration request.
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
}

// LoginRequest represents a user login request.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse represents the response after successful login.
type LoginResponse struct {
	User  *UserPublic `json:"user"`
	Token string      `json:"token,omitempty"` // Optional: for clients that need it
}

// ErrorResponse represents an error response.
type ErrorResponse struct {
	Error string `json:"error"`
}
