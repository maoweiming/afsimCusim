package datasink

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	simproto "github.com/truesim/afsim-gateway/internal/proto"
)

// ---------------------------------------------------------------------------
// JSON structures matching the data-platform timeseries API
// ---------------------------------------------------------------------------

// SimulationFrame is the JSON representation of a single platform state at a
// point in simulation time, sent to the data-platform's timeseries service.
type SimulationFrame struct {
	SimTime       float64         `json:"sim_time"`
	PlatformID    string          `json:"platform_id"`
	PlatformName  string          `json:"platform_name"`
	Side          string          `json:"side"`
	Position      *Position       `json:"position,omitempty"`
	Velocity      *Velocity       `json:"velocity,omitempty"`
	Heading       float32         `json:"heading"`
	Altitude      float64         `json:"altitude"`
	Sensors       []SensorInfo    `json:"sensors"`
	Weapons       []WeaponInfo    `json:"weapons"`
	Status        string          `json:"status"`
	FuelRemaining float64         `json:"fuel_remaining"`
	DamageLevel   float64         `json:"damage_level"`
}

// Position holds geographic coordinates.
type Position struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Altitude  float64 `json:"altitude"`
}

// Velocity holds NED velocity components in m/s.
type Velocity struct {
	North float64 `json:"north"`
	East  float64 `json:"east"`
	Down  float64 `json:"down"`
}

// SensorInfo is a compact sensor representation for the data-platform.
type SensorInfo struct {
	Name string `json:"name"`
	Type string `json:"type"`
	On   bool   `json:"on"`
}

// WeaponInfo is a compact weapon representation for the data-platform.
type WeaponInfo struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

// timeseriesBatch is the top-level JSON body sent to the data-platform.
type timeseriesBatch struct {
	SimulationID string            `json:"simulation_id"`
	Frames       []*SimulationFrame `json:"frames"`
}

// replayRegistration is the JSON body sent to register a new replay.
type replayRegistration struct {
	SimulationID string `json:"simulation_id"`
	ScenarioID   string `json:"scenario_id"`
}

// ---------------------------------------------------------------------------
// TimeseriesSink implementation
// ---------------------------------------------------------------------------

// TimeseriesConfig holds configuration for the TimeseriesSink.
type TimeseriesConfig struct {
	DataPlatformURL string        // Base URL of the data-platform (e.g. "http://localhost:9090")
	SimID           string        // Simulation ID used in API calls
	FlushInterval   time.Duration // How often to flush buffered frames (default 5s)
	FlushBatchSize  int           // Max frames per HTTP POST (default 50)
	Logger          *slog.Logger
}

// TimeseriesSink is an EventSink that accumulates platform frames and
// periodically POSTs them to the data-platform's timeseries REST API.
//
// All HTTP calls happen in a background goroutine; the event-processing
// goroutine never blocks on network I/O.
type TimeseriesSink struct {
	cfg    TimeseriesConfig
	client *http.Client
	logger *slog.Logger

	mu     sync.Mutex
	frames map[uint64]*SimulationFrame // keyed by platform_index

	// internal platform metadata cache (populated from PlatformAdded/PlatformInitialized)
	platformMeta map[uint64]platformMeta

	evtCh chan *simproto.SimEvent
	done  chan struct{}
	wg    sync.WaitGroup
}

// platformMeta caches name/side from PlatformAdded/Initialized events so that
// frames can reference them even if the first MoverUpdated arrives later.
type platformMeta struct {
	name string
	side string
}

// NewTimeseriesSink creates and starts a new TimeseriesSink.
// It launches a background goroutine that processes events and flushes
// frames periodically.
func NewTimeseriesSink(cfg TimeseriesConfig) *TimeseriesSink {
	if cfg.FlushInterval == 0 {
		cfg.FlushInterval = 5 * time.Second
	}
	if cfg.FlushBatchSize == 0 {
		cfg.FlushBatchSize = 50
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}

	s := &TimeseriesSink{
		cfg:          cfg,
		client:       &http.Client{Timeout: 10 * time.Second},
		logger:       cfg.Logger,
		frames:       make(map[uint64]*SimulationFrame),
		platformMeta: make(map[uint64]platformMeta),
		evtCh:        make(chan *simproto.SimEvent, 256),
		done:         make(chan struct{}),
	}

	s.wg.Add(1)
	go s.run()
	return s
}

// OnEvent enqueues an event for processing by the background goroutine.
// It never blocks (events are dropped if the channel is full).
func (s *TimeseriesSink) OnEvent(evt *simproto.SimEvent) {
	select {
	case s.evtCh <- evt:
	default:
		s.logger.Warn("timeseries sink event channel full, dropping event")
	}
}

// OnSimulationStart registers the simulation with the data-platform.
func (s *TimeseriesSink) OnSimulationStart(simID string, scenarioID string) {
	s.cfg.SimID = simID
	go s.registerReplay(simID, scenarioID)
}

// OnSimulationComplete performs a final flush.
func (s *TimeseriesSink) OnSimulationComplete(simID string) {
	if err := s.Flush(); err != nil {
		s.logger.Error("final flush failed on simulation complete", "error", err)
	}
}

