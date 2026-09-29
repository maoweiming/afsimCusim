package simstate

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/truesim/afsim-gateway/internal/proto"
)

// SimulationState holds the complete state of a running simulation.
// All fields are protected by RWMutex for concurrent access from event
// processing goroutines and WebSocket broadcast goroutines.
type SimulationState struct {
	mu sync.RWMutex

	SimTime   float64 `json:"sim_time"`
	SimState  string  `json:"sim_state"` // "pending" | "running" | "paused" | "complete"
	ClockRate float64 `json:"clock_rate"`

	Platforms     map[uint64]*Platform         `json:"platforms"`
	Tracks        map[TrackID]*Track           `json:"tracks"`
	ActiveWeapons map[uint64]*WeaponEngagement `json:"active_weapons"`
}

// TrackID is the composite key for a track, matching proto.TrackId.
type TrackID struct {
	OriginatorIndex uint32 `json:"originator_index"`
	TrackNumber     uint32 `json:"track_number"`
}

// NewSimulationState creates a SimulationState with sensible defaults.
func NewSimulationState() *SimulationState {
	return &SimulationState{
		SimState:      "pending",
		ClockRate:     1.0,
		Platforms:     make(map[uint64]*Platform),
		Tracks:        make(map[TrackID]*Track),
		ActiveWeapons: make(map[uint64]*WeaponEngagement),
	}
}

// ApplyEvent updates the simulation state based on a received SimEvent.
func (s *SimulationState) ApplyEvent(evt *proto.SimEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.SimTime = evt.GetSimTime()

	switch e := evt.GetPayload().(type) {
	case *proto.SimEvent_SimStarting:
		s.SimState = "running"

	case *proto.SimEvent_SimComplete:
		s.SimState = "complete"
		s.SimTime = e.SimComplete.GetEndTime()

	case *proto.SimEvent_SimPausing:
		s.SimState = "paused"

	case *proto.SimEvent_SimResuming:
		s.SimState = "running"

	case *proto.SimEvent_FrameComplete:
		if e.FrameComplete.GetSimTime() > 0 {
			s.SimTime = e.FrameComplete.GetSimTime()
		}

	case *proto.SimEvent_PlatformAdded:
		if pd := e.PlatformAdded.GetPlatform(); pd != nil {
			s.applyPlatformAdded(pd)
		}

	case *proto.SimEvent_PlatformInitialized:
		if pd := e.PlatformInitialized.GetPlatform(); pd != nil {
			s.applyPlatformInitialized(pd)
		}

	case *proto.SimEvent_PlatformDeleted:
		delete(s.Platforms, e.PlatformDeleted.GetIndex())

	case *proto.SimEvent_PlatformBroken:
		if p, ok := s.Platforms[e.PlatformBroken.GetIndex()]; ok {
			p.DamageFactor = e.PlatformBroken.GetDamage()
			p.Broken = true
		}

	case *proto.SimEvent_PlatformDamageChanged:
		if p, ok := s.Platforms[e.PlatformDamageChanged.GetIndex()]; ok {
			p.DamageFactor = e.PlatformDamageChanged.GetDamage()
		}

	case *proto.SimEvent_MoverUpdated:
		s.applyMoverUpdated(e.MoverUpdated)

	case *proto.SimEvent_SensorTurnedOn:
		if se := e.SensorTurnedOn.GetSensor(); se != nil {
			s.applySensorState(se, true)
		}

	case *proto.SimEvent_SensorTurnedOff:
		if se := e.SensorTurnedOff.GetSensor(); se != nil {
			s.applySensorState(se, false)
		}

	case *proto.SimEvent_SensorDetectionChanged:
		s.applySensorDetection(e.SensorDetectionChanged)

	case *proto.SimEvent_WeaponFired:
		s.applyWeaponFired(e.WeaponFired)

	case *proto.SimEvent_WeaponHit:
		delete(s.ActiveWeapons, e.WeaponHit.GetWeaponPlatformIndex())

	case *proto.SimEvent_WeaponMissed:
		delete(s.ActiveWeapons, e.WeaponMissed.GetWeaponPlatformIndex())

	case *proto.SimEvent_WeaponTerminated:
		delete(s.ActiveWeapons, e.WeaponTerminated.GetWeaponPlatformIndex())

	case *proto.SimEvent_TrackInitiated:
		if td := e.TrackInitiated.GetTrack(); td != nil {
			s.applyTrackInitiated(e.TrackInitiated)
		}

	case *proto.SimEvent_TrackUpdated:
		if td := e.TrackUpdated.GetTrack(); td != nil {
			s.applyTrackUpdated(e.TrackUpdated)
		}

	case *proto.SimEvent_TrackDropped:
		if tid := e.TrackDropped.GetId(); tid != nil {
			key := TrackID{
				OriginatorIndex: tid.GetOriginatorIndex(),
				TrackNumber:     tid.GetTrackNumber(),
			}
			delete(s.Tracks, key)
		}

	case *proto.SimEvent_FuelEvent:
		if p, ok := s.Platforms[e.FuelEvent.GetPlatformIndex()]; ok {
			p.Fuel[e.FuelEvent.GetFuelName()] = e.FuelEvent.GetQuantity()
		}

	case *proto.SimEvent_TaskAssigned:
		s.applyTaskState(e.TaskAssigned.GetTask(), "assigned")

	case *proto.SimEvent_TaskCompleted:
		s.applyTaskState(e.TaskCompleted.GetTask(), "completed")

	case *proto.SimEvent_TaskCanceled:
		s.applyTaskState(e.TaskCanceled.GetTask(), "canceled")
	}
}

