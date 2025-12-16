package room

import (
	"context"
	"log"
	"strconv"

	"github.com/redis/go-redis/v9"
)

// HeadcountSubscriber subscribes to Redis Pub/Sub for headcount updates.
type HeadcountSubscriber struct {
	client *redis.Client
	repo   Repository
	cancel context.CancelFunc
}

// NewHeadcountSubscriber creates a new headcount subscriber.
func NewHeadcountSubscriber(client *redis.Client, repo Repository) *HeadcountSubscriber {
	return &HeadcountSubscriber{
		client: client,
		repo:   repo,
	}
}

// Start begins listening for headcount updates on the Redis Pub/Sub channel.
// This should be called in a goroutine as it blocks until the context is cancelled.
func (s *HeadcountSubscriber) Start(ctx context.Context) error {
	pubsub := s.client.Subscribe(ctx, "room:state:headcount")
	defer pubsub.Close()

	// Wait for subscription confirmation
	if _, err := pubsub.Receive(ctx); err != nil {
		return err
	}

	log.Println("[pubsub] Subscribed to room:state:headcount channel")

	// Listen for messages
	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			log.Println("[pubsub] Headcount subscriber shutting down")
			return ctx.Err()
		case msg := <-ch:
			if msg == nil {
				continue
			}
			s.handleHeadcountUpdate(ctx, msg.Payload)
		}
	}
}

// handleHeadcountUpdate processes incoming headcount messages.
func (s *HeadcountSubscriber) handleHeadcountUpdate(ctx context.Context, payload string) {
	count, err := strconv.Atoi(payload)
	if err != nil {
		log.Printf("[pubsub] Invalid headcount payload: %s (error: %v)", payload, err)
		return
	}

	// Update headcount in repository
	state, err := s.repo.GetState(ctx)
	if err != nil {
		log.Printf("[pubsub] Failed to get room state: %v", err)
		return
	}

	state.Headcount = count
	if err := s.repo.SaveState(ctx, state); err != nil {
		log.Printf("[pubsub] Failed to update headcount: %v", err)
		return
	}

	log.Printf("[pubsub] Updated headcount to %d", count)
}
