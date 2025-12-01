package room

import "sync"

type memoryStore struct {
	mu   sync.Mutex
	data State
}

func NewMemoryStore() Store { return &memoryStore{data: State{}} }

func (m *memoryStore) SetOpen(token string, limit int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if limit <= 0 {
		limit = 2
	}
	m.data.Open = true
	m.data.InviteToken = token
	m.data.Limit = limit
	m.data.Headcount = 0
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
	m.data.InviteToken = ""
	m.data.Headcount = 0
	m.data.Limit = 0
	return nil
}

func (m *memoryStore) InviteLink() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.data.InviteToken
}

func (m *memoryStore) UpdateHeadcount(n int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data.Headcount = n
	return nil
}

func (m *memoryStore) Headcount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.data.Headcount
}

func (m *memoryStore) Limit() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.data.Limit
}
