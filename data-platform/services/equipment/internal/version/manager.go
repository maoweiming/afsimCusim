package version

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"

	"truesim/equipment/internal/model"
	"truesim/equipment/internal/store"
)

var (
	ErrVersionNotFound = errors.New("version not found")
)

// StoreInterface defines the subset of store methods needed by the version manager.
type StoreInterface interface {
	Get(ctx context.Context, id string) (*model.Equipment, error)
	Update(ctx context.Context, eq *model.Equipment) error
	UpdateSubsystems(ctx context.Context, id string, update bson.M) error
}

// Manager handles version management for equipment.
type Manager struct {
	store StoreInterface
}

// NewManager creates a new version manager.
func NewManager(store StoreInterface) *Manager {
	return &Manager{store: store}
}

// CreateVersion creates a new version snapshot of the equipment.
// It increments the version number, saves a full snapshot to version_history,
// and returns the new version entry.
func (m *Manager) CreateVersion(ctx context.Context, equipmentID, author, message string) (*model.VersionEntry, error) {
	eq, err := m.store.Get(ctx, equipmentID)
	if err != nil {
		return nil, fmt.Errorf("get equipment: %w", err)
	}

	entry := model.VersionEntry{
		Version:   eq.Version,
		Author:    author,
		Timestamp: time.Now(),
		Message:   message,
		Snapshot:  *deepCopy(eq),
	}

	// Append to version history and bump version
	eq.VersionHistory = append(eq.VersionHistory, entry)
	eq.Version++
	eq.UpdatedBy = author
	eq.UpdatedAt = time.Now()

	if err := m.store.Update(ctx, eq); err != nil {
		// If optimistic lock fails, re-fetch and retry once
		if errors.Is(err, store.ErrOptimisticLock) {
			eq, err = m.store.Get(ctx, equipmentID)
			if err != nil {
				return nil, fmt.Errorf("re-fetch equipment: %w", err)
			}
			eq.VersionHistory = append(eq.VersionHistory, entry)
			eq.Version++
			eq.UpdatedBy = author
			eq.UpdatedAt = time.Now()
			if err := m.store.Update(ctx, eq); err != nil {
				return nil, fmt.Errorf("update (retry): %w", err)
			}
		} else {
			return nil, fmt.Errorf("update: %w", err)
		}
	}

	return &entry, nil
}

// GetHistory returns the version history of an equipment.
func (m *Manager) GetHistory(ctx context.Context, equipmentID string) ([]model.VersionEntry, error) {
	eq, err := m.store.Get(ctx, equipmentID)
	if err != nil {
		return nil, fmt.Errorf("get equipment: %w", err)
	}
	return eq.VersionHistory, nil
}

// VersionDiffField represents a single field-level difference between two versions.
type VersionDiffField struct {
	Path     string
	OldValue string
	NewValue string
}

// CompareVersions compares two versions of an equipment and returns the differences.
func (m *Manager) CompareVersions(ctx context.Context, equipmentID string, v1, v2 int32) ([]VersionDiffField, error) {
	eq, err := m.store.Get(ctx, equipmentID)
	if err != nil {
		return nil, fmt.Errorf("get equipment: %w", err)
	}

	var snap1, snap2 *model.Equipment
	for _, entry := range eq.VersionHistory {
		if entry.Version == v1 {
			s := entry.Snapshot
			snap1 = &s
		}
		if entry.Version == v2 {
			s := entry.Snapshot
			snap2 = &s
		}
	}

	if snap1 == nil {
		return nil, fmt.Errorf("version %d: %w", v1, ErrVersionNotFound)
	}
	if snap2 == nil {
		return nil, fmt.Errorf("version %d: %w", v2, ErrVersionNotFound)
	}

	return diffEquipment(snap1, snap2), nil
}

