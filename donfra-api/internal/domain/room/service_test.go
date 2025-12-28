package room_test

import (
	"context"
	"strings"
	"testing"

	"donfra-api/internal/domain/room"
)

func TestRoomService_Init_Success(t *testing.T) {
	repo := room.NewMemoryRepository()
	svc := room.NewService(repo, "7777", "http://localhost:3000")
	ctx := context.Background()

	url, token, err := svc.Init(ctx, "7777", 10)

	// 验证：成功开启
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	// 验证：生成了 token
	if token == "" {
		t.Error("expected token to be generated")
	}

	// 验证：invite URL 包含 baseURL, room_id, token 和 role
	// URL format: http://localhost:3000/coding?room_id=<uuid>&invite=<token>&role=agent
	if !strings.Contains(url, "http://localhost:3000/coding?room_id=") {
		t.Errorf("expected URL to start with 'http://localhost:3000/coding?room_id=', got '%s'", url)
	}
	if !strings.Contains(url, "&invite="+token) {
		t.Errorf("expected URL to contain '&invite=%s', got '%s'", token, url)
	}
	if !strings.Contains(url, "&role=agent") {
		t.Errorf("expected URL to contain '&role=agent', got '%s'", url)
	}

	// 验证：房间状态正确
	if !svc.IsOpen(ctx) {
		t.Error("expected room to be open")
	}

	if svc.Limit(ctx) != 10 {
		t.Errorf("expected limit to be 10, got %d", svc.Limit(ctx))
	}
}

func TestRoomService_Init_WrongPasscode(t *testing.T) {
	repo := room.NewMemoryRepository()
	svc := room.NewService(repo, "7777", "http://localhost:3000")
	ctx := context.Background()

	_, _, err := svc.Init(ctx, "wrong", 10)

	// 验证：返回错误
	if err == nil {
		t.Error("expected error for wrong passcode")
	}

	// 验证：错误消息正确
	expectedMsg := "invalid passcode"
	if err.Error() != expectedMsg {
		t.Errorf("expected error message '%s', got '%s'", expectedMsg, err.Error())
	}

	// 验证：房间未开启
	if svc.IsOpen(ctx) {
		t.Error("expected room to remain closed")
	}
}

func TestRoomService_Init_AlreadyOpen(t *testing.T) {
	repo := room.NewMemoryRepository()
	svc := room.NewService(repo, "7777", "http://localhost:3000")
	ctx := context.Background()

	// 第一次成功开启
	_, _, err := svc.Init(ctx, "7777", 10)
	if err != nil {
		t.Fatal(err)
	}

	// 第二次尝试开启应该失败
	_, _, err = svc.Init(ctx, "7777", 10)
	if err == nil {
		t.Error("expected error when room already open")
	}

	expectedMsg := "room already open"
	if err.Error() != expectedMsg {
		t.Errorf("expected error message '%s', got '%s'", expectedMsg, err.Error())
	}
}

func TestRoomService_Init_DefaultLimit(t *testing.T) {
	repo := room.NewMemoryRepository()
	svc := room.NewService(repo, "7777", "http://localhost:3000")
	ctx := context.Background()

	// 传入 0 应该使用默认值 2
	_, _, err := svc.Init(ctx, "7777", 0)
	if err != nil {
		t.Fatal(err)
	}

	if svc.Limit(ctx) != 2 {
		t.Errorf("expected default limit to be 2, got %d", svc.Limit(ctx))
	}
}

func TestRoomService_Close(t *testing.T) {
	repo := room.NewMemoryRepository()
	svc := room.NewService(repo, "7777", "http://localhost:3000")
	ctx := context.Background()

	// 开启房间
	_, _, err := svc.Init(ctx, "7777", 10)
	if err != nil {
		t.Fatal(err)
	}

	if !svc.IsOpen(ctx) {
		t.Error("expected room to be open")
	}

	// 关闭房间
	err = svc.Close(ctx)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	// 验证：房间已关闭
	if svc.IsOpen(ctx) {
		t.Error("expected room to be closed")
	}

	// 验证：状态已清空
	if svc.InviteLink(ctx) != "" {
		t.Error("expected invite link to be empty after close")
	}
}

func TestRoomService_Validate(t *testing.T) {
	repo := room.NewMemoryRepository()
	svc := room.NewService(repo, "7777", "http://localhost:3000")
	ctx := context.Background()

	// 开启房间
	_, token, err := svc.Init(ctx, "7777", 10)
	if err != nil {
		t.Fatal(err)
	}

	// 验证：正确的 token
	if !svc.Validate(ctx, token) {
		t.Error("expected token to be valid")
	}

	// 验证：错误的 token
	if svc.Validate(ctx, "wrong_token") {
		t.Error("expected wrong token to be invalid")
	}

	// 关闭房间后 token 应该无效
	svc.Close(ctx)
	if svc.Validate(ctx, token) {
		t.Error("expected token to be invalid after room closed")
	}
}

func TestRoomService_UpdateHeadcount(t *testing.T) {
	repo := room.NewMemoryRepository()
	svc := room.NewService(repo, "7777", "http://localhost:3000")
	ctx := context.Background()

	// 开启房间
	_, _, err := svc.Init(ctx, "7777", 10)
	if err != nil {
		t.Fatal(err)
	}

	// 初始人数为 0
	if svc.Headcount(ctx) != 0 {
		t.Errorf("expected initial headcount to be 0, got %d", svc.Headcount(ctx))
	}

	// 更新人数
	err = svc.UpdateHeadcount(ctx, 5)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	if svc.Headcount(ctx) != 5 {
		t.Errorf("expected headcount to be 5, got %d", svc.Headcount(ctx))
	}
}

func TestRoomService_InviteLink(t *testing.T) {
	repo := room.NewMemoryRepository()
	svc := room.NewService(repo, "7777", "http://localhost:3000")
	ctx := context.Background()

	// 房间未开启时，invite link 应该为空
	if svc.InviteLink(ctx) != "" {
		t.Error("expected invite link to be empty when room is closed")
	}

	// 开启房间
	url, token, err := svc.Init(ctx, "7777", 10)
	if err != nil {
		t.Fatal(err)
	}

	// 验证：invite link 包含必要组件
	inviteLink := svc.InviteLink(ctx)
	if !strings.Contains(inviteLink, "http://localhost:3000/coding?room_id=") {
		t.Errorf("expected invite link to start with 'http://localhost:3000/coding?room_id=', got '%s'", inviteLink)
	}
	if !strings.Contains(inviteLink, "&invite="+token) {
		t.Errorf("expected invite link to contain '&invite=%s', got '%s'", token, inviteLink)
	}
	if !strings.Contains(inviteLink, "&role=agent") {
		t.Errorf("expected invite link to contain '&role=agent', got '%s'", inviteLink)
	}

	// 验证：与 Init 返回的 URL 一致
	if inviteLink != url {
		t.Errorf("expected invite link to match URL returned by Init\nInviteLink: %s\nURL: %s", inviteLink, url)
	}
}
