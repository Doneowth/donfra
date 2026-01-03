package handlers_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"donfra-api/internal/domain/auth"
	"donfra-api/internal/http/handlers"
)

// MockAuthService 是一个假的 AuthService 实现，用于测试
type MockAuthService struct {
	// 控制 IssueAdminToken 的返回值
	TokenToReturn string
	ErrorToReturn error

	// 记录被调用时的参数（可选，用于验证）
	LastPasswordReceived string
}

func (m *MockAuthService) IssueAdminToken(pass string) (string, error) {
	m.LastPasswordReceived = pass  // 记录参数
	return m.TokenToReturn, m.ErrorToReturn
}

func (m *MockAuthService) Validate(tokenStr string) (*auth.Claims, error) {
	// 这个测试不需要，但接口要求实现
	return nil, nil
}

// TestAdminLogin_Success 测试成功登录的情况
func TestAdminLogin_Success(t *testing.T) {
	// 1. 创建 mock service，返回成功的 token
	mockAuth := &MockAuthService{
		TokenToReturn: "test-jwt-token-12345",
		ErrorToReturn: nil,
	}

	// 2. 创建 handlers（只需要 authSvc，其他传 nil）
	h := handlers.New(nil, nil, mockAuth, nil, nil, nil, nil)

	// 3. 准备 HTTP 请求
	reqBody := map[string]string{"password": "7777"}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	// 4. 调用 handler
	h.AdminLogin(w, req)

	// 5. 验证结果
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp auth.TokenResponse
	json.NewDecoder(w.Body).Decode(&resp)

	if resp.Token != "test-jwt-token-12345" {
		t.Errorf("expected token 'test-jwt-token-12345', got '%s'", resp.Token)
	}

	// 验证 handler 传递了正确的密码给 service
	if mockAuth.LastPasswordReceived != "7777" {
		t.Errorf("expected password '7777', got '%s'", mockAuth.LastPasswordReceived)
	}
}

// TestAdminLogin_WrongPassword 测试密码错误的情况
func TestAdminLogin_WrongPassword(t *testing.T) {
	// Mock service 返回错误
	mockAuth := &MockAuthService{
		TokenToReturn: "",
		ErrorToReturn: errors.New("invalid password"),
	}

	h := handlers.New(nil, nil, mockAuth, nil, nil, nil, nil)

	reqBody := map[string]string{"password": "wrong"}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.AdminLogin(w, req)

	// 应该返回 401 Unauthorized
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}

// TestAdminLogin_InvalidJSON 测试无效的 JSON 请求
func TestAdminLogin_InvalidJSON(t *testing.T) {
	mockAuth := &MockAuthService{}
	h := handlers.New(nil, nil, mockAuth, nil, nil, nil, nil)

	// 发送无效的 JSON
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", bytes.NewReader([]byte("{invalid json")))
	w := httptest.NewRecorder()

	h.AdminLogin(w, req)

	// 应该返回 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

// TestAdminLogin_ServiceUnavailable 测试 service 为 nil 的情况
func TestAdminLogin_ServiceUnavailable(t *testing.T) {
	// 传入 nil authSvc
	h := handlers.New(nil, nil, nil, nil, nil, nil, nil)

	reqBody := map[string]string{"password": "7777"}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	h.AdminLogin(w, req)

	// 应该返回 500 Internal Server Error
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}
}