// Rollback restores an equipment to a previous version.
func (m *Manager) Rollback(ctx context.Context, equipmentID string, targetVersion int32, author string) error {
	eq, err := m.store.Get(ctx, equipmentID)
	if err != nil {
		return fmt.Errorf("get equipment: %w", err)
	}

	// Find the target snapshot
	var snapshot *model.Equipment
	for _, entry := range eq.VersionHistory {
		if entry.Version == targetVersion {
			s := entry.Snapshot
			snapshot = &s
			break
		}
	}
	if snapshot == nil {
		return fmt.Errorf("version %d: %w", targetVersion, ErrVersionNotFound)
	}

	// Create a version entry for the current state before rolling back
	currentSnapshot := model.VersionEntry{
		Version:   eq.Version,
		Author:    author,
		Timestamp: time.Now(),
		Message:   fmt.Sprintf("Auto-save before rollback to v%d", targetVersion),
		Snapshot:  *deepCopy(eq),
	}

	// Restore from snapshot
	snapshot.VersionHistory = append(eq.VersionHistory, currentSnapshot)
	snapshot.Version = eq.Version + 1
	snapshot.UpdatedBy = author
	snapshot.UpdatedAt = time.Now()

	// We need to preserve the ID
	snapshot.ID = eq.ID

	// Write back the restored equipment via Update (which does ReplaceOne)
	if err := m.store.Update(ctx, snapshot); err != nil {
		return fmt.Errorf("update: %w", err)
	}

	return nil
}

// deepCopy creates a deep copy of an equipment via JSON serialization.
func deepCopy(eq *model.Equipment) *model.Equipment {
	data, err := json.Marshal(eq)
	if err != nil {
		// Should never happen with valid data
		panic(fmt.Sprintf("deep copy marshal: %v", err))
	}
	var copy model.Equipment
	if err := json.Unmarshal(data, &copy); err != nil {
		panic(fmt.Sprintf("deep copy unmarshal: %v", err))
	}
	return &copy
}

// diffEquipment compares two equipment structs field by field.
func diffEquipment(a, b *model.Equipment) []VersionDiffField {
	var diffs []VersionDiffField

	compareField := func(path, old, new string) {
		if old != new {
			diffs = append(diffs, VersionDiffField{
				Path:     path,
				OldValue: old,
				NewValue: new,
			})
		}
	}

	compareField("name", a.Name, b.Name)
	compareField("code", a.Code, b.Code)
	compareField("category", a.Category, b.Category)
	compareField("platform_type", a.PlatformType, b.PlatformType)
	compareField("description", a.Description, b.Description)
	compareField("status", a.Status, b.Status)

	// Platform params
	compareField("platform_params.max_speed", fmt.Sprintf("%f", a.PlatformParams.MaxSpeed), fmt.Sprintf("%f", b.PlatformParams.MaxSpeed))
	compareField("platform_params.cruise_speed", fmt.Sprintf("%f", a.PlatformParams.CruiseSpeed), fmt.Sprintf("%f", b.PlatformParams.CruiseSpeed))
	compareField("platform_params.max_altitude", fmt.Sprintf("%f", a.PlatformParams.MaxAltitude), fmt.Sprintf("%f", b.PlatformParams.MaxAltitude))
	compareField("platform_params.range", fmt.Sprintf("%f", a.PlatformParams.Range), fmt.Sprintf("%f", b.PlatformParams.Range))
	compareField("platform_params.motion_model", a.PlatformParams.MotionModel, b.PlatformParams.MotionModel)

	// Compare sensors count
	compareField("sensors.count", fmt.Sprintf("%d", len(a.Sensors)), fmt.Sprintf("%d", len(b.Sensors)))

	// Compare weapons count
	compareField("weapons.count", fmt.Sprintf("%d", len(a.Weapons)), fmt.Sprintf("%d", len(b.Weapons)))

	// Compare communications count
	compareField("communications.count", fmt.Sprintf("%d", len(a.Communications)), fmt.Sprintf("%d", len(b.Communications)))

	// Signature params
	compareField("signature_params.rcs.frontal", fmt.Sprintf("%f", a.SignatureParams.RCS.Frontal), fmt.Sprintf("%f", b.SignatureParams.RCS.Frontal))
	compareField("signature_params.rcs.side", fmt.Sprintf("%f", a.SignatureParams.RCS.Side), fmt.Sprintf("%f", b.SignatureParams.RCS.Side))
	compareField("signature_params.rcs.rear", fmt.Sprintf("%f", a.SignatureParams.RCS.Rear), fmt.Sprintf("%f", b.SignatureParams.RCS.Rear))

	return diffs
}
