package room

import "sync"

type memoryStore struct {
	mu   sync.Mutex
	data State
}

func NewMemoryStore() Store { return &memoryStore{data: State{}} }

func (m *memoryStore) SetOpen(token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data.Open = true
	m.data.InviteToken = token
	return nil
}

func (m *memoryStore) IsOpen() bool { m.mu.Lock(); defer m.mu.Unlock(); return m.data.Open }

func (m *memoryStore) Validate(token string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.data.Open && token == m.data.InviteToken
}

func (m *memoryStore) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data.Open = false
	return nil
}

func (m *memoryStore) InviteLink() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.data.InviteToken
}
