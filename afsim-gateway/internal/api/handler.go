// Package api provides the REST API and WebSocket endpoints for the AFSIM gateway.
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"

	"github.com/truesim/afsim-gateway/internal/datasink"
	"github.com/truesim/afsim-gateway/internal/engine"
	"github.com/truesim/afsim-gateway/internal/proto"
	"github.com/truesim/afsim-gateway/internal/simstate"
	"github.com/truesim/afsim-gateway/internal/ws"
)

// API is the top-level HTTP handler for the gateway.
type API struct {
	router chi.Router
	hub    *ws.Hub
	state  *simstate.SimulationState

	scenarioDir string
	outputDir   string

	simulations *SimulationManager
	logger      *slog.Logger
}

// Config holds the API configuration.
type Config struct {
	ScenarioDir     string
	OutputDir       string
	MissionPath     string
	Port            int
	DataPlatformURL string // Base URL of the data-platform (empty = disabled)
}

// NewAPI creates a new API handler with all routes registered.
func NewAPI(cfg Config, state *simstate.SimulationState, hub *ws.Hub, logger *slog.Logger) *API {
	if logger == nil {
		logger = slog.Default()
	}

	a := &API{
		hub:         hub,
		state:       state,
		scenarioDir: cfg.ScenarioDir,
		outputDir:   cfg.OutputDir,
		simulations: NewSimulationManager(cfg.MissionPath, cfg.ScenarioDir, cfg.OutputDir, cfg.DataPlatformURL, hub, state, logger),
		logger:      logger,
	}

	a.setupRouter()
	return a
}

// setupRouter configures all HTTP routes and middleware.
func (a *API) setupRouter() {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(corsMiddleware)

	// Health check
	r.Get("/health", a.handleHealth)

	// REST API routes
	r.Route("/api", func(r chi.Router) {
		// Scenarios
		r.Get("/scenarios", a.handleListScenarios)
		r.Post("/scenarios", a.handleUploadScenario)
		r.Get("/scenarios/{id}", a.handleGetScenario)
		r.Put("/scenarios/{id}", a.handleUpdateScenario)
		r.Delete("/scenarios/{id}", a.handleDeleteScenario)

		// Simulations
		r.Post("/simulations", a.handleCreateSimulation)
		r.Get("/simulations/{id}", a.handleGetSimulation)
		r.Post("/simulations/{id}/pause", a.handlePauseSimulation)
		r.Post("/simulations/{id}/resume", a.handleResumeSimulation)
		r.Post("/simulations/{id}/step", a.handleStepSimulation)
		r.Post("/simulations/{id}/clock-rate", a.handleSetClockRate)
		r.Post("/simulations/{id}/terminate", a.handleTerminateSimulation)
		r.Post("/simulations/{id}/control/sensor-steer", a.handleSensorSteer)
		r.Post("/simulations/{id}/control/weapon-fire", a.handleWeaponFire)
		r.Get("/simulations/{id}/files/{type}", a.handleDownloadOutput)

		// WebSocket
		r.Get("/simulations/{id}/ws", a.handleWebSocket)
	})

	a.router = r
}

// ServeHTTP implements http.Handler.
func (a *API) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	a.router.ServeHTTP(w, r)
}

// Handler returns the chi.Router for use with http.Server.
func (a *API) Handler() chi.Router {
	return a.router
}

// handleHealth returns the gateway health status.
func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"uptime":    time.Since(startTime).String(),
		"clients":   a.hub.ClientCount(),
	})
}

var startTime = time.Now()

// corsMiddleware adds CORS headers for frontend development.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development
		return true
	},
}

// handleWebSocket upgrades an HTTP connection to WebSocket and registers the client.
func (a *API) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	simID := chi.URLParam(r, "id")
	a.logger.Info("WebSocket connection request", "simulation_id", simID)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		a.logger.Error("WebSocket upgrade failed", "error", err)
		return
	}

	client := ws.NewClient(a.hub, conn, a.logger.With("component", "ws-client"))
	a.hub.Register(client)

	// Run read and write pumps in separate goroutines
	go client.WritePump()
	go client.ReadPump()
}

// ---------------------------------------------------------------------------
// SimulationManager
// ---------------------------------------------------------------------------

// SimulationManager tracks active simulation instances.
type SimulationManager struct {
	mu              sync.Mutex
	nextID          atomic.Uint64
	missionPath     string
	scenarioDir     string
	outputDir       string
	dataPlatformURL string
	hub             *ws.Hub
	state           *simstate.SimulationState
	sims            map[uint64]*simInstance
	cancelFuncs     map[uint64]context.CancelFunc
	logger          *slog.Logger
}

// simInstance holds the internal state for a running simulation.
// The public-facing representation is the Simulation struct.
type simInstance struct {
	id         uint64
	scenarioID string
	mode       string
	status     string // "starting" | "running" | "paused" | "complete" | "error"
	clockRate  float64
	createdAt  time.Time
	err        string
	pid        int
	process    *engine.ProcessManager
	connector  *engine.Connector
}

