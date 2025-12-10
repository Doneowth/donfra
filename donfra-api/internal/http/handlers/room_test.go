package handlers_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"donfra-api/internal/domain/room"
	"donfra-api/internal/http/handlers"
)

// MockRoomService for testing
type MockRoomService struct {
	InitFunc            func(passcode string, size int) (inviteURL string, token string, err error)
	IsOpenFunc          func() bool
	InviteLinkFunc      func() string
	HeadcountFunc       func() int
	LimitFunc           func() int
	ValidateFunc        func(token string) bool
	CloseFunc           func() error
	UpdateHeadcountFunc func(count int) error
}

func (m *MockRoomService) Init(passcode string, size int) (string, string, error) {
	if m.InitFunc != nil {
		return m.InitFunc(passcode, size)
	}
	return "", "", nil
}

func (m *MockRoomService) IsOpen() bool {
	if m.IsOpenFunc != nil {
		return m.IsOpenFunc()
	}
	return false
}

func (m *MockRoomService) InviteLink() string {
	if m.InviteLinkFunc != nil {
		return m.InviteLinkFunc()
	}
	return ""
}

func (m *MockRoomService) Headcount() int {
	if m.HeadcountFunc != nil {
		return m.HeadcountFunc()
	}
	return 0
}

func (m *MockRoomService) Limit() int {
	if m.LimitFunc != nil {
		return m.LimitFunc()
	}
	return 0
}

func (m *MockRoomService) Validate(token string) bool {
	if m.ValidateFunc != nil {
		return m.ValidateFunc(token)
	}
	return false
}

func (m *MockRoomService) Close() error {
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}

func (m *MockRoomService) UpdateHeadcount(count int) error {
	if m.UpdateHeadcountFunc != nil {
		return m.UpdateHeadcountFunc(count)
	}
	return nil
}

// TestRoomInit_Success tests successful room initialization
func TestRoomInit_Success(t *testing.T) {
	mockRoom := &MockRoomService{
		InitFunc: func(passcode string, size int) (string, string, error) {
			if passcode == "7777" && size == 10 {
				return "http://example.com/join?token=abc123", "abc123", nil
			}
			return "", "", errors.New("invalid passcode")
		},
	}

	h := handlers.New(mockRoom, nil, nil)

	reqBody := room.InitRequest{Passcode: "7777", Size: 10}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/init", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomInit(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp room.InitResponse
	json.NewDecoder(w.Body).Decode(&resp)

	if resp.InviteURL != "http://example.com/join?token=abc123" {
		t.Errorf("unexpected invite URL: %s", resp.InviteURL)
	}

	if resp.Token != "abc123" {
		t.Errorf("unexpected token: %s", resp.Token)
	}
}

// TestRoomInit_WrongPasscode tests passcode validation
func TestRoomInit_WrongPasscode(t *testing.T) {
	mockRoom := &MockRoomService{
		InitFunc: func(passcode string, size int) (string, string, error) {
			return "", "", errors.New("invalid passcode")
		},
	}

	h := handlers.New(mockRoom, nil, nil)

	reqBody := room.InitRequest{Passcode: "wrong", Size: 10}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/init", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomInit(w, req)

	// Handler returns 409 Conflict on error
	if w.Code != http.StatusConflict {
		t.Errorf("expected status 409, got %d", w.Code)
	}
}

