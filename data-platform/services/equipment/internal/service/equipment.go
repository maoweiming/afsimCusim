package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"truesim/equipment/internal/lock"
	"truesim/equipment/internal/model"
	"truesim/equipment/internal/store"
	"truesim/equipment/internal/version"
	pb "truesim/equipment/pb"
)

// EquipmentChangeEvent 装备变更事件 (NATS payload)
type EquipmentChangeEvent struct {
	EquipmentID string `json:"equipment_id"`
	ChangeType  string `json:"change_type"` // created, updated, deleted
	Version     int32  `json:"version"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Timestamp   string `json:"timestamp"`
}

// EquipmentServer implements the gRPC EquipmentServiceServer interface.
type EquipmentServer struct {
	pb.UnimplementedEquipmentServiceServer

	store       *store.EquipmentStore
	lockManager *lock.Manager
	versionMgr  *version.Manager
	natsConn    *nats.Conn // NATS connection for cross-service events (nil = disabled)

	// Watch streams: equipmentID -> list of update channels
	watchMu     sync.RWMutex
	watchers    map[string][]chan *pb.EquipmentUpdate
}

// NewEquipmentServer creates a new equipment gRPC server.
// natsConn may be nil to disable NATS publishing.
func NewEquipmentServer(s *store.EquipmentStore, natsConn *nats.Conn) *EquipmentServer {
	return &EquipmentServer{
		store:       s,
		lockManager: lock.NewManager(),
		versionMgr:  version.NewManager(s),
		natsConn:    natsConn,
		watchers:    make(map[string][]chan *pb.EquipmentUpdate),
	}
}

// ==================== CRUD ====================

func (s *EquipmentServer) CreateEquipment(ctx context.Context, req *pb.CreateEquipmentRequest) (*pb.Equipment, error) {
	eq := req.GetEquipment()
	if eq == nil {
		return nil, status.Error(codes.InvalidArgument, "equipment is required")
	}
	if eq.GetCode() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment code is required")
	}
	if eq.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment name is required")
	}

	now := time.Now()
	m := model.EquipmentFromProto(eq)
	if m.ID == "" {
		m.ID = m.Code // use code as default ID
	}
	m.Version = 1
	m.Status = "draft"
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.Tags == nil {
		m.Tags = []string{}
	}

	if err := s.store.Create(ctx, m); err != nil {
		if err == store.ErrAlreadyExists {
			return nil, status.Errorf(codes.AlreadyExists, "equipment %s already exists", m.ID)
		}
		return nil, status.Errorf(codes.Internal, "create: %v", err)
	}

	proto := model.EquipmentToProto(m)
	s.notifyWatchers(m.ID, "created", proto, eq.GetCreatedBy())
	return proto, nil
}

func (s *EquipmentServer) GetEquipment(ctx context.Context, req *pb.GetEquipmentRequest) (*pb.Equipment, error) {
	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	m, err := s.store.Get(ctx, req.GetId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	return model.EquipmentToProto(m), nil
}

func (s *EquipmentServer) UpdateEquipment(ctx context.Context, req *pb.UpdateEquipmentRequest) (*pb.Equipment, error) {
	eq := req.GetEquipment()
	if eq == nil || eq.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment with id is required")
	}

	// Fetch existing
	existing, err := s.store.Get(ctx, eq.GetId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", eq.GetId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	// Check lock
	if lock := s.lockManager.GetLock(eq.GetId()); lock != nil && lock.UserID != eq.GetUpdatedBy() {
		return nil, status.Errorf(codes.FailedPrecondition, "equipment is locked by %s", lock.UserName)
	}

	// Merge updates
	updated := model.EquipmentFromProto(eq)
	if updated.Code != "" {
		existing.Code = updated.Code
	}
	if updated.Name != "" {
		existing.Name = updated.Name
	}
	if updated.NameEN != "" {
		existing.NameEN = updated.NameEN
	}
	if updated.Category != "" {
		existing.Category = updated.Category
	}
	if updated.PlatformType != "" {
		existing.PlatformType = updated.PlatformType
	}
	if updated.Description != "" {
		existing.Description = updated.Description
	}
	if updated.Status != "" {
		existing.Status = updated.Status
	}
	if updated.Country != "" {
		existing.Country = updated.Country
	}
	if updated.Manufacturer != "" {
		existing.Manufacturer = updated.Manufacturer
	}
	if updated.Domain != "" {
		existing.Domain = updated.Domain
	}
	if updated.VersionTag != "" {
		existing.VersionTag = updated.VersionTag
	}
	if updated.UpdatedBy != "" {
		existing.UpdatedBy = updated.UpdatedBy
	}
	if updated.Tags != nil {
		existing.Tags = updated.Tags
	}
	if eq.GetPlatformParams() != nil {
		existing.PlatformParams = updated.PlatformParams
	}
	if eq.GetSignatureParams() != nil {
		existing.SignatureParams = updated.SignatureParams
	}
	if eq.GetSensors() != nil {
		existing.Sensors = updated.Sensors
	}
	if eq.GetWeapons() != nil {
		existing.Weapons = updated.Weapons
	}
	if eq.GetCommunications() != nil {
		existing.Communications = updated.Communications
	}
	if eq.GetMover() != nil {
		existing.Mover = updated.Mover
	}
	if eq.GetProcessors() != nil {
		existing.Processors = updated.Processors
	}
	if eq.GetFuel() != nil {
		existing.Fuel = updated.Fuel
	}
	if len(eq.GetRawConfig()) > 0 {
		existing.RawConfig = updated.RawConfig
	}

	if err := s.store.Update(ctx, existing); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	proto := model.EquipmentToProto(existing)
	s.notifyWatchers(eq.GetId(), "updated", proto, eq.GetUpdatedBy())
	return proto, nil
}

func (s *EquipmentServer) DeleteEquipment(ctx context.Context, req *pb.DeleteEquipmentRequest) (*pb.Empty, error) {
	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	// Check lock
	if lock := s.lockManager.GetLock(req.GetId()); lock != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "equipment is locked by %s", lock.UserName)
	}

	if err := s.store.Delete(ctx, req.GetId()); err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetId())
		}
		return nil, status.Errorf(codes.Internal, "delete: %v", err)
	}

	s.notifyWatchers(req.GetId(), "deleted", nil, "")
	return &pb.Empty{}, nil
}

func (s *EquipmentServer) ListEquipment(ctx context.Context, req *pb.ListEquipmentRequest) (*pb.ListEquipmentResponse, error) {
	f := model.EquipmentFilter{
		Category: req.GetCategory(),
		Status:   req.GetStatus(),
		Tags:     req.GetTags(),
		Search:   req.GetSearch(),
	}

	page := req.GetPage()
	if page < 1 {
		page = 1
	}
	pageSize := req.GetPageSize()
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	items, total, err := s.store.List(ctx, f, page, pageSize)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list: %v", err)
	}

	equipment := make([]*pb.Equipment, len(items))
	for i := range items {
		equipment[i] = model.EquipmentToProto(&items[i])
	}

	return &pb.ListEquipmentResponse{
		Equipment: equipment,
		Total:     total,
	}, nil
}

// ==================== Sub-system Management ====================

func (s *EquipmentServer) AddSensor(ctx context.Context, req *pb.AddSensorRequest) (*pb.SensorConfig, error) {
	if req.GetEquipmentId() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment_id is required")
	}
	if req.GetSensor() == nil {
		return nil, status.Error(codes.InvalidArgument, "sensor is required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	sensor := model.SensorConfigFromProto(req.GetSensor())
	if sensor.ID == "" {
		sensor.ID = fmt.Sprintf("sensor_%d", time.Now().UnixNano())
	}

	eq.Sensors = append(eq.Sensors, sensor)
	eq.Version++
	eq.UpdatedAt = time.Now()

	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	proto := model.SensorConfigToProto(&sensor)
	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return proto, nil
}

func (s *EquipmentServer) UpdateSensor(ctx context.Context, req *pb.UpdateSensorRequest) (*pb.SensorConfig, error) {
	if req.GetEquipmentId() == "" || req.GetSensor() == nil {
		return nil, status.Error(codes.InvalidArgument, "equipment_id and sensor are required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	sensor := model.SensorConfigFromProto(req.GetSensor())
	found := false
	for i, s := range eq.Sensors {
		if s.ID == sensor.ID {
			eq.Sensors[i] = sensor
			found = true
			break
		}
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "sensor %s not found", sensor.ID)
	}

	eq.Version++
	eq.UpdatedAt = time.Now()
	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	proto := model.SensorConfigToProto(&sensor)
	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return proto, nil
}

func (s *EquipmentServer) RemoveSensor(ctx context.Context, req *pb.RemoveSensorRequest) (*pb.Empty, error) {
	if req.GetEquipmentId() == "" || req.GetSensorId() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment_id and sensor_id are required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	found := false
	for i, sensor := range eq.Sensors {
		if sensor.ID == req.GetSensorId() {
			eq.Sensors = append(eq.Sensors[:i], eq.Sensors[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "sensor %s not found", req.GetSensorId())
	}

	eq.Version++
	eq.UpdatedAt = time.Now()
	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return &pb.Empty{}, nil
}

func (s *EquipmentServer) AddWeapon(ctx context.Context, req *pb.AddWeaponRequest) (*pb.WeaponConfig, error) {
	if req.GetEquipmentId() == "" || req.GetWeapon() == nil {
		return nil, status.Error(codes.InvalidArgument, "equipment_id and weapon are required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	weapon := model.WeaponConfigFromProto(req.GetWeapon())
	if weapon.ID == "" {
		weapon.ID = fmt.Sprintf("weapon_%d", time.Now().UnixNano())
	}

	eq.Weapons = append(eq.Weapons, weapon)
	eq.Version++
	eq.UpdatedAt = time.Now()

	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	proto := model.WeaponConfigToProto(&weapon)
	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return proto, nil
}

func (s *EquipmentServer) UpdateWeapon(ctx context.Context, req *pb.UpdateWeaponRequest) (*pb.WeaponConfig, error) {
	if req.GetEquipmentId() == "" || req.GetWeapon() == nil {
		return nil, status.Error(codes.InvalidArgument, "equipment_id and weapon are required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	weapon := model.WeaponConfigFromProto(req.GetWeapon())
	found := false
	for i, w := range eq.Weapons {
		if w.ID == weapon.ID {
			eq.Weapons[i] = weapon
			found = true
			break
		}
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "weapon %s not found", weapon.ID)
	}

	eq.Version++
	eq.UpdatedAt = time.Now()
	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	proto := model.WeaponConfigToProto(&weapon)
	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return proto, nil
}

func (s *EquipmentServer) RemoveWeapon(ctx context.Context, req *pb.RemoveWeaponRequest) (*pb.Empty, error) {
	if req.GetEquipmentId() == "" || req.GetWeaponId() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment_id and weapon_id are required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	found := false
	for i, weapon := range eq.Weapons {
		if weapon.ID == req.GetWeaponId() {
			eq.Weapons = append(eq.Weapons[:i], eq.Weapons[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "weapon %s not found", req.GetWeaponId())
	}

	eq.Version++
	eq.UpdatedAt = time.Now()
	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return &pb.Empty{}, nil
}

func (s *EquipmentServer) AddCommunication(ctx context.Context, req *pb.AddCommRequest) (*pb.CommConfig, error) {
	if req.GetEquipmentId() == "" || req.GetComm() == nil {
		return nil, status.Error(codes.InvalidArgument, "equipment_id and comm are required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	comm := model.CommConfigFromProto(req.GetComm())
	if comm.ID == "" {
		comm.ID = fmt.Sprintf("comm_%d", time.Now().UnixNano())
	}

	eq.Communications = append(eq.Communications, comm)
	eq.Version++
	eq.UpdatedAt = time.Now()

	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	proto := model.CommConfigToProto(&comm)
	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return proto, nil
}

func (s *EquipmentServer) UpdateCommunication(ctx context.Context, req *pb.UpdateCommRequest) (*pb.CommConfig, error) {
	if req.GetEquipmentId() == "" || req.GetComm() == nil {
		return nil, status.Error(codes.InvalidArgument, "equipment_id and comm are required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	comm := model.CommConfigFromProto(req.GetComm())
	found := false
	for i, c := range eq.Communications {
		if c.ID == comm.ID {
			eq.Communications[i] = comm
			found = true
			break
		}
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "comm %s not found", comm.ID)
	}

	eq.Version++
	eq.UpdatedAt = time.Now()
	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	proto := model.CommConfigToProto(&comm)
	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return proto, nil
}

func (s *EquipmentServer) RemoveCommunication(ctx context.Context, req *pb.RemoveCommRequest) (*pb.Empty, error) {
	if req.GetEquipmentId() == "" || req.GetCommId() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment_id and comm_id are required")
	}

	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	found := false
	for i, comm := range eq.Communications {
		if comm.ID == req.GetCommId() {
			eq.Communications = append(eq.Communications[:i], eq.Communications[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "comm %s not found", req.GetCommId())
	}

	eq.Version++
	eq.UpdatedAt = time.Now()
	if err := s.store.Update(ctx, eq); err != nil {
		return nil, status.Errorf(codes.Internal, "update: %v", err)
	}

	s.notifyWatchers(eq.ID, "updated", model.EquipmentToProto(eq), "")
	return &pb.Empty{}, nil
}

// ==================== Version Management ====================

func (s *EquipmentServer) GetVersionHistory(ctx context.Context, req *pb.GetVersionRequest) (*pb.VersionHistory, error) {
	if req.GetEquipmentId() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment_id is required")
	}

	history, err := s.versionMgr.GetHistory(ctx, req.GetEquipmentId())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "get history: %v", err)
	}

	versions := make([]*pb.VersionEntry, len(history))
	for i, v := range history {
		versions[i] = &pb.VersionEntry{
			Version:   v.Version,
			Author:    v.Author,
			Timestamp: v.Timestamp.Format(time.RFC3339),
			Message:   v.Message,
		}
	}

	return &pb.VersionHistory{Versions: versions}, nil
}

func (s *EquipmentServer) CompareVersions(ctx context.Context, req *pb.CompareVersionsRequest) (*pb.VersionDiff, error) {
	if req.GetEquipmentId() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment_id is required")
	}

	diffs, err := s.versionMgr.CompareVersions(ctx, req.GetEquipmentId(), req.GetVersionA(), req.GetVersionB())
	if err != nil {
		if err == version.ErrVersionNotFound {
			return nil, status.Errorf(codes.NotFound, "%v", err)
		}
		return nil, status.Errorf(codes.Internal, "compare: %v", err)
	}

	changes := make([]*pb.FieldDiff, len(diffs))
	for i, d := range diffs {
		changes[i] = &pb.FieldDiff{
			Path:     d.Path,
			OldValue: d.OldValue,
			NewValue: d.NewValue,
		}
	}

	return &pb.VersionDiff{Changes: changes}, nil
}

func (s *EquipmentServer) RollbackVersion(ctx context.Context, req *pb.RollbackRequest) (*pb.Equipment, error) {
	if req.GetEquipmentId() == "" {
		return nil, status.Error(codes.InvalidArgument, "equipment_id is required")
	}
	if req.GetTargetVersion() < 1 {
		return nil, status.Error(codes.InvalidArgument, "target_version must be > 0")
	}

	// Get the equipment to find the author (use updated_by as fallback)
	eq, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		if err == store.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "equipment %s not found", req.GetEquipmentId())
		}
		return nil, status.Errorf(codes.Internal, "get: %v", err)
	}

	author := eq.UpdatedBy
	if author == "" {
		author = "system"
	}

	if err := s.versionMgr.Rollback(ctx, req.GetEquipmentId(), req.GetTargetVersion(), author); err != nil {
		return nil, status.Errorf(codes.Internal, "rollback: %v", err)
	}

	// Fetch the rolled-back equipment
	restored, err := s.store.Get(ctx, req.GetEquipmentId())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "get after rollback: %v", err)
	}

	proto := model.EquipmentToProto(restored)
	s.notifyWatchers(req.GetEquipmentId(), "updated", proto, author)
	return proto, nil
}

// ==================== Collaboration ====================

func (s *EquipmentServer) LockEquipment(ctx context.Context, req *pb.LockRequest) (*pb.LockResponse, error) {
	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	// In a real system, userID/userName would come from auth metadata
	userID := "current_user"
	userName := "Current User"

	acquired, err := s.lockManager.Acquire(req.GetId(), userID, userName, "edit")
	if err != nil {
		if err == lock.ErrAlreadyLocked {
			existing := s.lockManager.GetLock(req.GetId())
			lockedBy := ""
			if existing != nil {
				lockedBy = existing.UserName
			}
			return &pb.LockResponse{
				Success:  false,
				LockedBy: lockedBy,
				Error:    fmt.Sprintf("locked by %s", lockedBy),
			}, nil
		}
		return nil, status.Errorf(codes.Internal, "lock: %v", err)
	}

	s.notifyWatchers(req.GetId(), "locked", nil, acquired.UserID)
	return &pb.LockResponse{
		Success:  true,
		LockedBy: acquired.UserName,
	}, nil
}

func (s *EquipmentServer) UnlockEquipment(ctx context.Context, req *pb.UnlockRequest) (*pb.Empty, error) {
	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	userID := "current_user"

	if err := s.lockManager.Release(req.GetId(), userID); err != nil {
		if err == lock.ErrNotOwner {
			return nil, status.Error(codes.PermissionDenied, "you do not hold this lock")
		}
		if err == lock.ErrNotLocked {
			return &pb.Empty{}, nil // already unlocked
		}
		return nil, status.Errorf(codes.Internal, "unlock: %v", err)
	}

	s.notifyWatchers(req.GetId(), "unlocked", nil, userID)
	return &pb.Empty{}, nil
}

func (s *EquipmentServer) WatchEquipment(req *pb.WatchRequest, stream pb.EquipmentService_WatchEquipmentServer) error {
	if req.GetId() == "" {
		return status.Error(codes.InvalidArgument, "id is required")
	}

	ch := make(chan *pb.EquipmentUpdate, 64)
	s.addWatcher(req.GetId(), ch)
	defer s.removeWatcher(req.GetId(), ch)

	for {
		select {
		case update, ok := <-ch:
			if !ok {
				return nil
			}
			if err := stream.Send(update); err != nil {
				return status.Errorf(codes.Internal, "send: %v", err)
			}
		case <-stream.Context().Done():
			return nil
		}
	}
}

func (s *EquipmentServer) addWatcher(equipmentID string, ch chan *pb.EquipmentUpdate) {
	s.watchMu.Lock()
	defer s.watchMu.Unlock()
	s.watchers[equipmentID] = append(s.watchers[equipmentID], ch)
}

func (s *EquipmentServer) removeWatcher(equipmentID string, ch chan *pb.EquipmentUpdate) {
	s.watchMu.Lock()
	defer s.watchMu.Unlock()

	channels := s.watchers[equipmentID]
	for i, c := range channels {
		if c == ch {
			s.watchers[equipmentID] = append(channels[:i], channels[i+1:]...)
			close(ch)
			break
		}
	}
	if len(s.watchers[equipmentID]) == 0 {
		delete(s.watchers, equipmentID)
	}
}

func (s *EquipmentServer) notifyWatchers(equipmentID, updateType string, eq *pb.Equipment, userID string) {
	// Publish to NATS for cross-service notifications (created/updated/deleted only)
	if updateType == "created" || updateType == "updated" || updateType == "deleted" {
		s.publishNATSEvent(equipmentID, updateType, eq)
	}

	s.watchMu.RLock()
	channels := s.watchers[equipmentID]
	s.watchMu.RUnlock()

	if len(channels) == 0 {
		return
	}

	update := &pb.EquipmentUpdate{
		Type:      updateType,
		Equipment: eq,
		UserId:    userID,
	}

	for _, ch := range channels {
		select {
		case ch <- update:
		default:
			// Channel full, skip to avoid blocking
			log.Printf("watcher channel full for %s, skipping update", equipmentID)
		}
	}
}

// publishNATSEvent publishes an equipment change event to NATS.
// No-op if NATS connection is nil.
func (s *EquipmentServer) publishNATSEvent(equipmentID, changeType string, eq *pb.Equipment) {
	if s.natsConn == nil {
		return
	}

	event := EquipmentChangeEvent{
		EquipmentID: equipmentID,
		ChangeType:  changeType,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}
	if eq != nil {
		event.Version = eq.GetVersion()
		event.Name = eq.GetName()
		event.Category = eq.GetCategory()
	}

	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[NATS] failed to marshal equipment change event: %v", err)
		return
	}

	subject := "equipment.changed"
	if err := s.natsConn.Publish(subject, data); err != nil {
		log.Printf("[NATS] failed to publish to %s: %v", subject, err)
	}
}

// ==================== Import / Export ====================

func (s *EquipmentServer) ImportEquipment(ctx context.Context, req *pb.ImportRequest) (*pb.ImportResult, error) {
	if len(req.GetData()) == 0 {
		return nil, status.Error(codes.InvalidArgument, "data is required")
	}

	format := req.GetFormat()
	if format == "" {
		format = "json"
	}

	switch format {
	case "json":
		return s.importJSON(ctx, req.GetData())
	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported format: %s (supported: json)", format)
	}
}

func (s *EquipmentServer) importJSON(ctx context.Context, data []byte) (*pb.ImportResult, error) {
	var items []model.Equipment
	if err := json.Unmarshal(data, &items); err != nil {
		// Try single equipment
		var single model.Equipment
		if err2 := json.Unmarshal(data, &single); err2 != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid JSON: %v", err)
		}
		items = []model.Equipment{single}
	}

	result := &pb.ImportResult{}
	now := time.Now()

	for i := range items {
		eq := &items[i]
		if eq.ID == "" {
			eq.ID = eq.Code
		}
		if eq.Version == 0 {
			eq.Version = 1
		}
		if eq.Status == "" {
			eq.Status = "draft"
		}
		eq.CreatedAt = now
		eq.UpdatedAt = now

		if err := s.store.Create(ctx, eq); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", eq.ID, err))
		} else {
			result.Imported++
		}
	}

	return result, nil
}

func (s *EquipmentServer) ExportEquipment(ctx context.Context, req *pb.ExportRequest) (*pb.ExportResult, error) {
	if len(req.GetIds()) == 0 {
		return nil, status.Error(codes.InvalidArgument, "ids is required")
	}

	format := req.GetFormat()
	if format == "" {
		format = "json"
	}

	var items []model.Equipment
	for _, id := range req.GetIds() {
		eq, err := s.store.Get(ctx, id)
		if err != nil {
			if err == store.ErrNotFound {
				continue // skip missing items
			}
			return nil, status.Errorf(codes.Internal, "get %s: %v", id, err)
		}
		items = append(items, *eq)
	}

	switch format {
	case "json":
		data, err := json.MarshalIndent(items, "", "  ")
		if err != nil {
			return nil, status.Errorf(codes.Internal, "marshal: %v", err)
		}
		return &pb.ExportResult{Data: data, Format: "json"}, nil
	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported format: %s (supported: json)", format)
	}
}
