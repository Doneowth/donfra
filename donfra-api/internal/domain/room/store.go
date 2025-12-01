package room

type Store interface {
	SetOpen(token string, limit int) error
	IsOpen() bool
	Validate(string) bool
	InviteLink() string
	Close() error
	UpdateHeadcount(int) error
	Headcount() int
	Limit() int
}