// applyTaskState updates the assignee platform's mission state from a task event.
func (s *SimulationState) applyTaskState(td *proto.TaskData, status string) {
	if td == nil {
		return
	}
	p, ok := s.Platforms[td.GetAssigneeIndex()]
	if !ok {
		return
	}
	// Completion/cancellation of a stale task (different ID) must not clobber a newer assignment
	if status != "assigned" && p.Mission != nil && p.Mission.TaskID != td.GetTaskId() {
		return
	}
	p.Mission = &MissionState{
		TaskID:       td.GetTaskId(),
		TaskType:     td.GetTaskType(),
		Status:       status,
		AssignerName: td.GetAssignerName(),
		TargetName:   td.GetTargetName(),
		TargetIndex:  td.GetTargetIndex(),
		AssignTime:   td.GetAssignTime(),
	}
}

// Snapshot returns the full state as JSON for new WebSocket connections.
func (s *SimulationState) Snapshot() []byte {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Convert Tracks map to use string keys since JSON doesn't support non-string map keys
	tracksForJSON := make(map[string]*Track)
	for trackID, track := range s.Tracks {
		// Use a serializable key format: "originator_index:track_number"
		key := fmt.Sprintf("%d:%d", trackID.OriginatorIndex, trackID.TrackNumber)
		tracksForJSON[key] = track
	}

	// Create a temporary struct with only JSON-serializable fields
	snapshot := struct {
		SimTime       float64              `json:"sim_time"`
		SimState      string               `json:"sim_state"`
		ClockRate     float64              `json:"clock_rate"`
		Platforms     map[uint64]*Platform `json:"platforms"`
		Tracks        map[string]*Track    `json:"tracks"`
		ActiveWeapons map[uint64]*WeaponEngagement `json:"active_weapons"`
	}{
		SimTime:       s.SimTime,
		SimState:      s.SimState,
		ClockRate:     s.ClockRate,
		Platforms:     s.Platforms,
		Tracks:        tracksForJSON,
		ActiveWeapons: s.ActiveWeapons,
	}

	data, err := json.Marshal(snapshot)
	if err != nil {
		// Return error details in JSON format for debugging
		errMsg := fmt.Sprintf(`{"error":"snapshot marshal failed","details":"%v"}`, err)
		return []byte(errMsg)
	}
	return data
}

// GetSimState returns the current simulation state string (thread-safe).
func (s *SimulationState) GetSimState() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.SimState
}

// GetSimTime returns the current simulation time (thread-safe).
func (s *SimulationState) GetSimTime() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.SimTime
}

// SetClockRate updates the clock rate.
func (s *SimulationState) SetClockRate(rate float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ClockRate = rate
}

// PlatformCount returns the number of platforms.
func (s *SimulationState) PlatformCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.Platforms)
}

