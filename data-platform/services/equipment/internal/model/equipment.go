package model

import (
	"time"
)

// Equipment represents the full equipment document stored in MongoDB.
type Equipment struct {
	ID              string         `bson:"_id"`
	Code            string         `bson:"code"`
	Name            string         `bson:"name"`
	NameEN          string         `bson:"name_en,omitempty"`
	Category        string         `bson:"category"`
	PlatformType    string         `bson:"platform_type"`
	Description     string         `bson:"description"`
	Version         int32          `bson:"version"`
	Status          string         `bson:"status"`
	Country         string         `bson:"country,omitempty"`
	Manufacturer    string         `bson:"manufacturer,omitempty"`
	Domain          string         `bson:"domain,omitempty"` // air, land, surface, subsurface, space

	PlatformParams  PlatformParams  `bson:"platform_params"`
	Sensors         []SensorConfig  `bson:"sensors"`
	Weapons         []WeaponConfig  `bson:"weapons"`
	Communications  []CommConfig    `bson:"communications"`
	SignatureParams SignatureParams `bson:"signature_params"`
	Mover           *MoverConfig    `bson:"mover,omitempty"`
	Processors      []ProcessorConfig `bson:"processors,omitempty"`
	Fuel            *FuelConfig     `bson:"fuel,omitempty"`

	// AFSIM raw config (JSON bytes for type-specific details)
	RawConfig   []byte   `bson:"raw_config,omitempty"`
	VersionTag  string   `bson:"version_tag,omitempty"`
	Tags        []string `bson:"tags"`

	CreatedBy      string    `bson:"created_by"`
	UpdatedBy      string    `bson:"updated_by"`
	CreatedAt      time.Time `bson:"created_at"`
	UpdatedAt      time.Time `bson:"updated_at"`
	VersionHistory []VersionEntry `bson:"version_history"`
}

// PlatformParams contains platform motion and physical characteristics.
type PlatformParams struct {
	MaxSpeed         float64 `bson:"max_speed"`
	CruiseSpeed      float64 `bson:"cruise_speed"`
	MinSpeed         float64 `bson:"min_speed"`
	MaxAltitude      float64 `bson:"max_altitude"`
	MinAltitude      float64 `bson:"min_altitude"`
	Ceiling          float64 `bson:"ceiling"`
	Range            float64 `bson:"range"`
	Endurance        float64 `bson:"endurance"`
	MaxG             float64 `bson:"max_g"`
	Length           float64 `bson:"length"`
	Width            float64 `bson:"width"`
	Height           float64 `bson:"height"`
	Weight           float64 `bson:"weight"`
	MaxTakeoffWeight float64 `bson:"max_takeoff_weight"`
	FuelCapacity     float64 `bson:"fuel_capacity"`
	MotionModel      string  `bson:"motion_model"`
}

// SensorConfig represents a single sensor subsystem.
type SensorConfig struct {
	ID           string  `bson:"id"`
	Name         string  `bson:"name"`
	Type         string  `bson:"type"`
	Enabled      bool    `bson:"enabled"`
	MaxRange     float64 `bson:"max_range"`
	MinRange     float64 `bson:"min_range"`
	FovAzimuth   float64 `bson:"fov_azimuth"`
	FovElevation float64 `bson:"fov_elevation"`
	ScanRate     float64 `bson:"scan_rate"`
	Accuracy     float64 `bson:"accuracy"`
	Frequency    float64 `bson:"frequency"`
	Power        float64 `bson:"power"`
	AntennaGain  float64 `bson:"antenna_gain"`
	PulseWidth   float64 `bson:"pulse_width"`
	Prf          float64 `bson:"prf"`
	Sensitivity  float64 `bson:"sensitivity"`
	RawConfig    []byte  `bson:"raw_config,omitempty"`
	Description  string  `bson:"description,omitempty"`
}

// WeaponConfig represents a single weapon subsystem.
type WeaponConfig struct {
	ID              string  `bson:"id"`
	Name            string  `bson:"name"`
	Type            string  `bson:"type"`
	Quantity        int32   `bson:"quantity"`
	MaxRange        float64 `bson:"max_range"`
	MinRange        float64 `bson:"min_range"`
	NoEscapeRange   float64 `bson:"no_escape_range"`
	NoManeuverRange float64 `bson:"no_maneuver_range"`
	MaxSpeed        float64 `bson:"max_speed"`
	MaxAltitude     float64 `bson:"max_altitude"`
	MaxG            float64 `bson:"max_g"`
	FlightTime      float64 `bson:"flight_time"`
	WarheadType     string  `bson:"warhead_type"`
	WarheadWeight   float64 `bson:"warhead_weight"`
	BlastRadius     float64 `bson:"blast_radius"`
	Penetration     float64 `bson:"penetration"`
	GuidanceType    string  `bson:"guidance_type"`
	SeekerRange     float64 `bson:"seeker_range"`
	Weight          float64 `bson:"weight,omitempty"`
	RawConfig       []byte  `bson:"raw_config,omitempty"`
	Description     string  `bson:"description,omitempty"`
}

