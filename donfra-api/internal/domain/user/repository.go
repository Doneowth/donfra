package user

import "context"

// Repository defines the interface for user data persistence.
type Repository interface {
	// Create creates a new user in the database.
	Create(ctx context.Context, user *User) error

	// FindByEmail retrieves a user by email address.
	FindByEmail(ctx context.Context, email string) (*User, error)

	// FindByID retrieves a user by their ID.
	FindByID(ctx context.Context, id uint) (*User, error)

	// FindByGoogleID retrieves a user by their Google ID.
	FindByGoogleID(ctx context.Context, googleID string) (*User, error)

	// Update updates an existing user.
	Update(ctx context.Context, user *User) error

	// Delete soft-deletes a user by ID.
	Delete(ctx context.Context, id uint) error

	// ExistsByEmail checks if a user with the given email exists.
	ExistsByEmail(ctx context.Context, email string) (bool, error)
}