// TestRoomStatus_Open tests getting status of open room
func TestRoomStatus_Open(t *testing.T) {
	mockRoom := &MockRoomService{
		IsOpenFunc:     func() bool { return true },
		InviteLinkFunc: func() string { return "http://example.com/join?token=xyz" },
		HeadcountFunc:  func() int { return 5 },
		LimitFunc:      func() int { return 10 },
	}

	h := handlers.New(mockRoom, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/room/status", nil)
	w := httptest.NewRecorder()

	h.RoomStatus(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp room.StatusResponse
	json.NewDecoder(w.Body).Decode(&resp)

	if resp.Open != true {
		t.Error("expected room to be open")
	}

	if resp.Headcount != 5 {
		t.Errorf("expected headcount 5, got %d", resp.Headcount)
	}

	if resp.Limit != 10 {
		t.Errorf("expected limit 10, got %d", resp.Limit)
	}
}

// TestRoomStatus_Closed tests getting status of closed room
func TestRoomStatus_Closed(t *testing.T) {
	mockRoom := &MockRoomService{
		IsOpenFunc: func() bool { return false },
	}

	h := handlers.New(mockRoom, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/room/status", nil)
	w := httptest.NewRecorder()

	h.RoomStatus(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp room.StatusResponse
	json.NewDecoder(w.Body).Decode(&resp)

	if resp.Open != false {
		t.Error("expected room to be closed")
	}
}

// TestRoomJoin_Success tests successful room join
func TestRoomJoin_Success(t *testing.T) {
	mockRoom := &MockRoomService{
		IsOpenFunc:    func() bool { return true },
		ValidateFunc:  func(token string) bool { return token == "valid-token" },
		HeadcountFunc: func() int { return 5 },
		LimitFunc:     func() int { return 10 },
	}

	h := handlers.New(mockRoom, nil, nil)

	reqBody := room.JoinRequest{Token: "valid-token"}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/join", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomJoin(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	// Check that room_access cookie was set
	cookies := w.Result().Cookies()
	found := false
	for _, cookie := range cookies {
		if cookie.Name == "room_access" && cookie.Value == "1" {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected room_access cookie to be set")
	}
}

// TestRoomJoin_RoomClosed tests joining when room is closed
func TestRoomJoin_RoomClosed(t *testing.T) {
	mockRoom := &MockRoomService{
		IsOpenFunc: func() bool { return false },
	}

	h := handlers.New(mockRoom, nil, nil)

	reqBody := room.JoinRequest{Token: "any-token"}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/join", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomJoin(w, req)

	// Handler returns 409 Conflict when room is closed
	if w.Code != http.StatusConflict {
		t.Errorf("expected status 409, got %d", w.Code)
	}
}

// TestRoomJoin_InvalidToken tests joining with invalid token
func TestRoomJoin_InvalidToken(t *testing.T) {
	mockRoom := &MockRoomService{
		IsOpenFunc:   func() bool { return true },
		ValidateFunc: func(token string) bool { return false },
	}

	h := handlers.New(mockRoom, nil, nil)

	reqBody := room.JoinRequest{Token: "invalid-token"}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/join", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomJoin(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}

// TestRoomJoin_RoomFull tests joining when room is at capacity
func TestRoomJoin_RoomFull(t *testing.T) {
	mockRoom := &MockRoomService{
		IsOpenFunc:    func() bool { return true },
		ValidateFunc:  func(token string) bool { return true },
		HeadcountFunc: func() int { return 10 },
		LimitFunc:     func() int { return 10 }, // at capacity
	}

	h := handlers.New(mockRoom, nil, nil)

	reqBody := room.JoinRequest{Token: "valid-token"}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/join", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomJoin(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected status 403 when room is full, got %d", w.Code)
	}
}

// TestRoomClose_Success tests closing the room
func TestRoomClose_Success(t *testing.T) {
	mockRoom := &MockRoomService{
		CloseFunc:  func() error { return nil },
		IsOpenFunc: func() bool { return false },
	}

	h := handlers.New(mockRoom, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/room/close", nil)
	w := httptest.NewRecorder()

	h.RoomClose(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp room.StatusResponse
	json.NewDecoder(w.Body).Decode(&resp)

	if resp.Open != false {
		t.Error("expected room to be closed")
	}
}

// TestRoomUpdatePeople_Success tests updating headcount
func TestRoomUpdatePeople_Success(t *testing.T) {
	var updatedCount int

	mockRoom := &MockRoomService{
		UpdateHeadcountFunc: func(count int) error {
			updatedCount = count
			return nil
		},
	}

	h := handlers.New(mockRoom, nil, nil)

	reqBody := room.UpdateHeadcountRequest{Headcount: 7}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/update-people", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomUpdatePeople(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	if updatedCount != 7 {
		t.Errorf("expected headcount to be updated to 7, got %d", updatedCount)
	}
}
