package datasink

import (
	"sync"
	"testing"

	simproto "github.com/truesim/afsim-gateway/internal/proto"
)

// ---------------------------------------------------------------------------
// TestBuildFrameFromMoverUpdated verifies that a MoverUpdated event correctly
// populates the frame fields.
// ---------------------------------------------------------------------------

func TestBuildFrameFromMoverUpdated(t *testing.T) {
	sink := &TimeseriesSink{
		frames:       make(map[uint64]*SimulationFrame),
		platformMeta: make(map[uint64]platformMeta),
	}

	// First add a platform so metadata is available
	addEvt := &simproto.SimEvent{
		SimTime: 1.0,
		Payload: &simproto.SimEvent_PlatformAdded{
			PlatformAdded: &simproto.PlatformAdded{
				Platform: &simproto.PlatformData{
					Index: 42,
					Name:  "F-16",
					Side:  "blue",
				},
			},
		},
	}
	sink.processEvent(addEvt)

	// Then send a MoverUpdated
	moverEvt := &simproto.SimEvent{
		SimTime: 2.5,
		Payload: &simproto.SimEvent_MoverUpdated{
			MoverUpdated: &simproto.MoverUpdated{
				PlatformIndex: 42,
				Lat:           30.0,
				Lon:           120.0,
				Alt:           5000.0,
				Heading:       45.0,
				VelN:          100.0,
				VelE:          50.0,
				VelD:          0.0,
			},
		},
	}
	sink.processEvent(moverEvt)

	sink.mu.Lock()
	f, ok := sink.frames[42]
	sink.mu.Unlock()

	if !ok {
		t.Fatal("expected frame for platform 42")
	}

	if f.SimTime != 2.5 {
		t.Errorf("SimTime = %f, want 2.5", f.SimTime)
	}
	if f.PlatformID != "42" {
		t.Errorf("PlatformID = %q, want %q", f.PlatformID, "42")
	}
	if f.PlatformName != "F-16" {
		t.Errorf("PlatformName = %q, want %q", f.PlatformName, "F-16")
	}
	if f.Side != "blue" {
		t.Errorf("Side = %q, want %q", f.Side, "blue")
	}
	if f.Position == nil {
		t.Fatal("expected non-nil Position")
	}
	if f.Position.Latitude != 30.0 {
		t.Errorf("Latitude = %f, want 30.0", f.Position.Latitude)
	}
	if f.Position.Longitude != 120.0 {
		t.Errorf("Longitude = %f, want 120.0", f.Position.Longitude)
	}
	if f.Position.Altitude != 5000.0 {
		t.Errorf("Position.Altitude = %f, want 5000.0", f.Position.Altitude)
	}
	if f.Velocity == nil {
		t.Fatal("expected non-nil Velocity")
	}
	if f.Velocity.North != 100.0 {
		t.Errorf("VelN = %f, want 100.0", f.Velocity.North)
	}
	if f.Velocity.East != 50.0 {
		t.Errorf("VelE = %f, want 50.0", f.Velocity.East)
	}
	if f.Velocity.Down != 0.0 {
		t.Errorf("VelD = %f, want 0.0", f.Velocity.Down)
	}
	if f.Heading != 45.0 {
		t.Errorf("Heading = %f, want 45.0", f.Heading)
	}
	if f.Altitude != 5000.0 {
		t.Errorf("Altitude = %f, want 5000.0", f.Altitude)
	}
	if f.Status != "active" {
		t.Errorf("Status = %q, want %q", f.Status, "active")
	}
}

// ---------------------------------------------------------------------------
// TestAccumulationFlush verifies that multiple events produce a correct batch
// that can be flushed (we intercept the batch by inspecting the frames map).
// ---------------------------------------------------------------------------

