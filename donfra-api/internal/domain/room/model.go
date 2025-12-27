package room

// RoomState represents the current state of the room.
type RoomState struct {
	Open        bool
	RoomID      string
	InviteToken string
	Headcount   int
	Limit       int
}

// InitRequest represents a request to initialize a room.
type InitRequest struct {
	Passcode string `json:"passcode"`
	Size     int    `json:"size"`
}

// InitResponse represents the response after initializing a room.
type InitResponse struct {
	InviteURL string `json:"inviteUrl"`
	RoomID    string `json:"roomId"`
	Token     string `json:"token,omitempty"`
}

// StatusResponse represents the current room status.
type StatusResponse struct {
	Open       bool   `json:"open"`
	RoomID     string `json:"roomId,omitempty"`
	InviteLink string `json:"inviteLink,omitempty"`
	Headcount  int    `json:"headcount,omitempty"`
	Limit      int    `json:"limit,omitempty"`
}

// JoinRequest represents a request to join a room.
type JoinRequest struct {
	Token string `json:"token"`
}

// JoinResponse represents the response after successfully joining a room.
type JoinResponse struct {
	Success bool `json:"success"`
}

// UpdateHeadcountRequest represents a request to update room headcount.
type UpdateHeadcountRequest struct {
	Headcount int `json:"headcount"`
}

// UpdateHeadcountResponse represents the response after updating headcount.
type UpdateHeadcountResponse struct {
	Headcount int `json:"headcount"`
}
