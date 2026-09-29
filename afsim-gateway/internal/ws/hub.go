package ws

import (
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/truesim/afsim-gateway/internal/simstate"
)

// Hub maintains the set of active WebSocket clients and broadcasts messages to them.
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}

	// Broadcast queue: events are sent to all connected clients.
	broadcast chan []byte

	// Register/unregister channels for client lifecycle.
	register   chan *Client
	unregister chan *Client

	state *simstate.SimulationState
	logger *slog.Logger
}

// NewHub creates a new Hub. The hub reads from the simulation state to provide
// snapshots for newly connected clients.
func NewHub(state *simstate.SimulationState, logger *slog.Logger) *Hub {
	if logger == nil {
		logger = slog.Default()
	}
	return &Hub{
		clients:    make(map[*Client]struct{}),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		state:      state,
		logger:     logger,
	}
}

// Run starts the hub's main loop. It should be called in a goroutine.
// It exits when the provided done channel is closed.
func (h *Hub) Run(done <-chan struct{}) {
	for {
		select {
		case <-done:
			h.mu.Lock()
			for client := range h.clients {
				close(client.send)
			}
			h.clients = make(map[*Client]struct{})
			h.mu.Unlock()
			return

		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = struct{}{}
			h.mu.Unlock()

			// Send full snapshot to the newly connected client
			snapshot := h.state.Snapshot()
			msg := WSMessage{
				Type:    MsgFullSnapshot,
				SimTime: h.state.GetSimTime(),
				Payload: json.RawMessage(snapshot),
			}
			data, err := json.Marshal(msg)
			if err != nil {
				h.logger.Error("failed to marshal snapshot", "error", err)
				continue
			}

			select {
			case client.send <- data:
			default:
				// Client buffer full; close it
				h.mu.Lock()
				delete(h.clients, client)
				close(client.send)
				h.mu.Unlock()
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Slow client; drop them
					h.mu.RUnlock()
					h.mu.Lock()
					delete(h.clients, client)
					close(client.send)
					h.mu.Unlock()
					h.mu.RLock()
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a raw JSON message to all connected clients.
func (h *Hub) Broadcast(msg []byte) {
	select {
	case h.broadcast <- msg:
	default:
		h.logger.Warn("broadcast channel full, dropping message")
	}
}

// BroadcastEvent creates a WSMessage from an event type and payload, then broadcasts it.
func (h *Hub) BroadcastEvent(eventType string, simTime float64, payload interface{}) {
	msg := WSMessage{
		Type:    eventType,
		SimTime: simTime,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		h.logger.Error("failed to marshal broadcast event", "type", eventType, "error", err)
		return
	}
	h.Broadcast(data)
}

// Register registers a client with the hub.
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub.
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
