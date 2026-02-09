package runner

import (
	"context"
	"sync/atomic"
)

// Limiter controls concurrent execution slots using a semaphore pattern.
type Limiter struct {
	sem     chan struct{}
	max     int
	queued  atomic.Int64
}

func NewLimiter(maxConcurrent int) *Limiter {
	return &Limiter{
		sem: make(chan struct{}, maxConcurrent),
		max: maxConcurrent,
	}
}

// Acquire blocks until a slot is available or ctx is cancelled.
// Returns nil on success, ctx.Err() on timeout/cancel.
func (l *Limiter) Acquire(ctx context.Context) error {
	l.queued.Add(1)
	defer l.queued.Add(-1)

	select {
	case l.sem <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (l *Limiter) Release() {
	<-l.sem
}

func (l *Limiter) InUse() int {
	return len(l.sem)
}

func (l *Limiter) Queued() int {
	return int(l.queued.Load())
}

func (l *Limiter) Max() int {
	return l.max
}