// Flush sends all buffered frames to the data-platform.
func (s *TimeseriesSink) Flush() error {
	s.mu.Lock()
	if len(s.frames) == 0 {
		s.mu.Unlock()
		return nil
	}

	// Copy frames out and clear buffer
	batch := make([]*SimulationFrame, 0, len(s.frames))
	for _, f := range s.frames {
		batch = append(batch, f)
	}
	s.frames = make(map[uint64]*SimulationFrame)
	s.mu.Unlock()

	// Send in chunks of FlushBatchSize
	for i := 0; i < len(batch); i += s.cfg.FlushBatchSize {
		end := i + s.cfg.FlushBatchSize
		if end > len(batch) {
			end = len(batch)
		}
		if err := s.postBatch(batch[i:end]); err != nil {
			s.logger.Error("failed to post timeseries batch", "error", err, "frames", end-i)
			// Continue with remaining batches (graceful degradation)
		}
	}
	return nil
}

// Close signals the background goroutine to stop and waits for it to finish.
func (s *TimeseriesSink) Close() error {
	close(s.done)
	s.wg.Wait()
	return nil
}

// ---------------------------------------------------------------------------
// Background processing goroutine
// ---------------------------------------------------------------------------

func (s *TimeseriesSink) run() {
	defer s.wg.Done()

	ticker := time.NewTicker(s.cfg.FlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.done:
			// Drain remaining events
			s.drainEvents()
			s.Flush()
			return
		case evt := <-s.evtCh:
			s.processEvent(evt)
		case <-ticker.C:
			if err := s.Flush(); err != nil {
				s.logger.Error("periodic flush failed", "error", err)
			}
		}
	}
}

// drainEvents reads all remaining events from the channel without blocking.
func (s *TimeseriesSink) drainEvents() {
	for {
		select {
		case evt := <-s.evtCh:
			s.processEvent(evt)
		default:
			return
		}
	}
}

// processEvent updates the internal frame buffer from a single event.
func (s *TimeseriesSink) processEvent(evt *simproto.SimEvent) {
	switch e := evt.GetPayload().(type) {
	case *simproto.SimEvent_PlatformAdded:
		s.handlePlatformAdded(evt.GetSimTime(), e.PlatformAdded)
	case *simproto.SimEvent_PlatformInitialized:
		s.handlePlatformInitialized(evt.GetSimTime(), e.PlatformInitialized)
	case *simproto.SimEvent_MoverUpdated:
		s.handleMoverUpdated(evt.GetSimTime(), e.MoverUpdated)
	case *simproto.SimEvent_SensorTurnedOn:
		s.handleSensorState(evt.GetSimTime(), e.SensorTurnedOn.GetSensor(), true)
	case *simproto.SimEvent_SensorTurnedOff:
		s.handleSensorState(evt.GetSimTime(), e.SensorTurnedOff.GetSensor(), false)
	case *simproto.SimEvent_PlatformDamageChanged:
		s.handleDamageChanged(evt.GetSimTime(), e.PlatformDamageChanged)
	case *simproto.SimEvent_FuelEvent:
		s.handleFuelEvent(evt.GetSimTime(), e.FuelEvent)
	case *simproto.SimEvent_PlatformBroken:
		s.handlePlatformBroken(evt.GetSimTime(), e.PlatformBroken)
	case *simproto.SimEvent_FrameComplete:
		// Frame boundary — flush accumulated frames
		if err := s.Flush(); err != nil {
			s.logger.Error("flush on frame_complete failed", "error", err)
		}
	}
}

func (s *TimeseriesSink) handlePlatformAdded(simTime float64, pd *simproto.PlatformAdded) {
	if pd == nil || pd.GetPlatform() == nil {
		return
	}
	p := pd.GetPlatform()
	idx := p.GetIndex()

	s.mu.Lock()
	s.platformMeta[idx] = platformMeta{name: p.GetName(), side: p.GetSide()}
	f := s.getOrCreateFrame(idx, simTime)
	f.PlatformName = p.GetName()
	f.Side = p.GetSide()
	f.Position = &Position{Latitude: p.GetLat(), Longitude: p.GetLon(), Altitude: p.GetAlt()}
	f.Velocity = &Velocity{North: p.GetVelN(), East: p.GetVelE(), Down: p.GetVelD()}
	f.Heading = p.GetHeading()
	f.Altitude = p.GetAlt()
	f.DamageLevel = p.GetDamageFactor()
	s.mu.Unlock()
}

func (s *TimeseriesSink) handlePlatformInitialized(simTime float64, pi *simproto.PlatformInitialized) {
	if pi == nil || pi.GetPlatform() == nil {
		return
	}
	p := pi.GetPlatform()
	idx := p.GetIndex()

	s.mu.Lock()
	s.platformMeta[idx] = platformMeta{name: p.GetName(), side: p.GetSide()}
	f := s.getOrCreateFrame(idx, simTime)
	f.PlatformName = p.GetName()
	f.Side = p.GetSide()
	f.Position = &Position{Latitude: p.GetLat(), Longitude: p.GetLon(), Altitude: p.GetAlt()}
	f.Velocity = &Velocity{North: p.GetVelN(), East: p.GetVelE(), Down: p.GetVelD()}
	f.Heading = p.GetHeading()
	f.Altitude = p.GetAlt()
	f.DamageLevel = p.GetDamageFactor()
	s.mu.Unlock()
}

