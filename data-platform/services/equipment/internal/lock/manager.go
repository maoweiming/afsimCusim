package lock

import (
	"errors"
	"sync"
	"time"
)

var (
	ErrAlreadyLocked = errors.New("object is already locked by another user")
	ErrNotLocked     = errors.New("object is not locked")
	ErrNotOwner      = errors.New("user does not hold the lock")
)

const (
	defaultLockTTL = 30 * time.Minute
	cleanupInterval = 5 * time.Minute
)

// Lock represents an active lock on an equipment object.
type Lock struct {
	ObjectID  string
	UserID    string
	UserName  string
	LockType  string // "edit" or "view"
	LockedAt  time.Time
	ExpiresAt time.Time
}

// IsExpired returns true if the lock has expired.
func (l *Lock) IsExpired() bool {
	return time.Now().After(l.ExpiresAt)
}

// Manager manages in-memory locks for equipment objects with automatic expiration.
type Manager struct {
	mu       sync.RWMutex
	locks    map[string]*Lock
	stopOnce sync.Once
	stopCh   chan struct{}
}

// NewManager creates a new LockManager and starts the background cleanup goroutine.
func NewManager() *Manager {
	m := &Manager{
		locks:  make(map[string]*Lock),
		stopCh: make(chan struct{}),
	}
	go m.cleanupLoop()
	return m
}

// Acquire attempts to acquire a lock on the given object.
// Returns the lock if successful, or an error if the object is already locked.
func (m *Manager) Acquire(objectID, userID, userName, lockType string) (*Lock, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check existing lock
	if existing, ok := m.locks[objectID]; ok {
		if !existing.IsExpired() {
			if existing.UserID == userID {
				// Same user re-acquiring: refresh the TTL
				existing.ExpiresAt = time.Now().Add(defaultLockTTL)
				return existing, nil
			}
			return nil, ErrAlreadyLocked
		}
		// Expired lock, clean it up
		delete(m.locks, objectID)
	}

	lock := &Lock{
		ObjectID:  objectID,
		UserID:    userID,
		UserName:  userName,
		LockType:  lockType,
		LockedAt:  time.Now(),
		ExpiresAt: time.Now().Add(defaultLockTTL),
	}
	m.locks[objectID] = lock
	return lock, nil
}

// Release releases the lock on the given object if the user is the lock owner.
func (m *Manager) Release(objectID, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	lock, ok := m.locks[objectID]
	if !ok {
		return ErrNotLocked
	}
	if lock.UserID != userID {
		return ErrNotOwner
	}
	delete(m.locks, objectID)
	return nil
}

// IsLocked returns true if the object has a non-expired lock.
func (m *Manager) IsLocked(objectID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	lock, ok := m.locks[objectID]
	if !ok {
		return false
	}
	if lock.IsExpired() {
		return false
	}
	return true
}

// GetLock returns the current lock for the object, or nil if not locked or expired.
func (m *Manager) GetLock(objectID string) *Lock {
	m.mu.RLock()
	defer m.mu.RUnlock()

	lock, ok := m.locks[objectID]
	if !ok || lock.IsExpired() {
		return nil
	}
	return lock
}

// Stop stops the background cleanup goroutine.
func (m *Manager) Stop() {
	m.stopOnce.Do(func() {
		close(m.stopCh)
	})
}

// cleanupLoop periodically removes expired locks.
func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.cleanup()
		case <-m.stopCh:
			return
		}
	}
}

func (m *Manager) cleanup() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for id, lock := range m.locks {
		if now.After(lock.ExpiresAt) {
			delete(m.locks, id)
		}
	}
}
