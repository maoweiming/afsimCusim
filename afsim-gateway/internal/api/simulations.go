package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/truesim/afsim-gateway/internal/proto"
)

// createSimulationRequest is the JSON body for POST /api/simulations.
type createSimulationRequest struct {
	ScenarioID string `json:"scenario_id"`
	Mode       string `json:"mode"` // "event_step" | "frame_step" | "realtime"
}

// clockRateRequest is the JSON body for POST /api/simulations/{id}/clock-rate.
type clockRateRequest struct {
	Rate float64 `json:"rate"`
}

// stepRequest is the JSON body for POST /api/simulations/{id}/step.
type stepRequest struct {
	StepTime float64 `json:"step_time"`
}

// handleCreateSimulation starts a new simulation.
func (a *API) handleCreateSimulation(w http.ResponseWriter, r *http.Request) {
	var req createSimulationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if req.ScenarioID == "" {
		writeError(w, http.StatusBadRequest, "scenario_id is required")
		return
	}

	if req.Mode == "" {
		req.Mode = "realtime"
	}

	sim, err := a.simulations.Create(req.ScenarioID, req.Mode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, sim)
}

// handleGetSimulation returns the status of a simulation.
func (a *API) handleGetSimulation(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	sim, found := a.simulations.Get(id)
	if !found {
		writeError(w, http.StatusNotFound, "simulation not found")
		return
	}

	writeJSON(w, http.StatusOK, sim)
}

// handlePauseSimulation sends a pause command to the simulation.
func (a *API) handlePauseSimulation(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	connector := a.simulations.GetConnector(id)
	if connector == nil {
		writeError(w, http.StatusNotFound, "simulation not found or not connected")
		return
	}

	cmd := newControlCommand()
	cmd.Command = &proto.ControlCommand_Pause{Pause: &proto.PauseCommand{}}

	if err := connector.SendControl(cmd); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to send pause command: "+err.Error())
		return
	}

	a.simulations.SetStatus(id, "paused")
	a.state.SetClockRate(0)

	writeJSON(w, http.StatusOK, map[string]string{"status": "paused"})
}

// handleResumeSimulation sends a resume command to the simulation.
func (a *API) handleResumeSimulation(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	connector := a.simulations.GetConnector(id)
	if connector == nil {
		writeError(w, http.StatusNotFound, "simulation not found or not connected")
		return
	}

	cmd := newControlCommand()
	cmd.Command = &proto.ControlCommand_Resume{Resume: &proto.ResumeCommand{}}

	if err := connector.SendControl(cmd); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to send resume command: "+err.Error())
		return
	}

	a.simulations.SetStatus(id, "running")

	writeJSON(w, http.StatusOK, map[string]string{"status": "running"})
}

// handleStepSimulation sends a step command to advance the simulation.
func (a *API) handleStepSimulation(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	connector := a.simulations.GetConnector(id)
	if connector == nil {
		writeError(w, http.StatusNotFound, "simulation not found or not connected")
		return
	}

	var req stepRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.StepTime = 1.0
	}

	cmd := newControlCommand()
	cmd.Command = &proto.ControlCommand_Step{Step: &proto.StepCommand{
		StepTime: req.StepTime,
	}}

	if err := connector.SendControl(cmd); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to send step command: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "stepped",
		"step_time": req.StepTime,
	})
}

// handleSetClockRate sends a set-clock-rate command to the simulation.
func (a *API) handleSetClockRate(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	connector := a.simulations.GetConnector(id)
	if connector == nil {
		writeError(w, http.StatusNotFound, "simulation not found or not connected")
		return
	}

	var req clockRateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if req.Rate <= 0 {
		writeError(w, http.StatusBadRequest, "rate must be positive")
		return
	}

	cmd := newControlCommand()
	cmd.Command = &proto.ControlCommand_SetClockRate{SetClockRate: &proto.SetClockRate{
		Rate: req.Rate,
	}}

	if err := connector.SendControl(cmd); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to send clock-rate command: "+err.Error())
		return
	}

	a.state.SetClockRate(req.Rate)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":     "clock_rate_set",
		"clock_rate": req.Rate,
	})
}

// handleTerminateSimulation terminates a running simulation.
func (a *API) handleTerminateSimulation(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	connector := a.simulations.GetConnector(id)
	if connector != nil {
		cmd := newControlCommand()
		cmd.Command = &proto.ControlCommand_Terminate{Terminate: &proto.TerminateCommand{}}
		_ = connector.SendControl(cmd)
	}

	a.simulations.Delete(id)

	writeJSON(w, http.StatusOK, map[string]string{"status": "terminated"})
}

// handleDownloadOutput serves output files from the simulation output directory.
func (a *API) handleDownloadOutput(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid simulation id")
		return
	}

	fileType := chi.URLParam(r, "type")
	if fileType == "" {
		writeError(w, http.StatusBadRequest, "missing file type")
		return
	}

	allowedTypes := map[string]string{
		"evt": ".evt",
		"aer": ".aer",
		"log": ".log",
	}

	ext, allowed := allowedTypes[fileType]
	if !allowed {
		writeError(w, http.StatusBadRequest, "invalid file type; allowed: evt, aer, log")
		return
	}

	idStr := fmt.Sprintf("%d", id)

	entries, err := os.ReadDir(a.outputDir)
	if err != nil {
		writeError(w, http.StatusNotFound, "output directory not found")
		return
	}

	var targetFile string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ext) && strings.Contains(name, idStr) {
			targetFile = filepath.Join(a.outputDir, name)
			break
		}
	}

	if targetFile == "" {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			if strings.HasSuffix(entry.Name(), ext) {
				targetFile = filepath.Join(a.outputDir, entry.Name())
				break
			}
		}
	}

	if targetFile == "" {
		writeError(w, http.StatusNotFound, "no output file found for type: "+fileType)
		return
	}

	data, err := os.ReadFile(targetFile)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read output file")
		return
	}

	contentType := "text/plain"
	if fileType == "aer" {
		contentType = "application/octet-stream"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(targetFile))
	w.Write(data)
}
