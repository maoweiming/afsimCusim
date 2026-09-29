package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	pb "truesim/gen/pb/timeseries"
)

// TimeseriesHandler handles REST API requests for timeseries data.
type TimeseriesHandler struct {
	client pb.TimeseriesServiceClient
}

// NewTimeseriesHandler creates a new TimeseriesHandler.
func NewTimeseriesHandler(client pb.TimeseriesServiceClient) *TimeseriesHandler {
	return &TimeseriesHandler{client: client}
}

// RegisterRoutes registers all timeseries-related routes on the given router.
func (h *TimeseriesHandler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/timeseries/data", h.WriteSimulationData).Methods("POST")
	r.HandleFunc("/api/v1/timeseries/query", h.QueryTimeRange).Methods("GET")
	r.HandleFunc("/api/v1/timeseries/replays", h.CreateReplay).Methods("POST")
	r.HandleFunc("/api/v1/timeseries/replays", h.ListReplays).Methods("GET")
	r.HandleFunc("/api/v1/timeseries/replays/{id}", h.GetReplay).Methods("GET")
	r.HandleFunc("/api/v1/timeseries/replays/{id}", h.DeleteReplay).Methods("DELETE")
	r.HandleFunc("/api/v1/timeseries/stats/{id}", h.GetStatistics).Methods("GET")
	r.HandleFunc("/api/v1/timeseries/scenarios/{id}/comparison", h.GetScenarioComparison).Methods("GET")
}

// WriteSimulationData handles POST /api/v1/timeseries/data.
// Maps to gRPC WriteFrames.
func (h *TimeseriesHandler) WriteSimulationData(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var req pb.WriteFramesRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	resp, err := h.client.WriteFrames(r.Context(), &req)
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// QueryTimeRange handles GET /api/v1/timeseries/query.
// Maps to gRPC QueryFrames.
func (h *TimeseriesHandler) QueryTimeRange(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	req := &pb.QueryFramesRequest{
		SimulationId: q.Get("simulation_id"),
	}
	if v := q.Get("start_time"); v != "" {
		if t, err := strconv.ParseFloat(v, 64); err == nil {
			req.StartTime = t
		}
	}
	if v := q.Get("end_time"); v != "" {
		if t, err := strconv.ParseFloat(v, 64); err == nil {
			req.EndTime = t
		}
	}
	if platformIDs := q["platform_ids"]; len(platformIDs) > 0 {
		req.PlatformIds = platformIDs
	}
	if v := q.Get("limit"); v != "" {
		if l, err := strconv.ParseInt(v, 10, 32); err == nil {
			req.Limit = int32(l)
		}
	}
	if v := q.Get("offset"); v != "" {
		if o, err := strconv.ParseInt(v, 10, 32); err == nil {
			req.Offset = int32(o)
		}
	}

	resp, err := h.client.QueryFrames(r.Context(), req)
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// CreateReplay handles POST /api/v1/timeseries/replays.
func (h *TimeseriesHandler) CreateReplay(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var req pb.CreateReplayRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	resp, err := h.client.CreateReplay(r.Context(), &req)
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

// ListReplays handles GET /api/v1/timeseries/replays.
func (h *TimeseriesHandler) ListReplays(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	req := &pb.ListReplaysRequest{
		ScenarioId:   q.Get("scenario_id"),
		SimulationId: q.Get("simulation_id"),
	}
	if v := q.Get("page"); v != "" {
		if p, err := strconv.ParseInt(v, 10, 32); err == nil {
			req.Page = int32(p)
		}
	}
	if v := q.Get("page_size"); v != "" {
		if ps, err := strconv.ParseInt(v, 10, 32); err == nil {
			req.PageSize = int32(ps)
		}
	}

	resp, err := h.client.ListReplays(r.Context(), req)
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// GetReplay handles GET /api/v1/timeseries/replays/{id}.
func (h *TimeseriesHandler) GetReplay(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	resp, err := h.client.GetReplay(r.Context(), &pb.GetReplayRequest{Id: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// GetStatistics handles GET /api/v1/timeseries/stats/{id}.
// Maps to gRPC GetSimulationStats.
func (h *TimeseriesHandler) GetStatistics(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	resp, err := h.client.GetSimulationStats(r.Context(), &pb.GetStatsRequest{SimulationId: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// ScenarioComparisonEntry 多组仿真对比中的单次运行条目。
type ScenarioComparisonEntry struct {
	ReplayID     string              `json:"replay_id"`
	SimulationID string              `json:"simulation_id"`
	Name         string              `json:"name"`
	CreatedAt    string              `json:"created_at"`
	Stats        *pb.SimulationStats `json:"stats"`
}

// ScenarioComparisonResponse 场景级多组仿真对比结果。
type ScenarioComparisonResponse struct {
	ScenarioID string                     `json:"scenario_id"`
	Runs       []*ScenarioComparisonEntry `json:"runs"`
}

// GetScenarioComparison handles GET /api/v1/timeseries/scenarios/{id}/comparison.
// 聚合接口：基于现有 ListReplays + GetSimulationStats RPC 组合而成，
// 按 scenario_id 取出该场景下所有回放运行，逐一拉取统计后并排返回，
// 用于前端"多组仿真对比分析"视图，无需新增 protobuf 消息/重新生成 stub。
func (h *TimeseriesHandler) GetScenarioComparison(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["id"]
	if scenarioID == "" {
		writeError(w, http.StatusBadRequest, "scenario id is required")
		return
	}

	replaysResp, err := h.client.ListReplays(r.Context(), &pb.ListReplaysRequest{ScenarioId: scenarioID})
	if err != nil {
		writeGRPCError(w, err)
		return
	}

	entries := make([]*ScenarioComparisonEntry, 0, len(replaysResp.Replays))
	for _, replay := range replaysResp.Replays {
		statsResp, err := h.client.GetSimulationStats(r.Context(), &pb.GetStatsRequest{SimulationId: replay.SimulationId})
		if err != nil {
			// 单次运行缺少统计数据不应阻断整体对比结果
			continue
		}
		entries = append(entries, &ScenarioComparisonEntry{
			ReplayID:     replay.Id,
			SimulationID: replay.SimulationId,
			Name:         replay.Name,
			CreatedAt:    replay.CreatedAt,
			Stats:        statsResp,
		})
	}

	writeJSON(w, http.StatusOK, &ScenarioComparisonResponse{
		ScenarioID: scenarioID,
		Runs:       entries,
	})
}

// DeleteReplay handles DELETE /api/v1/timeseries/replays/{id}.
func (h *TimeseriesHandler) DeleteReplay(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	_, err := h.client.DeleteReplay(r.Context(), &pb.DeleteReplayRequest{Id: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
