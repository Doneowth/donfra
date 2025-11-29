package room

type State struct {
	Open        bool
	InviteToken string
	Headcount   int
}
