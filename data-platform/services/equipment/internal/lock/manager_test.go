package lock

import (
	"testing"
	"time"
)

func TestAcquire(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	// Acquire a lock
	lock, err := m.Acquire("eq1", "user1", "User One", "edit")
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}
	if lock.ObjectID != "eq1" {
		t.Errorf("expected objectID eq1, got %s", lock.ObjectID)
	}
	if lock.UserID != "user1" {
		t.Errorf("expected userID user1, got %s", lock.UserID)
	}
}

func TestAcquireConflict(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	_, err := m.Acquire("eq1", "user1", "User One", "edit")
	if err != nil {
		t.Fatalf("First acquire failed: %v", err)
	}

	// Second user should fail
	_, err = m.Acquire("eq1", "user2", "User Two", "edit")
	if err != ErrAlreadyLocked {
		t.Errorf("expected ErrAlreadyLocked, got %v", err)
	}
}

func TestAcquireSameUserRefresh(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	lock1, _ := m.Acquire("eq1", "user1", "User One", "edit")
	firstExpiresAt := lock1.ExpiresAt

	time.Sleep(time.Millisecond)

	lock2, err := m.Acquire("eq1", "user1", "User One", "edit")
	if err != nil {
		t.Fatalf("Same user re-acquire should succeed: %v", err)
	}
	if !lock2.ExpiresAt.After(firstExpiresAt) {
		t.Error("re-acquire should refresh TTL")
	}
}

func TestRelease(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	_, _ = m.Acquire("eq1", "user1", "User One", "edit")

	err := m.Release("eq1", "user1")
	if err != nil {
		t.Fatalf("Release failed: %v", err)
	}

	// Should be able to acquire again
	_, err = m.Acquire("eq1", "user2", "User Two", "edit")
	if err != nil {
		t.Fatalf("Acquire after release should succeed: %v", err)
	}
}

func TestReleaseNotOwner(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	_, _ = m.Acquire("eq1", "user1", "User One", "edit")

	err := m.Release("eq1", "user2")
	if err != ErrNotOwner {
		t.Errorf("expected ErrNotOwner, got %v", err)
	}
}

func TestReleaseNotLocked(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	err := m.Release("eq1", "user1")
	if err != ErrNotLocked {
		t.Errorf("expected ErrNotLocked, got %v", err)
	}
}

func TestIsLocked(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	if m.IsLocked("eq1") {
		t.Error("should not be locked before acquire")
	}

	_, _ = m.Acquire("eq1", "user1", "User One", "edit")
	if !m.IsLocked("eq1") {
		t.Error("should be locked after acquire")
	}

	_ = m.Release("eq1", "user1")
	if m.IsLocked("eq1") {
		t.Error("should not be locked after release")
	}
}

func TestGetLock(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	if l := m.GetLock("eq1"); l != nil {
		t.Error("GetLock should return nil for unlocked object")
	}

	_, _ = m.Acquire("eq1", "user1", "User One", "edit")
	l := m.GetLock("eq1")
	if l == nil {
		t.Fatal("GetLock should return lock after acquire")
	}
	if l.UserID != "user1" {
		t.Errorf("expected user1, got %s", l.UserID)
	}
}

func TestExpiredLock(t *testing.T) {
	m := NewManager()
	defer m.Stop()

	lock := &Lock{
		ObjectID:  "eq1",
		UserID:    "user1",
		ExpiresAt: time.Now().Add(-1 * time.Minute),
	}

	if !lock.IsExpired() {
		t.Error("lock should be expired")
	}
}