// CommConfig represents a single communication subsystem.
type CommConfig struct {
	ID          string  `bson:"id"`
	Name        string  `bson:"name"`
	Type        string  `bson:"type"`
	Enabled     bool    `bson:"enabled"`
	Frequency   float64 `bson:"frequency"`
	Bandwidth   float64 `bson:"bandwidth"`
	MaxRange    float64 `bson:"max_range"`
	DataRate    float64 `bson:"data_rate"`
	Latency     float64 `bson:"latency"`
	HopRate     float64 `bson:"hop_rate"`
	Encryption  string  `bson:"encryption"`
	RawConfig   []byte  `bson:"raw_config,omitempty"`
	Description string  `bson:"description,omitempty"`
}

// SignatureParams contains all signature characteristics.
type SignatureParams struct {
	RCS       RCSParams      `bson:"rcs"`
	IR        IRParams       `bson:"ir"`
	Acoustic  AcousticParams `bson:"acoustic"`
	Visual    VisualParams   `bson:"visual"`
	RawConfig []byte         `bson:"raw_config,omitempty"`
}

// RCSParams is the radar cross-section parameters.
type RCSParams struct {
	Frontal float64 `bson:"frontal"`
	Side    float64 `bson:"side"`
	Rear    float64 `bson:"rear"`
	Average float64 `bson:"average"`
}

// IRParams is the infrared signature parameters.
type IRParams struct {
	Frontal float64 `bson:"frontal"`
	Side    float64 `bson:"side"`
	Rear    float64 `bson:"rear"`
}

// AcousticParams is the acoustic signature parameters.
type AcousticParams struct {
	NoiseLevel float64 `bson:"noise_level"`
	Frequency  float64 `bson:"frequency"`
}

// VisualParams is the visual signature parameters.
type VisualParams struct {
	Visibility float64 `bson:"visibility"`
}

// VersionEntry stores a snapshot of an equipment version.
type VersionEntry struct {
	Version   int32     `bson:"version"`
	Author    string    `bson:"author"`
	Timestamp time.Time `bson:"timestamp"`
	Message   string    `bson:"message"`
	Snapshot  Equipment `bson:"snapshot"` // full equipment snapshot at this version
}

// MoverConfig represents the motion/platform mover subsystem.
type MoverConfig struct {
	ID              string  `bson:"id"`
	Name            string  `bson:"name"`
	Type            string  `bson:"type"` // air, ground, surface, subsurface, space, kinematic
	MaxSpeed        float64 `bson:"max_speed"`
	MaxAcceleration float64 `bson:"max_acceleration"`
	MaxDeceleration float64 `bson:"max_deceleration"`
	MaxClimbRate    float64 `bson:"max_climb_rate"`
	MaxTurnRate     float64 `bson:"max_turn_rate"`
	MaxRollRate     float64 `bson:"max_roll_rate"`
	StallSpeed      float64 `bson:"stall_speed"`
	CruiseSpeed     float64 `bson:"cruise_speed"`
	RawConfig       []byte  `bson:"raw_config,omitempty"`
	Description     string  `bson:"description,omitempty"`
}

// ProcessorConfig represents a processor subsystem.
type ProcessorConfig struct {
	ID          string  `bson:"id"`
	Name        string  `bson:"name"`
	Type        string  `bson:"type"` // track_manager, engagement_manager, sa_processor, etc.
	Enabled     bool    `bson:"enabled"`
	UpdateRate  float64 `bson:"update_rate"`
	MaxTracks   int32   `bson:"max_tracks"`
	RawConfig   []byte  `bson:"raw_config,omitempty"`
	Description string  `bson:"description,omitempty"`
}

// FuelConfig represents the fuel subsystem.
type FuelConfig struct {
	ID                       string  `bson:"id"`
	Name                     string  `bson:"name"`
	Type                     string  `bson:"type"` // basic, variable_rate, tabular_rate, tanked
	MaxFuel                  float64 `bson:"max_fuel"`
	CurrentFuel              float64 `bson:"current_fuel"`
	ConsumptionRate          float64 `bson:"consumption_rate"`
	SpecificFuelConsumption  float64 `bson:"specific_fuel_consumption"`
	RawConfig                []byte  `bson:"raw_config,omitempty"`
	Description              string  `bson:"description,omitempty"`
}

// EquipmentFilter represents query filters for listing equipment.
type EquipmentFilter struct {
	Category string
	Status   string
	Tags     []string
	Search   string
}
