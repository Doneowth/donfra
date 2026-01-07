package interview

import (
	"time"

	"gorm.io/gorm"
)

// InterviewRoom represents a collaborative interview room with user ownership
type InterviewRoom struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	RoomID       string         `gorm:"uniqueIndex;not null" json:"room_id"`
	OwnerID      uint           `gorm:"not null;index" json:"owner_id"`
	Headcount    int            `gorm:"default:0" json:"headcount"`
	CodeSnapshot string         `gorm:"type:text;default:''" json:"code_snapshot"`
	InviteLink   string         `gorm:"size:500" json:"invite_link"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// TableName specifies the table name for GORM
func (InterviewRoom) TableName() string {
	return "interview_rooms"
}

// InitRoomRequest is the request payload for POST /api/interview/init
// No fields required - only admin users can create rooms via JWT authentication
type InitRoomRequest struct {
	// Empty - authentication is via JWT cookie
}

// InitRoomResponse is the response for POST /api/interview/init
type InitRoomResponse struct {
	RoomID     string `json:"room_id"`
	InviteLink string `json:"invite_link"`
	Message    string `json:"message"`
}

// JoinRoomRequest is the request payload for POST /api/interview/join
type JoinRoomRequest struct {
	InviteToken string `json:"invite_token"`
}

// JoinRoomResponse is the response for POST /api/interview/join
type JoinRoomResponse struct {
	RoomID  string `json:"room_id"`
	Message string `json:"message"`
}

// CloseRoomRequest is the request payload for POST /api/interview/close
type CloseRoomRequest struct {
	RoomID string `json:"room_id"`
}

// CloseRoomResponse is the response for POST /api/interview/close
type CloseRoomResponse struct {
	RoomID  string `json:"room_id"`
	Message string `json:"message"`
}

// RoomStatusResponse is the response for GET /api/interview/rooms/:room_id/status
type RoomStatusResponse struct {
	RoomID     string `json:"room_id"`
	OwnerID    uint   `json:"owner_id"`
	Headcount  int    `json:"headcount"`
	InviteLink string `json:"invite_link"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}
