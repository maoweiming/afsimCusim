package simstate

import (
	"github.com/truesim/afsim-gateway/internal/proto"
)

// Platform represents an AFSIM platform in the simulation state.
type Platform struct {
	Index        uint64  `json:"index"`
	Name         string  `json:"name"`
	TypeID       string  `json:"type_id"`
	Side         string  `json:"side"`
	Icon         string  `json:"icon"`
	Lat          float64 `json:"lat"`
	Lon          float64 `json:"lon"`
	Alt          float64 `json:"alt"`
	Heading      float32 `json:"heading"`
	Pitch        float32 `json:"pitch"`
	Roll         float32 `json:"roll"`
	VelN         float64 `json:"vel_n"`
	VelE         float64 `json:"vel_e"`
	VelD         float64 `json:"vel_d"`
	DamageFactor float64 `json:"damage_factor"`
	Broken       bool    `json:"broken"`
	Initialized  bool    `json:"initialized"`

	Sensors map[string]SensorState  `json:"sensors"`
	Fuel    map[string]float64      `json:"fuel"`

	Mission *MissionState `json:"mission,omitempty"`
}

// MissionState tracks the current WsfTaskManager task assigned to a platform.
type MissionState struct {
	TaskID       uint32  `json:"task_id"`
	TaskType     string  `json:"task_type"`
	Status       string  `json:"status"` // "assigned" | "completed" | "canceled"
	AssignerName string  `json:"assigner_name"`
	TargetName   string  `json:"target_name,omitempty"`
	TargetIndex  uint64  `json:"target_index,omitempty"`
	AssignTime   float64 `json:"assign_time"`
}

// SensorState tracks the on/off state and detections for a single sensor.
type SensorState struct {
	Name       string              `json:"name"`
	Type       string              `json:"type"`
	IsOn       bool                `json:"is_on"`
	Detections map[uint64]struct{} `json:"-"`
}

// MarshalJSON customizes the JSON output for SensorState to include detections as a list.
func (ss SensorState) MarshalJSON() ([]byte, error) {
	type Alias struct {
		Name       string   `json:"name"`
		Type       string   `json:"type"`
		IsOn       bool     `json:"is_on"`
		Detections []uint64 `json:"detections"`
	}
	detections := make([]uint64, 0, len(ss.Detections))
	for idx := range ss.Detections {
		detections = append(detections, idx)
	}
	return jsonMarshal(Alias{
		Name:       ss.Name,
		Type:       ss.Type,
		IsOn:       ss.IsOn,
		Detections: detections,
	})
}

// platformFromProto creates a Platform from a proto.PlatformData.
func platformFromProto(pd *proto.PlatformData) *Platform {
	return &Platform{
		Index:        pd.GetIndex(),
		Name:         pd.GetName(),
		TypeID:       pd.GetTypeId(),
		Side:         pd.GetSide(),
		Icon:         pd.GetIcon(),
		Lat:          pd.GetLat(),
		Lon:          pd.GetLon(),
		Alt:          pd.GetAlt(),
		Heading:      pd.GetHeading(),
		Pitch:        pd.GetPitch(),
		Roll:         pd.GetRoll(),
		VelN:         pd.GetVelN(),
		VelE:         pd.GetVelE(),
		VelD:         pd.GetVelD(),
		DamageFactor: pd.GetDamageFactor(),
		Sensors:      make(map[string]SensorState),
		Fuel:         make(map[string]float64),
	}
}
