package livekit

import (
	"time"
)

// LiveSession represents a live streaming session
type LiveSession struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SessionID   string    `gorm:"uniqueIndex;size:100;not null" json:"session_id"` // LiveKit room name
	OwnerID     uint      `gorm:"not null;index" json:"owner_id"`                   // Creator (admin/mentor)
	Title       string    `gorm:"size:200;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	SessionType string    `gorm:"size:50;not null;default:'teaching'" json:"session_type"` // teaching, interview, coding
	Status      string    `gorm:"size:20;not null;default:'scheduled'" json:"status"`      // scheduled, live, ended, cancelled
	MaxParticipants int   `gorm:"not null;default:50" json:"max_participants"`
	IsRecorded  bool      `gorm:"default:false" json:"is_recorded"`
	RecordingURL string   `gorm:"size:500" json:"recording_url,omitempty"`

	// Scheduling
	ScheduledAt *time.Time `json:"scheduled_at,omitempty"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`

	// Access control
	IsPublic    bool   `gorm:"default:false" json:"is_public"`
	InviteToken string `gorm:"size:500" json:"invite_token,omitempty"` // JWT for private sessions

	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}

// LiveParticipant represents a participant in a live session
type LiveParticipant struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SessionID   string    `gorm:"size:100;not null;index" json:"session_id"`
	UserID      uint      `gorm:"not null;index" json:"user_id"`
	Role        string    `gorm:"size:20;not null;default:'viewer'" json:"role"` // host, co-host, speaker, viewer
	JoinedAt    time.Time `json:"joined_at"`
	LeftAt      *time.Time `json:"left_at,omitempty"`
	Duration    int       `json:"duration"` // seconds
	CreatedAt   time.Time `json:"created_at"`
}

// SessionType constants
const (
	SessionTypeTeaching   = "teaching"   // One-to-many teaching
	SessionTypeInterview  = "interview"  // Interview practice
	SessionTypeCoding     = "coding"     // Collaborative coding with live stream
	SessionTypeWorkshop   = "workshop"   // Interactive workshop
)

// SessionStatus constants
const (
	SessionStatusScheduled = "scheduled"
	SessionStatusLive      = "live"
	SessionStatusEnded     = "ended"
	SessionStatusCancelled = "cancelled"
)

// ParticipantRole constants
const (
	RoleHost     = "host"     // Session creator, full control
	RoleCoHost   = "co-host"  // Can share screen, moderate
	RoleSpeaker  = "speaker"  // Can speak and share
	RoleViewer   = "viewer"   // Can only watch and chat
)

// CreateSessionRequest represents a request to create a live session
type CreateSessionRequest struct {
	Title           string     `json:"title" binding:"required,min=3,max=200"`
	Description     string     `json:"description" binding:"max=1000"`
	SessionType     string     `json:"session_type" binding:"required,oneof=teaching interview coding workshop"`
	MaxParticipants int        `json:"max_participants" binding:"required,min=2,max=500"`
	IsPublic        bool       `json:"is_public"`
	IsRecorded      bool       `json:"is_recorded"`
	ScheduledAt     *time.Time `json:"scheduled_at"`
}

// CreateSessionResponse represents the response after creating a session
type CreateSessionResponse struct {
	SessionID   string    `json:"session_id"`
	ServerURL   string    `json:"server_url"`     // LiveKit server URL
	InviteLink  string    `json:"invite_link,omitempty"`
	HostToken   string    `json:"host_token"`     // LiveKit access token for host
	CreatedAt   time.Time `json:"created_at"`
	Message     string    `json:"message"`
}

// JoinSessionRequest represents a request to join a session
type JoinSessionRequest struct {
	SessionID   string `json:"session_id" binding:"required"`
	InviteToken string `json:"invite_token,omitempty"` // Required for private sessions
	DisplayName string `json:"display_name" binding:"required,min=2,max=50"`
}

// JoinSessionResponse represents the response after joining
type JoinSessionResponse struct {
	SessionID    string `json:"session_id"`
	AccessToken  string `json:"access_token"`  // LiveKit access token
	ServerURL    string `json:"server_url"`    // LiveKit server URL
	Role         string `json:"role"`
	CanPublish   bool   `json:"can_publish"`   // Can publish audio/video
	CanSubscribe bool   `json:"can_subscribe"` // Can receive streams
	Message      string `json:"message"`
}

// EndSessionResponse represents the response after ending a session
type EndSessionResponse struct {
	SessionID string    `json:"session_id"`
	EndedAt   time.Time `json:"ended_at"`
	Message   string    `json:"message"`
}

// UpdateSessionRequest represents a request to update session details
type UpdateSessionRequest struct {
	Title       *string    `json:"title,omitempty"`
	Description *string    `json:"description,omitempty"`
	Status      *string    `json:"status,omitempty" binding:"omitempty,oneof=scheduled live ended cancelled"`
	ScheduledAt *time.Time `json:"scheduled_at,omitempty"`
}

// SessionStatsResponse represents session statistics
type SessionStatsResponse struct {
	SessionID         string    `json:"session_id"`
	Status            string    `json:"status"`
	CurrentViewers    int       `json:"current_viewers"`
	TotalParticipants int       `json:"total_participants"`
	Duration          int       `json:"duration"` // seconds
	StartedAt         *time.Time `json:"started_at,omitempty"`
	EndedAt           *time.Time `json:"ended_at,omitempty"`
}

// ListSessionsRequest represents query parameters for listing sessions
type ListSessionsRequest struct {
	Status      string `form:"status"`                              // Filter by status
	SessionType string `form:"session_type"`                        // Filter by type
	OwnerID     uint   `form:"owner_id"`                            // Filter by owner
	IsPublic    *bool  `form:"is_public"`                           // Filter by visibility
	Page        int    `form:"page" binding:"min=1"`                // Pagination
	PageSize    int    `form:"page_size" binding:"min=1,max=100"`   // Items per page
}

// SessionListItem represents a session in list view
type SessionListItem struct {
	ID              uint       `json:"id"`
	SessionID       string     `json:"session_id"`
	Title           string     `json:"title"`
	SessionType     string     `json:"session_type"`
	Status          string     `json:"status"`
	CurrentViewers  int        `json:"current_viewers"`
	MaxParticipants int        `json:"max_participants"`
	IsPublic        bool       `json:"is_public"`
	IsRecorded      bool       `json:"is_recorded"`
	OwnerID         uint       `json:"owner_id"`
	OwnerName       string     `json:"owner_name,omitempty"`
	ScheduledAt     *time.Time `json:"scheduled_at,omitempty"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// ListSessionsResponse represents paginated session list
type ListSessionsResponse struct {
	Sessions   []SessionListItem `json:"sessions"`
	TotalCount int               `json:"total_count"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	TotalPages int               `json:"total_pages"`
}
