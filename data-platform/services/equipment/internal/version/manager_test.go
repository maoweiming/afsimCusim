package version

import (
	"context"
	"testing"

	"go.mongodb.org/mongo-driver/bson"

	"truesim/equipment/internal/model"
)

// mockStore implements StoreInterface for testing.
type mockStore struct {
	equipment map[string]*model.Equipment
}

func newMockStore() *mockStore {
	return &mockStore{
		equipment: make(map[string]*model.Equipment),
	}
}

func (m *mockStore) Get(_ context.Context, id string) (*model.Equipment, error) {
	eq, ok := m.equipment[id]
	if !ok {
		return nil, nil
	}
	// Return a copy
	copy := *eq
	copy.VersionHistory = make([]model.VersionEntry, len(eq.VersionHistory))
	for i, v := range eq.VersionHistory {
		copy.VersionHistory[i] = v
	}
	return &copy, nil
}

func (m *mockStore) Update(_ context.Context, eq *model.Equipment) error {
	m.equipment[eq.ID] = eq
	return nil
}

func (m *mockStore) UpdateSubsystems(_ context.Context, _ string, _ bson.M) error {
	return nil
}

func TestCreateVersion(t *testing.T) {
	ms := newMockStore()
	ms.equipment["eq1"] = &model.Equipment{
		ID:       "eq1",
		Name:     "Test Equipment",
		Code:     "TST-001",
		Version:  1,
		Status:   "active",
	}

	mgr := NewManager(ms)

	entry, err := mgr.CreateVersion(context.Background(), "eq1", "testuser", "initial version")
	if err != nil {
		t.Fatalf("CreateVersion failed: %v", err)
	}
	if entry.Version != 1 {
		t.Errorf("expected version 1, got %d", entry.Version)
	}
	if entry.Author != "testuser" {
		t.Errorf("expected author testuser, got %s", entry.Author)
	}
	if entry.Message != "initial version" {
		t.Errorf("expected message 'initial version', got %s", entry.Message)
	}

	// Verify equipment was updated
	eq := ms.equipment["eq1"]
	if eq.Version != 2 {
		t.Errorf("expected equipment version 2 after CreateVersion, got %d", eq.Version)
	}
	if len(eq.VersionHistory) != 1 {
		t.Errorf("expected 1 version history entry, got %d", len(eq.VersionHistory))
	}
}

func TestGetHistory(t *testing.T) {
	ms := newMockStore()
	ms.equipment["eq1"] = &model.Equipment{
		ID:      "eq1",
		Name:    "Test",
		Version: 3,
		VersionHistory: []model.VersionEntry{
			{Version: 1, Author: "user1", Message: "first"},
			{Version: 2, Author: "user2", Message: "second"},
		},
	}

	mgr := NewManager(ms)

	history, err := mgr.GetHistory(context.Background(), "eq1")
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(history) != 2 {
		t.Errorf("expected 2 history entries, got %d", len(history))
	}
	if history[0].Author != "user1" {
		t.Errorf("expected author user1, got %s", history[0].Author)
	}
}

func TestCompareVersions(t *testing.T) {
	ms := newMockStore()

	eq := &model.Equipment{
		ID:      "eq1",
		Name:    "Test Original",
		Version: 3,
		VersionHistory: []model.VersionEntry{
			{
				Version: 1,
				Snapshot: model.Equipment{
					ID:   "eq1",
					Name: "Test V1",
				},
			},
			{
				Version: 2,
				Snapshot: model.Equipment{
					ID:   "eq1",
					Name: "Test V2",
				},
			},
		},
	}
	ms.equipment["eq1"] = eq

	mgr := NewManager(ms)

	diffs, err := mgr.CompareVersions(context.Background(), "eq1", 1, 2)
	if err != nil {
		t.Fatalf("CompareVersions failed: %v", err)
	}

	foundNameChange := false
	for _, d := range diffs {
		if d.Path == "name" && d.OldValue == "Test V1" && d.NewValue == "Test V2" {
			foundNameChange = true
		}
	}
	if !foundNameChange {
		t.Error("expected name diff between V1 and V2")
	}
}

func TestCompareVersionsNotFound(t *testing.T) {
	ms := newMockStore()
	ms.equipment["eq1"] = &model.Equipment{
		ID:      "eq1",
		Version: 1,
	}

	mgr := NewManager(ms)

	_, err := mgr.CompareVersions(context.Background(), "eq1", 1, 2)
	if err == nil {
		t.Error("expected error for missing version")
	}
}

func TestRollback(t *testing.T) {
	ms := newMockStore()

	snapshot := model.Equipment{
		ID:      "eq1",
		Name:    "Original Name",
		Code:    "TST-001",
		Version: 1,
	}

	eq := &model.Equipment{
		ID:      "eq1",
		Name:    "Modified Name",
		Code:    "TST-001",
		Version: 3,
		VersionHistory: []model.VersionEntry{
			{
				Version:  1,
				Author:   "user1",
				Message:  "created",
				Snapshot: snapshot,
			},
		},
	}
	ms.equipment["eq1"] = eq

	mgr := NewManager(ms)

	err := mgr.Rollback(context.Background(), "eq1", 1, "admin")
	if err != nil {
		t.Fatalf("Rollback failed: %v", err)
	}

	// Verify the rollback
	restored := ms.equipment["eq1"]
	if restored.Name != "Original Name" {
		t.Errorf("expected name 'Original Name' after rollback, got '%s'", restored.Name)
	}
	if restored.Version != 4 { // was 3, +1 for rollback
		t.Errorf("expected version 4 after rollback, got %d", restored.Version)
	}
}