// --- Private helpers ---

func (s *SimulationState) applyPlatformAdded(pd *proto.PlatformData) {
	p := platformFromProto(pd)
	s.Platforms[pd.GetIndex()] = p
}

func (s *SimulationState) applyPlatformInitialized(pd *proto.PlatformData) {
	p := platformFromProto(pd)
	p.Initialized = true
	if existing, ok := s.Platforms[pd.GetIndex()]; ok {
		p.Sensors = existing.Sensors
		p.Fuel = existing.Fuel
	}
	s.Platforms[pd.GetIndex()] = p
}

func (s *SimulationState) applyMoverUpdated(m *proto.MoverUpdated) {
	p, ok := s.Platforms[m.GetPlatformIndex()]
	if !ok {
		p = &Platform{
			Index:   m.GetPlatformIndex(),
			Sensors: make(map[string]SensorState),
			Fuel:    make(map[string]float64),
		}
		s.Platforms[m.GetPlatformIndex()] = p
	}
	p.Lat = m.GetLat()
	p.Lon = m.GetLon()
	p.Alt = m.GetAlt()
	p.Heading = m.GetHeading()
	p.Pitch = m.GetPitch()
	p.Roll = m.GetRoll()
	p.VelN = m.GetVelN()
	p.VelE = m.GetVelE()
	p.VelD = m.GetVelD()
}

func (s *SimulationState) applySensorState(se *proto.SensorEvent, on bool) {
	p, ok := s.Platforms[se.GetPlatformIndex()]
	if !ok {
		return
	}
	name := se.GetSensorName()
	ss := p.Sensors[name]
	ss.Name = name
	ss.Type = se.GetSensorType()
	ss.IsOn = on
	if ss.Detections == nil {
		ss.Detections = make(map[uint64]struct{})
	}
	p.Sensors[name] = ss
}

func (s *SimulationState) applySensorDetection(sdc *proto.SensorDetectionChanged) {
	sensor := sdc.GetSensor()
	p, ok := s.Platforms[sensor.GetPlatformIndex()]
	if !ok {
		return
	}
	name := sensor.GetSensorName()
	ss, exists := p.Sensors[name]
	if !exists {
		ss = SensorState{
			Name:       name,
			Type:       sensor.GetSensorType(),
			IsOn:       true,
			Detections: make(map[uint64]struct{}),
		}
	} else if ss.Detections == nil {
		ss.Detections = make(map[uint64]struct{})
	}
	if sdc.GetDetected() {
		ss.Detections[sdc.GetTargetIndex()] = struct{}{}
	} else {
		delete(ss.Detections, sdc.GetTargetIndex())
	}
	p.Sensors[name] = ss
}

func (s *SimulationState) applyWeaponFired(wf *proto.WeaponFired) {
	s.ActiveWeapons[wf.GetWeaponPlatformIndex()] = &WeaponEngagement{
		WeaponPlatformIndex: wf.GetWeaponPlatformIndex(),
		FiringPlatformIndex: wf.GetFiringPlatformIndex(),
		WeaponName:          wf.GetWeaponName(),
		TargetPlatformIndex: wf.GetTargetPlatformIndex(),
		Lat:                 wf.GetLaunchLat(),
		Lon:                 wf.GetLaunchLon(),
		Alt:                 wf.GetLaunchAlt(),
	}
}

func (s *SimulationState) applyTrackInitiated(ti *proto.TrackInitiated) {
	td := ti.GetTrack()
	if td.GetId() == nil {
		return
	}
	tid := TrackID{
		OriginatorIndex: td.GetId().GetOriginatorIndex(),
		TrackNumber:     td.GetId().GetTrackNumber(),
	}
	s.Tracks[tid] = trackFromProto(td, ti.GetIsLocal())
}

func (s *SimulationState) applyTrackUpdated(tu *proto.TrackUpdated) {
	td := tu.GetTrack()
	if td.GetId() == nil {
		return
	}
	tid := TrackID{
		OriginatorIndex: td.GetId().GetOriginatorIndex(),
		TrackNumber:     td.GetId().GetTrackNumber(),
	}
	s.Tracks[tid] = trackFromProto(td, tu.GetIsLocal())
}
