package model

import (
	"time"
)

// SimulationFrame 仿真帧
type SimulationFrame struct {
	SimTime      float64            `json:"sim_time"`
	PlatformID   string             `json:"platform_id"`
	PlatformName string             `json:"platform_name"`
	Side         string             `json:"side"` // red, blue, neutral
	Position     GeoPosition        `json:"position"`
	Velocity     Velocity           `json:"velocity"`
	Heading      float64            `json:"heading"`
	Altitude     float64            `json:"altitude"`
	Sensors      []SensorState      `json:"sensors"`
	Weapons      []WeaponState      `json:"weapons"`
	Comms        []CommState        `json:"comms"`
	Status       string             `json:"status"` // active, destroyed, landed, damaged
	FuelRemaining float64           `json:"fuel_remaining"`
	DamageLevel  float64            `json:"damage_level"` // 0.0 - 1.0
	Metadata     map[string]string  `json:"metadata"`
}

// GeoPosition 地理位置
type GeoPosition struct {
	Longitude   float64 `json:"longitude"`
	Latitude    float64 `json:"latitude"`
	AltitudeMSL float64 `json:"altitude_msl"` // MSL 高度
	AltitudeAGL float64 `json:"altitude_agl"` // AGL 高度
}

// Velocity 速度
type Velocity struct {
	North float64 `json:"north"` // 北向速度 (m/s)
	East  float64 `json:"east"`  // 东向速度 (m/s)
	Down  float64 `json:"down"`  // 下向速度 (m/s)
	Speed float64 `json:"speed"` // 合速度 (m/s)
}

// SensorState 传感器状态
type SensorState struct {
	SensorID   string           `json:"sensor_id"`
	SensorName string           `json:"sensor_name"`
	Type       string           `json:"type"` // radar, ir, eo, ew
	Active     bool             `json:"active"`
	Mode       string           `json:"mode"` // search, track, lock, off
	Azimuth    float64          `json:"azimuth"`
	Elevation  float64          `json:"elevation"`
	Detections []TrackDetection `json:"detections"`
}

// TrackDetection 航迹检测
type TrackDetection struct {
	TargetID       string  `json:"target_id"`
	Range          float64 `json:"range"`
	Bearing        float64 `json:"bearing"`
	Confidence     float64 `json:"confidence"` // 0.0 - 1.0
	Classification string  `json:"classification"`
}

// WeaponState 武器状态
type WeaponState struct {
	WeaponID   string `json:"weapon_id"`
	WeaponName string `json:"weapon_name"`
	Type       string `json:"type"`
	Remaining  int32  `json:"remaining"`
	Total      int32  `json:"total"`
	Status     string `json:"status"` // ready, firing, reloading, empty
}

// CommState 通信状态
type CommState struct {
	CommID    string  `json:"comm_id"`
	CommName  string  `json:"comm_name"`
	Active    bool    `json:"active"`
	Frequency string  `json:"frequency"`
	Bandwidth float64 `json:"bandwidth"`
}

// PlaybackSession 回放会话
type PlaybackSession struct {
	ID           string            `json:"id"`
	ScenarioID   string            `json:"scenario_id"`
	SimulationID string            `json:"simulation_id"`
	Name         string            `json:"name"`
	CreatedBy    string            `json:"created_by"`
	CreatedAt    time.Time         `json:"created_at"`
	StartTime    float64           `json:"start_time"` // 仿真起始时间
	EndTime      float64           `json:"end_time"`   // 仿真结束时间
	Duration     float64           `json:"duration"`   // 总时长 (秒)
	FrameCount   int64             `json:"frame_count"`
	Metadata     map[string]string `json:"metadata"`
}

// SimulationStats 仿真统计
type SimulationStats struct {
	SimulationID  string               `json:"simulation_id"`
	Duration      float64              `json:"duration"`
	TotalFrames   int64                `json:"total_frames"`
	PlatformCount int32                `json:"platform_count"`
	EventsCount   int32                `json:"events_count"`
	PlatformStats []PlatformStats      `json:"platform_stats"`
	Engagements   []EngagementSummary  `json:"engagements"`
}

// PlatformStats 平台统计
type PlatformStats struct {
	PlatformID   string  `json:"platform_id"`
	PlatformName string  `json:"platform_name"`
	Side         string  `json:"side"`
	MaxSpeed     float64 `json:"max_speed"`
	MinAltitude  float64 `json:"min_altitude"`
	MaxAltitude  float64 `json:"max_altitude"`
	TotalDistance float64 `json:"total_distance"`
	ShotsFired   int32   `json:"shots_fired"`
	Kills        int32   `json:"kills"`
	FinalStatus  string  `json:"final_status"`
}

// EngagementSummary 交战摘要
type EngagementSummary struct {
	ID         string  `json:"id"`
	Time       float64 `json:"time"`
	AttackerID string  `json:"attacker_id"`
	TargetID   string  `json:"target_id"`
	WeaponType string  `json:"weapon_type"`
	Result     string  `json:"result"` // hit, miss, destroyed
}

// TimeRange 时间范围
type TimeRange struct {
	Start float64
	End   float64
}

// EngagementEvent 交战事件（武器发射 / 命中 / 探测）
type EngagementEvent struct {
	ID       string      `json:"id"`
	Time     float64     `json:"time"`
	Type     string      `json:"type"` // weapon_launch, impact, detection
	SourceID string      `json:"source_id"`
	TargetID string      `json:"target_id"`
	WeaponID string      `json:"weapon_id"`
	Result   string      `json:"result"`
	Position GeoPosition `json:"position"`
}
