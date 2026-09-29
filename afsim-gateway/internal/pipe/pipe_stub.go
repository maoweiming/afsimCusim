//go:build !windows

// Package pipe provides a stub implementation for non-Windows platforms.
// The actual named pipe functionality is only available on Windows.
package pipe

import (
	"context"
	"fmt"
	"net"
	"time"

	"log/slog"
)

// Dial is a stub that returns an error on non-Windows platforms.
func Dial(_ context.Context, pipePath string, _ time.Duration, _ *slog.Logger) (net.Conn, error) {
	return nil, fmt.Errorf("named pipes are not supported on this platform (requested: %s); Windows is required", pipePath)
}

// ReadMessage is a stub that returns an error on non-Windows platforms.
func ReadMessage(_ net.Conn) ([]byte, error) {
	return nil, fmt.Errorf("named pipes are not supported on this platform; Windows is required")
}

// WriteMessage is a stub that returns an error on non-Windows platforms.
func WriteMessage(_ net.Conn, _ []byte) error {
	return fmt.Errorf("named pipes are not supported on this platform; Windows is required")
}