// Simulation is the public JSON representation of a simulation instance.
type Simulation struct {
	ID         uint64  `json:"id"`
	ScenarioID string  `json:"scenario_id"`
	Mode       string  `json:"mode"`
	Status     string  `json:"status"`
	ClockRate  float64 `json:"clock_rate"`
	CreatedAt  string  `json:"created_at"`
	Error      string  `json:"error,omitempty"`
	Pid        int     `json:"pid,omitempty"`
}

// toSimulation converts an internal simInstance to a public Simulation.
func (si *simInstance) toSimulation() Simulation {
	return Simulation{
		ID:         si.id,
		ScenarioID: si.scenarioID,
		Mode:       si.mode,
		Status:     si.status,
		ClockRate:  si.clockRate,
		CreatedAt:  si.createdAt.Format(time.RFC3339),
		Error:      si.err,
		Pid:        si.pid,
	}
}

// NewSimulationManager creates a new SimulationManager.
func NewSimulationManager(missionPath, scenarioDir, outputDir, dataPlatformURL string, hub *ws.Hub, state *simstate.SimulationState, logger *slog.Logger) *SimulationManager {
	return &SimulationManager{
		missionPath:     missionPath,
		scenarioDir:     scenarioDir,
		outputDir:       outputDir,
		dataPlatformURL: dataPlatformURL,
		hub:             hub,
		state:           state,
		sims:            make(map[uint64]*simInstance),
		cancelFuncs:     make(map[uint64]context.CancelFunc),
		logger:          logger,
	}
}

// Create starts a new simulation.
func (sm *SimulationManager) Create(scenarioID, mode string) (*Simulation, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	id := sm.nextID.Add(1)
	si := &simInstance{
		id:         id,
		scenarioID: scenarioID,
		mode:       mode,
		status:     "starting",
		clockRate:  1.0,
		createdAt:  time.Now(),
	}

	// Create a cancellable context for this simulation
	ctx, cancel := context.WithCancel(context.Background())
	sm.cancelFuncs[id] = cancel

	// Create process manager
	pm := engine.NewProcessManager(engine.ProcessConfig{
		MissionPath: sm.missionPath,
		ScenarioDir: sm.scenarioDir,
		OutputDir:   sm.outputDir,
	}, sm.logger.With("simulation_id", id))

	si.process = pm

	// Create connector for pipe communication
	eventPipePath := os.Getenv("AFSIM_EVENT_PIPE")
	if eventPipePath == "" {
		eventPipePath = `\\.\pipe\afsim_events`
	}
	controlPipePath := os.Getenv("AFSIM_CONTROL_PIPE")
	if controlPipePath == "" {
		controlPipePath = `\\.\pipe\afsim_control`
	}

	// Create the appropriate event sink
	simIDStr := fmt.Sprintf("%d", id)
	var sink datasink.EventSink
	if sm.dataPlatformURL != "" {
		sink = datasink.NewTimeseriesSink(datasink.TimeseriesConfig{
			DataPlatformURL: sm.dataPlatformURL,
			SimID:           simIDStr,
			Logger:          sm.logger.With("component", "timeseries-sink", "simulation_id", id),
		})
		sm.logger.Info("timeseries sink enabled", "url", sm.dataPlatformURL, "simulation_id", id)
	} else {
		sink = datasink.NewNoopSink()
	}

	connector := engine.NewConnector(engine.ConnectorConfig{
		EventPipePath:   eventPipePath,
		ControlPipePath: controlPipePath,
		Sink:            sink,
		SimID:           simIDStr,
		ScenarioID:      scenarioID,
	}, sm.state, sm.hub, sm.logger.With("simulation_id", id))

	si.connector = connector
	sm.sims[id] = si

	// Start the process
	if err := pm.Start(ctx, scenarioID, mode); err != nil {
		si.status = "error"
		si.err = err.Error()
		sim := si.toSimulation()
		return &sim, err
	}

	si.status = "running"
	si.pid = pm.Pid()

	// Start the connector in a goroutine
	go func() {
		err := connector.Run(ctx)
		if err == nil {
			return
		}
		// When mission.exe exits normally, its end of the event pipe closes,
		// which surfaces here as a read error even though the simulation
		// completed successfully. Give the process-exit monitor a chance to
		// classify this as "complete" before treating it as a real error.
		select {
		case <-pm.ExitCh():
			if exitErr := pm.ExitErr(); exitErr != nil {
				sm.logger.Error("connector error", "simulation_id", id, "error", exitErr)
				sm.mu.Lock()
				if s, ok := sm.sims[id]; ok && s.status != "complete" {
					s.status = "error"
					s.err = fmt.Sprintf("mission.exe exited with error: %v", exitErr)
				}
				sm.mu.Unlock()
			}
		case <-time.After(2 * time.Second):
			sm.logger.Error("connector error", "simulation_id", id, "error", err)
			sm.mu.Lock()
			if s, ok := sm.sims[id]; ok && s.status != "complete" {
				s.status = "error"
				s.err = err.Error()
			}
			sm.mu.Unlock()
		}
	}()

	// Monitor process exit
	go func() {
		<-pm.ExitCh()
		sm.mu.Lock()
		if s, ok := sm.sims[id]; ok && s.status != "error" {
			s.status = "complete"
		}
		sm.mu.Unlock()
	}()

	sim := si.toSimulation()
	return &sim, nil
}

