package engine

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"sync"
	"time"

	"google.golang.org/protobuf/proto"

	"github.com/truesim/afsim-gateway/internal/datasink"
	"github.com/truesim/afsim-gateway/internal/pipe"
	simproto "github.com/truesim/afsim-gateway/internal/proto"
	"github.com/truesim/afsim-gateway/internal/simstate"
	"github.com/truesim/afsim-gateway/internal/ws"
)

// Connector manages the pipe connections to the AFSIM WSF plugin.
// It reads events from the event pipe and writes control commands
// to the control pipe.
type Connector struct {
	state  *simstate.SimulationState
	hub    *ws.Hub
	sink   datasink.EventSink
	logger *slog.Logger

	eventPipePath   string
	controlPipePath string
	retryInterval   time.Duration

	simID      string
	scenarioID string

	controlMu   sync.Mutex
	controlConn net.Conn

	done chan struct{}
}

// ConnectorConfig holds configuration for the pipe connector.
type ConnectorConfig struct {
	EventPipePath   string           // e.g. `\\.\pipe\afsim_events`
	ControlPipePath string           // e.g. `\\.\pipe\afsim_control`
	RetryInterval   time.Duration    // Time between connection retries
	Sink            datasink.EventSink // Optional event sink for data-platform integration
	SimID           string           // Simulation ID, forwarded to the sink on lifecycle events
	ScenarioID      string           // Scenario ID, forwarded to the sink on simulation start
}

// NewConnector creates a new Connector.
func NewConnector(cfg ConnectorConfig, state *simstate.SimulationState, hub *ws.Hub, logger *slog.Logger) *Connector {
	if logger == nil {
		logger = slog.Default()
	}
	retry := cfg.RetryInterval
	if retry == 0 {
		retry = 2 * time.Second
	}
	sink := cfg.Sink
	if sink == nil {
		sink = datasink.NewNoopSink()
	}
	return &Connector{
		state:           state,
		hub:             hub,
		sink:            sink,
		logger:          logger,
		eventPipePath:   cfg.EventPipePath,
		controlPipePath: cfg.ControlPipePath,
		retryInterval:   retry,
		simID:           cfg.SimID,
		scenarioID:      cfg.ScenarioID,
		done:            make(chan struct{}),
	}
}

// Run starts the connector, connecting to both pipes and processing events.
// It blocks until the context is cancelled.
func (c *Connector) Run(ctx context.Context) error {
	defer close(c.done)
	defer c.sink.Close()

	// Connect to the event pipe (server writes outbound, client reads)
	eventConn, err := pipe.DialWithAccess(ctx, c.eventPipePath, c.retryInterval, pipe.AccessReadOnly, c.logger.With("pipe", "events"))
	if err != nil {
		return fmt.Errorf("failed to connect to event pipe: %w", err)
	}
	defer eventConn.Close()

	// Connect to the control pipe (server reads inbound, client writes)
	controlConn, err := pipe.DialWithAccess(ctx, c.controlPipePath, c.retryInterval, pipe.AccessWriteOnly, c.logger.With("pipe", "control"))
	if err != nil {
		return fmt.Errorf("failed to connect to control pipe: %w", err)
	}
	c.controlMu.Lock()
	c.controlConn = controlConn
	c.controlMu.Unlock()
	defer func() {
		c.controlMu.Lock()
		c.controlConn = nil
		c.controlMu.Unlock()
		controlConn.Close()
	}()

	c.logger.Info("connected to both AFSIM pipes, starting event loop")

	// Main event reading loop
	for {
		select {
		case <-ctx.Done():
			c.logger.Info("connector shutting down", "reason", ctx.Err())
			return nil
		default:
		}

		msgBytes, err := pipe.ReadMessage(eventConn)
		if err != nil {
			select {
			case <-ctx.Done():
				return nil
			default:
			}
			c.logger.Error("failed to read from event pipe", "error", err)
			return fmt.Errorf("event pipe read error: %w", err)
		}

		if len(msgBytes) == 0 {
			continue
		}

		// Unmarshal the protobuf binary message
		evt, err := unmarshalEvent(msgBytes)
		if err != nil {
			c.logger.Error("failed to unmarshal event", "error", err, "bytes", len(msgBytes))
			continue
		}

		// Detect lifecycle events and notify the sink before applying state
		switch evt.GetPayload().(type) {
		case *simproto.SimEvent_SimStarting:
			c.sink.OnSimulationStart(c.simID, c.scenarioID)
		case *simproto.SimEvent_SimComplete:
			c.sink.OnSimulationComplete(c.simID)
		}

		// Forward the event to the data-platform sink
		c.sink.OnEvent(evt)

		// Apply the event to the simulation state
		c.state.ApplyEvent(evt)

		// Broadcast the event to all WebSocket clients
		c.broadcastEvent(evt)
	}
}

