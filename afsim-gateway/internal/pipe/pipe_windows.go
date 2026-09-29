//go:build windows

package pipe

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"net"
	"time"

	"github.com/Microsoft/go-winio"
	"golang.org/x/sys/windows"
)

// PipeAccessMode controls the access mode when connecting to a named pipe.
type PipeAccessMode int

const (
	AccessReadWrite PipeAccessMode = iota
	AccessReadOnly
	AccessWriteOnly
)

// Dial connects to a Windows named pipe at the given path.
func Dial(ctx context.Context, pipePath string, retryInterval time.Duration, logger *slog.Logger) (net.Conn, error) {
	return DialWithAccess(ctx, pipePath, retryInterval, AccessReadWrite, logger)
}

// DialWithAccess connects to a Windows named pipe with a specific access mode.
func DialWithAccess(ctx context.Context, pipePath string, retryInterval time.Duration, access PipeAccessMode, logger *slog.Logger) (net.Conn, error) {
	if logger == nil {
		logger = slog.Default()
	}

	for {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("pipe dial cancelled: %w", ctx.Err())
		default:
		}

		conn, err := dialPipeWithAccess(ctx, pipePath, access)
		if err == nil {
			logger.Info("connected to named pipe", "path", pipePath, "access", accessModeString(access))
			return conn, nil
		}

		logger.Info("pipe not available, retrying", "path", pipePath, "error", err, "retry_in", retryInterval)

		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("pipe dial cancelled: %w", ctx.Err())
		case <-time.After(retryInterval):
		}
	}
}

func dialPipeWithAccess(ctx context.Context, pipePath string, access PipeAccessMode) (net.Conn, error) {
	// First try standard winio dial (GENERIC_READ | GENERIC_WRITE)
	conn, err := winio.DialPipeContext(ctx, pipePath)
	if err == nil {
		return conn, nil
	}

	// If access denied, try with specific access mode using CreateFile
	if access != AccessReadWrite {
		return dialPipeCreateFile(pipePath, access)
	}

	return nil, err
}

func dialPipeCreateFile(pipePath string, access PipeAccessMode) (net.Conn, error) {
	var desiredAccess uint32
	switch access {
	case AccessReadOnly:
		desiredAccess = windows.GENERIC_READ
	case AccessWriteOnly:
		desiredAccess = windows.GENERIC_WRITE
	default:
		desiredAccess = windows.GENERIC_READ | windows.GENERIC_WRITE
	}

	pathPtr, err := windows.UTF16PtrFromString(pipePath)
	if err != nil {
		return nil, fmt.Errorf("pipe path encoding: %w", err)
	}

	handle, err := windows.CreateFile(
		pathPtr,
		desiredAccess,
		0,   // no sharing
		nil, // default security
		windows.OPEN_EXISTING,
		windows.FILE_FLAG_OVERLAPPED,
		0,
	)
	if err != nil {
		return nil, fmt.Errorf("CreateFile pipe: %w", err)
	}

	return newPipeConn(handle, pipePath), nil
}

func accessModeString(access PipeAccessMode) string {
	switch access {
	case AccessReadOnly:
		return "read-only"
	case AccessWriteOnly:
		return "write-only"
	default:
		return "read-write"
	}
}

// pipeConn wraps a Windows handle to implement net.Conn for named pipes
// opened with specific access modes that winio doesn't support directly.
type pipeConn struct {
	handle windows.Handle
	path   string
}

func newPipeConn(handle windows.Handle, path string) *pipeConn {
	return &pipeConn{handle: handle, path: path}
}

func (c *pipeConn) Read(b []byte) (int, error) {
	var overlapped windows.Overlapped
	overlapped.HEvent, _ = windows.CreateEvent(nil, 1, 0, nil)
	if overlapped.HEvent != 0 {
		defer windows.CloseHandle(overlapped.HEvent)
	}

	var n uint32
	err := windows.ReadFile(c.handle, b, &n, &overlapped)
	if err != nil && err != windows.ERROR_IO_PENDING {
		return 0, err
	}
	if err == windows.ERROR_IO_PENDING {
		_, err = windows.WaitForSingleObject(overlapped.HEvent, windows.INFINITE)
		if err != nil {
			return 0, err
		}
		err = windows.GetOverlappedResult(c.handle, &overlapped, &n, false)
	}
	if err != nil {
		return 0, err
	}
	if n == 0 {
		return 0, io.EOF
	}
	return int(n), nil
}

func (c *pipeConn) Write(b []byte) (int, error) {
	var overlapped windows.Overlapped
	overlapped.HEvent, _ = windows.CreateEvent(nil, 1, 0, nil)
	if overlapped.HEvent != 0 {
		defer windows.CloseHandle(overlapped.HEvent)
	}

	var n uint32
	err := windows.WriteFile(c.handle, b, &n, &overlapped)
	if err != nil && err != windows.ERROR_IO_PENDING {
		return 0, err
	}
	if err == windows.ERROR_IO_PENDING {
		_, err = windows.WaitForSingleObject(overlapped.HEvent, windows.INFINITE)
		if err != nil {
			return 0, err
		}
		err = windows.GetOverlappedResult(c.handle, &overlapped, &n, false)
	}
	if err != nil {
		return 0, err
	}
	return int(n), nil
}

func (c *pipeConn) Close() error {
	return windows.CloseHandle(c.handle)
}

func (c *pipeConn) LocalAddr() net.Addr {
	return &pipeAddr{path: c.path}
}

func (c *pipeConn) RemoteAddr() net.Addr {
	return &pipeAddr{path: c.path}
}

func (c *pipeConn) SetDeadline(t time.Time) error      { return nil }
func (c *pipeConn) SetReadDeadline(t time.Time) error   { return nil }
func (c *pipeConn) SetWriteDeadline(t time.Time) error  { return nil }

type pipeAddr struct {
	path string
}

func (a *pipeAddr) Network() string { return "pipe" }
func (a *pipeAddr) String() string  { return a.path }

// ReadMessage reads a length-prefixed message from the pipe connection.
func ReadMessage(conn net.Conn) ([]byte, error) {
	var lenBuf [4]byte
	if _, err := io.ReadFull(conn, lenBuf[:]); err != nil {
		return nil, fmt.Errorf("reading length prefix: %w", err)
	}

	msgLen := binary.LittleEndian.Uint32(lenBuf[:])
	if msgLen == 0 {
		return nil, nil
	}

	if msgLen > 64*1024*1024 {
		return nil, fmt.Errorf("message too large: %d bytes", msgLen)
	}

	buf := make([]byte, msgLen)
	if _, err := io.ReadFull(conn, buf); err != nil {
		return nil, fmt.Errorf("reading message body: %w", err)
	}

	return buf, nil
}

// WriteMessage writes a length-prefixed message to the pipe connection.
func WriteMessage(conn net.Conn, data []byte) error {
	var lenBuf [4]byte
	binary.LittleEndian.PutUint32(lenBuf[:], uint32(len(data)))

	if _, err := conn.Write(lenBuf[:]); err != nil {
		return fmt.Errorf("writing length prefix: %w", err)
	}

	if _, err := conn.Write(data); err != nil {
		return fmt.Errorf("writing message body: %w", err)
	}

	return nil
}
