// Package datasink provides event sinks that forward simulation events to
// external data platforms (e.g. time-series storage for replay and analysis).
package datasink

import simproto "github.com/truesim/afsim-gateway/internal/proto"

// EventSink is the interface implemented by all event sinks.
// Implementations must be safe for concurrent use.
type EventSink interface {
	// OnEvent is called for every simulation event received from AFSIM.
	OnEvent(evt *simproto.SimEvent)

	// OnSimulationStart is called when a simulation begins.
	OnSimulationStart(simID string, scenarioID string)

	// OnSimulationComplete is called when a simulation ends.
	OnSimulationComplete(simID string)

	// Flush forces any buffered data to be written to the destination.
	Flush() error

	// Close releases resources held by the sink.
	Close() error
}
