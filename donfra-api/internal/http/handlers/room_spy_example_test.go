package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"donfra-api/internal/domain/room"
	"donfra-api/internal/http/handlers"
)

// SpyRoomService 是一个 Spy 实现 - 记录所有调用信息
type SpyRoomService struct {
	// 控制返回值（Mock 功能）
	InitReturnURL   string
	InitReturnToken string
	InitReturnError error
	IsOpenReturn    bool

	// Spy 功能 - 记录调用信息
	InitCallCount           int
	InitLastPasscode        string
	InitLastSize            int
	UpdateHeadcountCallCount int
	UpdateHeadcountLastValue int
	CloseCallCount          int
}

// Init implements RoomService
func (s *SpyRoomService) Init(passcode string, size int) (string, string, error) {
	s.InitCallCount++
	s.InitLastPasscode = passcode
	s.InitLastSize = size
	return s.InitReturnURL, s.InitReturnToken, s.InitReturnError
}

// IsOpen implements RoomService
func (s *SpyRoomService) IsOpen() bool {
	return s.IsOpenReturn
}

// InviteLink implements RoomService
func (s *SpyRoomService) InviteLink() string {
	return ""
}

// Headcount implements RoomService
func (s *SpyRoomService) Headcount() int {
	return 0
}

// Limit implements RoomService
func (s *SpyRoomService) Limit() int {
	return 0
}

// Validate implements RoomService
func (s *SpyRoomService) Validate(token string) bool {
	return false
}

// Close implements RoomService
func (s *SpyRoomService) Close() error {
	s.CloseCallCount++
	return nil
}

// UpdateHeadcount implements RoomService - 这是我们要测试的
func (s *SpyRoomService) UpdateHeadcount(count int) error {
	s.UpdateHeadcountCallCount++
	s.UpdateHeadcountLastValue = count
	return nil
}

// TestRoomUpdatePeople_VerifiesServiceCall 验证 handler 正确调用了 service
func TestRoomUpdatePeople_VerifiesServiceCall(t *testing.T) {
	spy := &SpyRoomService{}
	h := handlers.New(spy, nil, nil)

	// 发送请求：更新人数为 15
	reqBody := room.UpdateHeadcountRequest{Headcount: 15}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/update-people", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomUpdatePeople(w, req)

	// 验证 handler 调用了 UpdateHeadcount
	if spy.UpdateHeadcountCallCount != 1 {
		t.Errorf("expected UpdateHeadcount to be called once, got %d", spy.UpdateHeadcountCallCount)
	}

	// 验证 handler 传递了正确的参数
	if spy.UpdateHeadcountLastValue != 15 {
		t.Errorf("expected UpdateHeadcount to be called with 15, got %d", spy.UpdateHeadcountLastValue)
	}

	// 验证响应正确
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

// TestRoomInit_VerifiesPasscodeTrimming 验证 handler 处理了 passcode 的空格
func TestRoomInit_VerifiesPasscodeTrimming(t *testing.T) {
	spy := &SpyRoomService{
		InitReturnURL:   "http://example.com/join",
		InitReturnToken: "token123",
		InitReturnError: nil,
	}
	h := handlers.New(spy, nil, nil)

	// 发送请求：passcode 带有空格
	reqBody := room.InitRequest{
		Passcode: "  7777  ",  // 前后有空格
		Size:     10,
	}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/room/init", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.RoomInit(w, req)

	// Spy 验证：handler 是否去掉了空格？
	if spy.InitLastPasscode != "7777" {
		t.Errorf("expected passcode to be trimmed to '7777', got '%s'", spy.InitLastPasscode)
	}

	// 验证：size 是否正确传递？
	if spy.InitLastSize != 10 {
		t.Errorf("expected size to be 10, got %d", spy.InitLastSize)
	}

	// 验证：Init 只被调用一次？
	if spy.InitCallCount != 1 {
		t.Errorf("expected Init to be called once, got %d", spy.InitCallCount)
	}
}

// TestMultipleUpdates_VerifiesCallSequence 验证多次调用
func TestMultipleUpdates_VerifiesCallSequence(t *testing.T) {
	spy := &SpyRoomService{}
	h := handlers.New(spy, nil, nil)

	// 第一次更新
	update1 := room.UpdateHeadcountRequest{Headcount: 5}
	bodyBytes1, _ := json.Marshal(update1)
	req1 := httptest.NewRequest(http.MethodPost, "/api/room/update-people", bytes.NewReader(bodyBytes1))
	w1 := httptest.NewRecorder()
	h.RoomUpdatePeople(w1, req1)

	// 第二次更新
	update2 := room.UpdateHeadcountRequest{Headcount: 10}
	bodyBytes2, _ := json.Marshal(update2)
	req2 := httptest.NewRequest(http.MethodPost, "/api/room/update-people", bytes.NewReader(bodyBytes2))
	w2 := httptest.NewRecorder()
	h.RoomUpdatePeople(w2, req2)

	// Spy 验证：被调用了 2 次
	if spy.UpdateHeadcountCallCount != 2 {
		t.Errorf("expected UpdateHeadcount to be called twice, got %d", spy.UpdateHeadcountCallCount)
	}

	// Spy 验证：最后一次调用的值是 10
	if spy.UpdateHeadcountLastValue != 10 {
		t.Errorf("expected last value to be 10, got %d", spy.UpdateHeadcountLastValue)
	}
}