func TestAccumulationFlush(t *testing.T) {
	sink := &TimeseriesSink{
		frames:       make(map[uint64]*SimulationFrame),
		platformMeta: make(map[uint64]platformMeta),
	}

	events := []*simproto.SimEvent{
		{
			SimTime: 1.0,
			Payload: &simproto.SimEvent_MoverUpdated{
				MoverUpdated: &simproto.MoverUpdated{
					PlatformIndex: 1,
					Lat:           10.0,
					Lon:           20.0,
					Alt:           1000.0,
					Heading:       90.0,
				},
			},
		},
		{
			SimTime: 1.5,
			Payload: &simproto.SimEvent_MoverUpdated{
				MoverUpdated: &simproto.MoverUpdated{
					PlatformIndex: 2,
					Lat:           30.0,
					Lon:           40.0,
					Alt:           2000.0,
					Heading:       180.0,
				},
			},
		},
		{
			SimTime: 2.0,
			Payload: &simproto.SimEvent_PlatformDamageChanged{
				PlatformDamageChanged: &simproto.PlatformDamageChanged{
					Index:  1,
					Damage: 0.5,
				},
			},
		},
		{
			SimTime: 2.5,
			Payload: &simproto.SimEvent_SensorTurnedOn{
				SensorTurnedOn: &simproto.SensorTurnedOn{
					Sensor: &simproto.SensorEvent{
						PlatformIndex: 1,
						SensorName:    "Radar",
						SensorType:    "SEARCH",
					},
				},
			},
		},
		{
			SimTime: 3.0,
			Payload: &simproto.SimEvent_FuelEvent{
				FuelEvent: &simproto.FuelEvent{
					PlatformIndex: 2,
					FuelName:      "JP-8",
					Quantity:      0.75,
				},
			},
		},
		{
			SimTime: 3.5,
			Payload: &simproto.SimEvent_PlatformBroken{
				PlatformBroken: &simproto.PlatformBroken{
					Index:  2,
					Damage: 1.0,
				},
			},
		},
	}

	for _, evt := range events {
		sink.processEvent(evt)
	}

	sink.mu.Lock()
	defer sink.mu.Unlock()

	if len(sink.frames) != 2 {
		t.Fatalf("expected 2 frames, got %d", len(sink.frames))
	}

	// Check platform 1
	f1 := sink.frames[1]
	if f1 == nil {
		t.Fatal("expected frame for platform 1")
	}
	if f1.SimTime != 2.5 {
		t.Errorf("platform 1 SimTime = %f, want 2.5", f1.SimTime)
	}
	if f1.DamageLevel != 0.5 {
		t.Errorf("platform 1 DamageLevel = %f, want 0.5", f1.DamageLevel)
	}
	if len(f1.Sensors) != 1 {
		t.Fatalf("platform 1 sensors = %d, want 1", len(f1.Sensors))
	}
	if f1.Sensors[0].Name != "Radar" || !f1.Sensors[0].On {
		t.Errorf("platform 1 sensor = %+v, want Radar on", f1.Sensors[0])
	}
	if f1.Position == nil || f1.Position.Latitude != 10.0 {
		t.Errorf("platform 1 Position = %+v, want lat=10", f1.Position)
	}

	// Check platform 2
	f2 := sink.frames[2]
	if f2 == nil {
		t.Fatal("expected frame for platform 2")
	}
	if f2.Status != "destroyed" {
		t.Errorf("platform 2 Status = %q, want %q", f2.Status, "destroyed")
	}
	if f2.DamageLevel != 1.0 {
		t.Errorf("platform 2 DamageLevel = %f, want 1.0", f2.DamageLevel)
	}
	if f2.FuelRemaining != 0.75 {
		t.Errorf("platform 2 FuelRemaining = %f, want 0.75", f2.FuelRemaining)
	}
}

// ---------------------------------------------------------------------------
// TestNoopSinkDoesNothing verifies that NoopSink methods don't panic.
// ---------------------------------------------------------------------------

func TestNoopSinkDoesNothing(t *testing.T) {
	sink := NewNoopSink()

	// These should all be safe no-ops
	sink.OnEvent(&simproto.SimEvent{})
	sink.OnSimulationStart("sim-1", "scenario-1")
	sink.OnSimulationComplete("sim-1")

	if err := sink.Flush(); err != nil {
		t.Errorf("Flush() returned error: %v", err)
	}
	if err := sink.Close(); err != nil {
		t.Errorf("Close() returned error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// TestSensorToggle verifies that toggling a sensor on/off updates the frame.
// ---------------------------------------------------------------------------

func TestSensorToggle(t *testing.T) {
	sink := &TimeseriesSink{
		frames:       make(map[uint64]*SimulationFrame),
		platformMeta: make(map[uint64]platformMeta),
	}

	// Turn sensor on
	sink.processEvent(&simproto.SimEvent{
		SimTime: 1.0,
		Payload: &simproto.SimEvent_SensorTurnedOn{
			SensorTurnedOn: &simproto.SensorTurnedOn{
				Sensor: &simproto.SensorEvent{
					PlatformIndex: 5,
					SensorName:    "IRST",
					SensorType:    "INFRA_RED",
				},
			},
		},
	})

	sink.mu.Lock()
	f := sink.frames[5]
	sink.mu.Unlock()

	if f == nil || len(f.Sensors) != 1 || !f.Sensors[0].On {
		t.Fatal("expected sensor IRST to be on")
	}

	// Turn sensor off
	sink.processEvent(&simproto.SimEvent{
		SimTime: 1.5,
		Payload: &simproto.SimEvent_SensorTurnedOff{
			SensorTurnedOff: &simproto.SensorTurnedOff{
				Sensor: &simproto.SensorEvent{
					PlatformIndex: 5,
					SensorName:    "IRST",
					SensorType:    "INFRA_RED",
				},
			},
		},
	})

	sink.mu.Lock()
	f = sink.frames[5]
	sink.mu.Unlock()

	if f == nil || len(f.Sensors) != 1 || f.Sensors[0].On {
		t.Fatal("expected sensor IRST to be off")
	}
}

// ---------------------------------------------------------------------------
// TestConcurrentOnEvent verifies that OnEvent is safe for concurrent use.
// ---------------------------------------------------------------------------

func TestConcurrentOnEvent(t *testing.T) {
	sink := &TimeseriesSink{
		frames:       make(map[uint64]*SimulationFrame),
		platformMeta: make(map[uint64]platformMeta),
		evtCh:        make(chan *simproto.SimEvent, 1024),
		done:         make(chan struct{}),
	}

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				sink.OnEvent(&simproto.SimEvent{
					SimTime: float64(j),
					Payload: &simproto.SimEvent_MoverUpdated{
						MoverUpdated: &simproto.MoverUpdated{
							PlatformIndex: 1,
							Lat:           float64(j),
						},
					},
				})
			}
		}()
	}
	wg.Wait()

	// Drain the channel and process
	close(sink.done)
	sink.drainEvents()

	// Should not have panicked
	sink.mu.Lock()
	f := sink.frames[1]
	sink.mu.Unlock()

	if f == nil {
		t.Fatal("expected frame for platform 1 after concurrent events")
	}
}
