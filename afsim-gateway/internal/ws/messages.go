// Package ws provides WebSocket communication between the gateway and browser clients.
package ws

// WSMessage is the JSON envelope for all messages sent to browser clients.
// This format is designed to be TypeScript-compatible and easy to parse
// on the frontend.
type WSMessage struct {
	Type    string      `json:"type"`
	SimTime float64     `json:"sim_time"`
	Payload interface{} `json:"payload"`
}

// Message type constants matching the protobuf event types.
// These are sent as the `type` field in WSMessage.
const (
	MsgSimState            = "sim_state"
	MsgPlatformAdded       = "platform_added"
	MsgPlatformInitialized = "platform_initialized"
	MsgPlatformDeleted     = "platform_deleted"
	MsgPlatformBroken      = "platform_broken"
	MsgPlatformDamageChanged = "platform_damage_changed"
	MsgMoverUpdate         = "mover_update"
	MsgSensorTurnedOn      = "sensor_turned_on"
	MsgSensorTurnedOff     = "sensor_turned_off"
	MsgSensorDetectionChanged = "sensor_detection_changed"
	MsgWeaponFired         = "weapon_fired"
	MsgWeaponHit           = "weapon_hit"
	MsgWeaponMissed        = "weapon_missed"
	MsgWeaponTerminated    = "weapon_terminated"
	MsgTrackInitiated      = "track_initiated"
	MsgTrackUpdated        = "track_updated"
	MsgTrackDropped        = "track_dropped"
	MsgZoneEntered         = "zone_entered"
	MsgZoneExited          = "zone_exited"
	MsgFuelEvent           = "fuel_event"
	MsgComment             = "comment"
	MsgFullSnapshot        = "full_snapshot"

	// Lifecycle messages
	MsgSimStarting   = "sim_starting"
	MsgSimComplete   = "sim_complete"
	MsgSimPausing    = "sim_pausing"
	MsgSimResuming   = "sim_resuming"
	MsgFrameComplete = "frame_complete"

	// Sensor track messages (distinct from general track messages)
	MsgSensorTrackInitiated = "sensor_track_initiated"
	MsgSensorTrackDropped   = "sensor_track_dropped"

	// Task assignment messages (WsfTaskManager)
	MsgTaskAssigned  = "task_assigned"
	MsgTaskCompleted = "task_completed"
	MsgTaskCanceled  = "task_canceled"
)

// ProtoTypeToWS maps protobuf event type names to WebSocket message type constants.
var ProtoTypeToWS = map[string]string{
	"sim_starting":            MsgSimStarting,
	"sim_complete":            MsgSimComplete,
	"sim_pausing":             MsgSimPausing,
	"sim_resuming":            MsgSimResuming,
	"frame_complete":          MsgFrameComplete,
	"platform_added":          MsgPlatformAdded,
	"platform_initialized":    MsgPlatformInitialized,
	"platform_deleted":        MsgPlatformDeleted,
	"platform_broken":         MsgPlatformBroken,
	"platform_damage_changed": MsgPlatformDamageChanged,
	"mover_updated":           MsgMoverUpdate,
	"sensor_turned_on":        MsgSensorTurnedOn,
	"sensor_turned_off":       MsgSensorTurnedOff,
	"sensor_detection_changed": MsgSensorDetectionChanged,
	"sensor_track_initiated":  MsgSensorTrackInitiated,
	"sensor_track_dropped":    MsgSensorTrackDropped,
	"weapon_fired":            MsgWeaponFired,
	"weapon_hit":              MsgWeaponHit,
	"weapon_missed":           MsgWeaponMissed,
	"weapon_terminated":       MsgWeaponTerminated,
	"track_initiated":         MsgTrackInitiated,
	"track_updated":           MsgTrackUpdated,
	"track_dropped":           MsgTrackDropped,
	"zone_entered":            MsgZoneEntered,
	"zone_exited":             MsgZoneExited,
	"fuel_event":              MsgFuelEvent,
	"comment":                 MsgComment,
	"task_assigned":           MsgTaskAssigned,
	"task_completed":          MsgTaskCompleted,
	"task_canceled":           MsgTaskCanceled,
}
