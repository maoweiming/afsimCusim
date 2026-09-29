package handler

import (
	"encoding/json"
	"net/http"

	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
)

// HealthHandler handles the /health endpoint.
type HealthHandler struct {
	equipmentConn  *grpc.ClientConn
	scenarioConn   *grpc.ClientConn
	timeseriesConn *grpc.ClientConn
}

// NewHealthHandler creates a new HealthHandler.
// It accepts the three gRPC connections to check their status.
func NewHealthHandler(equipmentConn, scenarioConn, timeseriesConn *grpc.ClientConn) *HealthHandler {
	return &HealthHandler{
		equipmentConn:  equipmentConn,
		scenarioConn:   scenarioConn,
		timeseriesConn: timeseriesConn,
	}
}

// HealthResponse represents the health check response.
type HealthResponse struct {
	Status   string            `json:"status"`
	Services map[string]string `json:"services"`
}

// ServeHTTP handles GET /health.
func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	services := map[string]string{
		"equipment":  connectionStatus(h.equipmentConn),
		"scenario":   connectionStatus(h.scenarioConn),
		"timeseries": connectionStatus(h.timeseriesConn),
	}

	resp := HealthResponse{
		Status:   "ok",
		Services: services,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func connectionStatus(conn *grpc.ClientConn) string {
	if conn == nil {
		return "disconnected"
	}
	state := conn.GetState()
	if state == connectivity.Ready || state == connectivity.Idle {
		return "connected"
	}
	return "disconnected"
}
