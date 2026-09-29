package datasink

import simproto "github.com/truesim/afsim-gateway/internal/proto"

// NoopSink is an EventSink that discards all events. It is used when no
// data-platform URL is configured.
type NoopSink struct{}

// NewNoopSink returns a new NoopSink.
func NewNoopSink() *NoopSink { return &NoopSink{} }

func (n *NoopSink) OnEvent(_ *simproto.SimEvent)                   {}
func (n *NoopSink) OnSimulationStart(_ string, _ string)           {}
func (n *NoopSink) OnSimulationComplete(_ string)                   {}
func (n *NoopSink) Flush() error                                   { return nil }
func (n *NoopSink) Close() error                                   { return nil }