// Get returns a simulation by ID.
func (sm *SimulationManager) Get(id uint64) (*Simulation, bool) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	si, ok := sm.sims[id]
	if !ok {
		return nil, false
	}
	sim := si.toSimulation()
	return &sim, true
}

// GetConnector returns the connector for a simulation, if it exists.
func (sm *SimulationManager) GetConnector(id uint64) *engine.Connector {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	si, ok := sm.sims[id]
	if !ok {
		return nil
	}
	return si.connector
}

// List returns all simulations.
func (sm *SimulationManager) List() []Simulation {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	result := make([]Simulation, 0, len(sm.sims))
	for _, si := range sm.sims {
		result = append(result, si.toSimulation())
	}
	return result
}

// Delete removes a simulation (terminating it if running).
func (sm *SimulationManager) Delete(id uint64) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	si, ok := sm.sims[id]
	if !ok {
		return
	}

	if si.process != nil && si.process.IsRunning() {
		si.process.Terminate()
	}

	if cancel, ok := sm.cancelFuncs[id]; ok {
		cancel()
		delete(sm.cancelFuncs, id)
	}

	delete(sm.sims, id)
}

// SetStatus updates the status of a simulation.
func (sm *SimulationManager) SetStatus(id uint64, status string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if si, ok := sm.sims[id]; ok {
		si.status = status
	}
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

// writeJSON is a helper that writes a JSON response with the appropriate content type.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	data, err := json.Marshal(v)
	if err != nil {
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}
	w.Write(data)
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// parseID parses a simulation ID from a URL parameter.
func parseID(r *http.Request, param string) (uint64, bool) {
	str := chi.URLParam(r, param)
	id, err := strconv.ParseUint(str, 10, 64)
	if err != nil {
		return 0, false
	}
	return id, true
}

// newControlCommand creates a ControlCommand with an auto-incrementing ID.
var controlIDCounter atomic.Uint64

func newControlCommand() *proto.ControlCommand {
	return &proto.ControlCommand{
		CommandId: controlIDCounter.Add(1),
	}
}

// ---------------------------------------------------------------------------
// Sensor Steer & Weapon Fire control endpoints
// ---------------------------------------------------------------------------

// sensorSteerRequest is the JSON body for POST /simulations/{id}/control/sensor-steer.
type sensorSteerRequest struct {
	PlatformIndex uint64  `json:"platform_index"`
	SensorName    string  `json:"sensor_name"`
	Azimuth       float64 `json:"azimuth"`
	Elevation     float64 `json:"elevation"`
}

// weaponFireRequest is the JSON body for POST /simulations/{id}/control/weapon-fire.
type weaponFireRequest struct {
	FiringPlatformIndex uint64 `json:"firing_platform_index"`
	WeaponName          string `json:"weapon_name"`
	TargetPlatformIndex uint64 `json:"target_platform_index"`
}

// handleSensorSteer handles POST /api/simulations/{id}/control/sensor-steer.
func (a *API) handleSensorSteer(w http.ResponseWriter, r *http.Request) {
	simID, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	var req sensorSteerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	connector := a.simulations.GetConnector(simID)
	if connector == nil {
		writeError(w, http.StatusNotFound, "simulation not found or not running")
		return
	}

	// TODO: Extend ControlCommand proto with SensorSteer variant and send here.
	// The connector.SendControl() infrastructure is ready once the proto is updated.
	_ = connector

	writeError(w, http.StatusNotImplemented,
		fmt.Sprintf("sensor-steer not yet supported in proto (platform=%d sensor=%s az=%.1f el=%.1f)",
			req.PlatformIndex, req.SensorName, req.Azimuth, req.Elevation))
}

// handleWeaponFire handles POST /api/simulations/{id}/control/weapon-fire.
func (a *API) handleWeaponFire(w http.ResponseWriter, r *http.Request) {
	simID, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	var req weaponFireRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	connector := a.simulations.GetConnector(simID)
	if connector == nil {
		writeError(w, http.StatusNotFound, "simulation not found or not running")
		return
	}

	// TODO: Extend ControlCommand proto with WeaponFire variant and send here.
	// The connector.SendControl() infrastructure is ready once the proto is updated.
	_ = connector

	writeError(w, http.StatusNotImplemented,
		fmt.Sprintf("weapon-fire not yet supported in proto (firing=%d weapon=%s target=%d)",
			req.FiringPlatformIndex, req.WeaponName, req.TargetPlatformIndex))
}
