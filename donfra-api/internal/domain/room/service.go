package room

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"
)

type Service struct {
	store    Store
	passcode string
	baseURL  string
}

func NewService(store Store, passcode, baseURL string) *Service {
	return &Service{store: store, passcode: passcode, baseURL: baseURL}
}

func (s *Service) Init(pass string) (string, string, error) {
	if strings.TrimSpace(pass) != s.passcode {
		return "", "", errors.New("invalid passcode")
	}
	if s.store.IsOpen() {
		return "", "", errors.New("room already open")
	}
	b := make([]byte, 24)
	rand.Read(b)
	token := base64.RawURLEncoding.EncodeToString(b)
	s.store.SetOpen(token)
	inviteURL := "/coding?invite=" + token + "&role=agent"

	return strings.TrimRight(s.baseURL, "/") + inviteURL, token, nil
}

func (s *Service) IsOpen() bool { return s.store.IsOpen() }
func (s *Service) InviteLink() string {
	if !s.store.IsOpen() {
		return ""
	}
	return strings.TrimRight(s.baseURL, "/") + "/coding?invite=" + s.store.InviteLink()
}
func (s *Service) Validate(t string) bool { return s.store.Validate(strings.TrimSpace(t)) }
func (s *Service) Close() error           { return s.store.Close() }
