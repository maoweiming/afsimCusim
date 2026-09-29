package ws

import (
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 4096
)

// Client represents a single WebSocket connection to a browser.
type Client struct {
	hub *Hub

	// The websocket connection.
	conn *websocket.Conn

	// Buffered channel of outbound messages.
	send chan []byte

	// Once ensures cleanup only runs once.
	once sync.Once

	logger *slog.Logger
}

// NewClient creates a new WebSocket client.
func NewClient(hub *Hub, conn *websocket.Conn, logger *slog.Logger) *Client {
	if logger == nil {
		logger = slog.Default()
	}
	return &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
		logger: logger,
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub.
// It reads control messages (ping/pong/close) and any incoming JSON from
// the browser (currently informational only; the gateway is primarily
// a server-to-client event stream).
func (c *Client) ReadPump() {
	defer c.cleanup()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				c.logger.Error("websocket read error", "error", err)
			}
			return
		}

		// Parse incoming messages from the browser.
		// Currently we log them; future versions may handle client commands.
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			c.logger.Warn("failed to parse client message", "error", err)
			continue
		}
		c.logger.Debug("received client message", "msg", msg)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.cleanup()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				c.logger.Error("websocket write error", "error", err)
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// cleanup removes the client from the hub and closes the connection.
func (c *Client) cleanup() {
	c.once.Do(func() {
		c.hub.Unregister(c)
		c.conn.Close()
	})
}