func (s *TimeseriesSink) handleMoverUpdated(simTime float64, m *simproto.MoverUpdated) {
	if m == nil {
		return
	}
	idx := m.GetPlatformIndex()

	s.mu.Lock()
	f := s.getOrCreateFrame(idx, simTime)
	f.Position = &Position{Latitude: m.GetLat(), Longitude: m.GetLon(), Altitude: m.GetAlt()}
	f.Velocity = &Velocity{North: m.GetVelN(), East: m.GetVelE(), Down: m.GetVelD()}
	f.Heading = m.GetHeading()
	f.Altitude = m.GetAlt()
	s.mu.Unlock()
}

func (s *TimeseriesSink) handleSensorState(simTime float64, se *simproto.SensorEvent, on bool) {
	if se == nil {
		return
	}
	idx := se.GetPlatformIndex()

	s.mu.Lock()
	f := s.getOrCreateFrame(idx, simTime)
	// Update or append sensor
	found := false
	for i := range f.Sensors {
		if f.Sensors[i].Name == se.GetSensorName() {
			f.Sensors[i].On = on
			found = true
			break
		}
	}
	if !found {
		f.Sensors = append(f.Sensors, SensorInfo{
			Name: se.GetSensorName(),
			Type: se.GetSensorType(),
			On:   on,
		})
	}
	s.mu.Unlock()
}

func (s *TimeseriesSink) handleDamageChanged(simTime float64, dc *simproto.PlatformDamageChanged) {
	if dc == nil {
		return
	}
	idx := dc.GetIndex()

	s.mu.Lock()
	f := s.getOrCreateFrame(idx, simTime)
	f.DamageLevel = dc.GetDamage()
	s.mu.Unlock()
}

func (s *TimeseriesSink) handleFuelEvent(simTime float64, fe *simproto.FuelEvent) {
	if fe == nil {
		return
	}
	idx := fe.GetPlatformIndex()

	s.mu.Lock()
	f := s.getOrCreateFrame(idx, simTime)
	f.FuelRemaining = fe.GetQuantity()
	s.mu.Unlock()
}

func (s *TimeseriesSink) handlePlatformBroken(simTime float64, pb *simproto.PlatformBroken) {
	if pb == nil {
		return
	}
	idx := pb.GetIndex()

	s.mu.Lock()
	f := s.getOrCreateFrame(idx, simTime)
	f.Status = "destroyed"
	f.DamageLevel = pb.GetDamage()
	s.mu.Unlock()
}

// getOrCreateFrame returns the frame for the given platform index, creating
// a new one (with metadata) if it does not exist. Caller must hold s.mu.
func (s *TimeseriesSink) getOrCreateFrame(idx uint64, simTime float64) *SimulationFrame {
	f, ok := s.frames[idx]
	if !ok {
		f = &SimulationFrame{
			SimTime:    simTime,
			PlatformID: fmt.Sprintf("%d", idx),
			Status:     "active",
			Sensors:    make([]SensorInfo, 0),
			Weapons:    make([]WeaponInfo, 0),
		}
		// Populate from cached metadata if available
		if meta, ok := s.platformMeta[idx]; ok {
			f.PlatformName = meta.name
			f.Side = meta.side
		}
		s.frames[idx] = f
	}
	// Update sim_time to latest
	f.SimTime = simTime
	return f
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

func (s *TimeseriesSink) postBatch(batch []*SimulationFrame) error {
	body := timeseriesBatch{
		SimulationID: s.cfg.SimID,
		Frames:       batch,
	}
	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal batch: %w", err)
	}

	url := s.cfg.DataPlatformURL + "/api/v1/timeseries/data"
	resp, err := s.client.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("POST %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("POST %s returned %d", url, resp.StatusCode)
	}
	s.logger.Debug("posted timeseries batch", "frames", len(batch), "status", resp.StatusCode)
	return nil
}

func (s *TimeseriesSink) registerReplay(simID, scenarioID string) {
	body := replayRegistration{
		SimulationID: simID,
		ScenarioID:   scenarioID,
	}
	data, err := json.Marshal(body)
	if err != nil {
		s.logger.Error("failed to marshal replay registration", "error", err)
		return
	}

	url := s.cfg.DataPlatformURL + "/api/v1/timeseries/replays"
	resp, err := s.client.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		s.logger.Error("failed to register replay", "error", err, "url", url)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		s.logger.Warn("replay registration returned non-2xx", "status", resp.StatusCode, "url", url)
		return
	}
	s.logger.Info("registered replay with data-platform", "sim_id", simID, "scenario_id", scenarioID)
}
