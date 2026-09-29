// Package subscriber listens for cross-service events via NATS.
package subscriber

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/nats-io/nats.go"

	"truesim/scenario/internal/store"
)

// EquipmentChangeEvent matches the event published by equipment-svc.
type EquipmentChangeEvent struct {
	EquipmentID string `json:"equipment_id"`
	ChangeType  string `json:"change_type"` // created, updated, deleted
	Version     int32  `json:"version"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Timestamp   string `json:"timestamp"`
}

// EquipmentSubscriber listens for equipment change events and marks affected scenarios.
type EquipmentSubscriber struct {
	nc    *nats.Conn
	store *store.MongoStore
	sub   *nats.Subscription
}

// NewEquipmentSubscriber creates a new subscriber.
func NewEquipmentSubscriber(nc *nats.Conn, s *store.MongoStore) *EquipmentSubscriber {
	return &EquipmentSubscriber{
		nc:    nc,
		store: s,
	}
}

// Start begins listening for equipment.changed events.
// Runs in the background; call Close() to stop.
func (es *EquipmentSubscriber) Start() error {
	sub, err := es.nc.Subscribe("equipment.changed", es.handleEvent)
	if err != nil {
		return err
	}
	es.sub = sub
	log.Println("[subscriber] listening on equipment.changed")
	return nil
}

// Close stops the subscriber.
func (es *EquipmentSubscriber) Close() {
	if es.sub != nil {
		es.sub.Unsubscribe()
	}
}

func (es *EquipmentSubscriber) handleEvent(msg *nats.Msg) {
	var event EquipmentChangeEvent
	if err := json.Unmarshal(msg.Data, &event); err != nil {
		log.Printf("[subscriber] failed to unmarshal equipment.changed event: %v", err)
		return
	}

	log.Printf("[subscriber] equipment changed: %s (%s) v%d", event.EquipmentID, event.ChangeType, event.Version)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	scenarios, err := es.store.FindScenariosByEquipmentID(ctx, event.EquipmentID)
	if err != nil {
		log.Printf("[subscriber] failed to find affected scenarios: %v", err)
		return
	}

	if len(scenarios) == 0 {
		return
	}

	log.Printf("[subscriber] %d scenario(s) reference equipment %s — equipment %s to v%d",
		len(scenarios), event.EquipmentID, event.ChangeType, event.Version)

	for _, sc := range scenarios {
		// Count how many platforms reference this equipment
		affected := 0
		for _, p := range sc.Platforms {
			eqID := p.GetEffectiveEquipmentID()
			if eqID == event.EquipmentID {
				affected++
			}
		}
		log.Printf("[subscriber]   scenario %q (%s): %d platform(s) affected", sc.Name, sc.ID, affected)
	}

	// Future: update scenario metadata with stale_equipment flags,
	// push WebSocket notification to connected editors, etc.
}
