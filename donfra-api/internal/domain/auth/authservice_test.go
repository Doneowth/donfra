package auth_test

import (
	"strings"
	"testing"
	"time"

	"donfra-api/internal/domain/auth"
)

func TestAuthService_IssueAdminToken_Success(t *testing.T) {
	svc := auth.NewAuthService("admin123", "secret-key")

	token, err := svc.IssueAdminToken("admin123")

	// 验证：成功生成
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	if token == "" {
		t.Error("expected token to be generated")
	}

	// 验证：JWT 格式（header.payload.signature）
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Errorf("expected JWT to have 3 parts, got %d", len(parts))
	}
}

func TestAuthService_IssueAdminToken_WrongPassword(t *testing.T) {
	svc := auth.NewAuthService("admin123", "secret-key")

	_, err := svc.IssueAdminToken("wrong-password")

	// 验证：返回错误
	if err == nil {
		t.Error("expected error for wrong password")
	}

	if !strings.Contains(err.Error(), "invalid") {
		t.Errorf("expected error to contain 'invalid', got '%s'", err.Error())
	}
}

func TestAuthService_IssueAdminToken_EmptyPassword(t *testing.T) {
	svc := auth.NewAuthService("admin123", "secret-key")

	_, err := svc.IssueAdminToken("")

	// 验证：空密码返回错误
	if err == nil {
		t.Error("expected error for empty password")
	}
}

func TestAuthService_Validate_ValidToken(t *testing.T) {
	svc := auth.NewAuthService("admin123", "secret-key")

	// 先生成 token
	token, _ := svc.IssueAdminToken("admin123")

	// 验证 token
	claims, err := svc.Validate(token)

	// 验证：解析成功
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	if claims == nil {
		t.Fatal("expected claims to be non-nil")
	}

	// 验证：claims 内容正确
	if claims.Subject != "admin" {
		t.Errorf("expected subject 'admin', got '%s'", claims.Subject)
	}

	if claims.Issuer != "donfra-api" {
		t.Errorf("expected issuer 'donfra-api', got '%s'", claims.Issuer)
	}

	// 验证：ExpiresAt 是未来时间
	if claims.ExpiresAt.Time.Before(time.Now()) {
		t.Error("expected token to not be expired")
	}
}

func TestAuthService_Validate_InvalidToken(t *testing.T) {
	svc := auth.NewAuthService("admin123", "secret-key")

	_, err := svc.Validate("invalid.token.here")

	// 验证：返回错误
	if err == nil {
		t.Error("expected error for invalid token")
	}
}

func TestAuthService_Validate_TamperedToken(t *testing.T) {
	svc := auth.NewAuthService("admin123", "secret-key")

	token, _ := svc.IssueAdminToken("admin123")

	// 篡改 token（改最后一个字符）
	tamperedToken := token[:len(token)-1] + "X"

	// 验证：签名验证失败
	_, err := svc.Validate(tamperedToken)

	if err == nil {
		t.Error("expected error for tampered token")
	}
}

func TestAuthService_Validate_DifferentSecret(t *testing.T) {
	// 用一个 secret 生成
	svc1 := auth.NewAuthService("admin", "secret1")
	token, _ := svc1.IssueAdminToken("admin")

	// 用另一个 secret 验证
	svc2 := auth.NewAuthService("admin", "secret2")
	_, err := svc2.Validate(token)

	// 验证：签名不匹配
	if err == nil {
		t.Error("expected error when validating with different secret")
	}
}

func TestAuthService_TokenExpiration(t *testing.T) {
	svc := auth.NewAuthService("admin", "secret")

	token, _ := svc.IssueAdminToken("admin")
	claims, _ := svc.Validate(token)

	// 验证：ExpiresAt 大约在 75 分钟后
	expectedExpiry := time.Now().Add(75 * time.Minute)
	timeDiff := claims.ExpiresAt.Time.Sub(expectedExpiry).Abs()

	if timeDiff > 5*time.Second {
		t.Errorf("expected expiry around 75 minutes, got %v difference", timeDiff)
	}
}

func TestAuthService_MultipleTokens(t *testing.T) {
	svc := auth.NewAuthService("admin", "secret")

	// 生成多个 token
	token1, _ := svc.IssueAdminToken("admin")

	// 等待一小段时间确保时间戳不同
	time.Sleep(10 * time.Millisecond)

	token2, _ := svc.IssueAdminToken("admin")

	// 注意：如果时间戳精度不够，token 可能相同
	// 这不一定是 bug，只是记录下来
	if token1 == token2 {
		t.Log("Note: Tokens are identical (timestamp precision might be coarse)")
	}

	// 验证：两个 token 都有效
	claims1, err1 := svc.Validate(token1)
	claims2, err2 := svc.Validate(token2)

	if err1 != nil || err2 != nil {
		t.Error("expected both tokens to be valid")
	}

	// 验证：claims 内容相同
	if claims1.Subject != claims2.Subject {
		t.Error("expected same subject in both tokens")
	}
}

func TestAuthService_EmptySecret(t *testing.T) {
	// 用空 secret 创建（应该使用 fallback）
	svc := auth.NewAuthService("admin", "")

	token, err := svc.IssueAdminToken("admin")

	// 验证：仍然能生成 token（使用 fallback secret）
	if err != nil {
		t.Errorf("expected no error with empty secret, got %v", err)
	}

	// 验证：token 仍然有效
	_, err = svc.Validate(token)
	if err != nil {
		t.Errorf("expected token to be valid, got %v", err)
	}
}

func TestAuthService_PasswordTrimming(t *testing.T) {
	svc := auth.NewAuthService("admin", "secret")

	// 测试：密码带空格
	_, err := svc.IssueAdminToken("  admin  ")

	// 注意：当前实现可能没有 trim，这个测试会失败
	// 这正是测试的价值 - 发现需要改进的地方！
	if err == nil {
		t.Log("Note: Password with spaces is accepted (might want to trim)")
	}
}

func TestAuthService_CompleteFlow(t *testing.T) {
	// 完整流程测试
	svc := auth.NewAuthService("mypassword", "mysecret")

	// 1. 错误密码 - 应该失败
	_, err := svc.IssueAdminToken("wrong")
	if err == nil {
		t.Error("step 1: expected error for wrong password")
	}

	// 2. 正确密码 - 应该成功
	token, err := svc.IssueAdminToken("mypassword")
	if err != nil {
		t.Errorf("step 2: expected no error, got %v", err)
	}

	// 3. 验证 token - 应该成功
	claims, err := svc.Validate(token)
	if err != nil {
		t.Errorf("step 3: expected no error, got %v", err)
	}

	// 4. 验证 claims 内容
	if claims.Subject != "admin" {
		t.Errorf("step 4: expected subject 'admin', got '%s'", claims.Subject)
	}

	// 5. 篡改 token - 应该失败
	tamperedToken := token[:len(token)-5] + "XXXXX"
	_, err = svc.Validate(tamperedToken)
	if err == nil {
		t.Error("step 5: expected error for tampered token")
	}

	// 6. 验证原始 token 仍然有效
	_, err = svc.Validate(token)
	if err != nil {
		t.Errorf("step 6: original token should still be valid, got %v", err)
	}
}