// SendControl sends a control command to the AFSIM WSF plugin.
func (c *Connector) SendControl(cmd *simproto.ControlCommand) error {
	c.controlMu.Lock()
	defer c.controlMu.Unlock()

	if c.controlConn == nil {
		return fmt.Errorf("control pipe not connected")
	}

	data, err := proto.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("failed to marshal control command: %w", err)
	}

	if err := pipe.WriteMessage(c.controlConn, data); err != nil {
		return fmt.Errorf("failed to write to control pipe: %w", err)
	}

	c.logger.Debug("sent control command",
		"command_id", cmd.GetCommandId(),
	)
	return nil
}

// Done returns a channel that is closed when the connector exits.
func (c *Connector) Done() <-chan struct{} {
	return c.done
}

// broadcastEvent converts a SimEvent to a WSMessage and broadcasts it.
func (c *Connector) broadcastEvent(evt *simproto.SimEvent) {
	typeName, payload := PayloadType(evt)
	if typeName == "unknown" {
		return
	}

	wsType, ok := ws.ProtoTypeToWS[typeName]
	if !ok {
		c.logger.Warn("unknown event type, skipping broadcast", "type", typeName)
		return
	}

	c.hub.BroadcastEvent(wsType, evt.GetSimTime(), payload)
}

// unmarshalEvent deserializes a SimEvent from Protobuf binary.
func unmarshalEvent(data []byte) (*simproto.SimEvent, error) {
	evt := &simproto.SimEvent{}
	if err := proto.Unmarshal(data, evt); err != nil {
		return nil, fmt.Errorf("proto unmarshal: %w", err)
	}
	return evt, nil
}

// PayloadType returns the event type name and the payload for a SimEvent.
func PayloadType(e *simproto.SimEvent) (typeName string, payload interface{}) {
	switch e.GetPayload().(type) {
	case *simproto.SimEvent_SimStarting:
		return "sim_starting", e.GetSimStarting()
	case *simproto.SimEvent_SimComplete:
		return "sim_complete", e.GetSimComplete()
	case *simproto.SimEvent_SimPausing:
		return "sim_pausing", e.GetSimPausing()
	case *simproto.SimEvent_SimResuming:
		return "sim_resuming", e.GetSimResuming()
	case *simproto.SimEvent_FrameComplete:
		return "frame_complete", e.GetFrameComplete()
	case *simproto.SimEvent_PlatformAdded:
		return "platform_added", e.GetPlatformAdded()
	case *simproto.SimEvent_PlatformInitialized:
		return "platform_initialized", e.GetPlatformInitialized()
	case *simproto.SimEvent_PlatformDeleted:
		return "platform_deleted", e.GetPlatformDeleted()
	case *simproto.SimEvent_PlatformBroken:
		return "platform_broken", e.GetPlatformBroken()
	case *simproto.SimEvent_PlatformDamageChanged:
		return "platform_damage_changed", e.GetPlatformDamageChanged()
	case *simproto.SimEvent_MoverUpdated:
		return "mover_updated", e.GetMoverUpdated()
	case *simproto.SimEvent_SensorTurnedOn:
		return "sensor_turned_on", e.GetSensorTurnedOn()
	case *simproto.SimEvent_SensorTurnedOff:
		return "sensor_turned_off", e.GetSensorTurnedOff()
	case *simproto.SimEvent_SensorDetectionChanged:
		return "sensor_detection_changed", e.GetSensorDetectionChanged()
	case *simproto.SimEvent_SensorTrackInitiated:
		return "sensor_track_initiated", e.GetSensorTrackInitiated()
	case *simproto.SimEvent_SensorTrackDropped:
		return "sensor_track_dropped", e.GetSensorTrackDropped()
	case *simproto.SimEvent_WeaponFired:
		return "weapon_fired", e.GetWeaponFired()
	case *simproto.SimEvent_WeaponHit:
		return "weapon_hit", e.GetWeaponHit()
	case *simproto.SimEvent_WeaponMissed:
		return "weapon_missed", e.GetWeaponMissed()
	case *simproto.SimEvent_WeaponTerminated:
		return "weapon_terminated", e.GetWeaponTerminated()
	case *simproto.SimEvent_TrackInitiated:
		return "track_initiated", e.GetTrackInitiated()
	case *simproto.SimEvent_TrackUpdated:
		return "track_updated", e.GetTrackUpdated()
	case *simproto.SimEvent_TrackDropped:
		return "track_dropped", e.GetTrackDropped()
	case *simproto.SimEvent_ZoneEntered:
		return "zone_entered", e.GetZoneEntered()
	case *simproto.SimEvent_ZoneExited:
		return "zone_exited", e.GetZoneExited()
	case *simproto.SimEvent_FuelEvent:
		return "fuel_event", e.GetFuelEvent()
	case *simproto.SimEvent_Comment:
		return "comment", e.GetComment()
	case *simproto.SimEvent_TaskAssigned:
		return "task_assigned", e.GetTaskAssigned()
	case *simproto.SimEvent_TaskCompleted:
		return "task_completed", e.GetTaskCompleted()
	case *simproto.SimEvent_TaskCanceled:
		return "task_canceled", e.GetTaskCanceled()
	default:
		return "unknown", nil
	}
}
