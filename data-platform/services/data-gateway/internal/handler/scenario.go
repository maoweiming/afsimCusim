package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	pb "truesim/gen/pb/scenario"
)

// ScenarioHandler handles REST API requests for scenario management.
type ScenarioHandler struct {
	client pb.ScenarioServiceClient
}

// NewScenarioHandler creates a new ScenarioHandler.
func NewScenarioHandler(client pb.ScenarioServiceClient) *ScenarioHandler {
	return &ScenarioHandler{client: client}
}

// RegisterRoutes registers all scenario-related routes on the given router.
func (h *ScenarioHandler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/scenarios", h.ListScenario).Methods("GET")
	r.HandleFunc("/api/v1/scenarios", h.CreateScenario).Methods("POST")
	r.HandleFunc("/api/v1/scenarios/{id}", h.GetScenario).Methods("GET")
	r.HandleFunc("/api/v1/scenarios/{id}", h.UpdateScenario).Methods("PUT")
	r.HandleFunc("/api/v1/scenarios/{id}", h.DeleteScenario).Methods("DELETE")
	r.HandleFunc("/api/v1/scenarios/{id}/branches", h.CreateBranch).Methods("POST")
	r.HandleFunc("/api/v1/scenarios/{id}/branches", h.ListBranches).Methods("GET")
	r.HandleFunc("/api/v1/scenarios/{id}/commits", h.Commit).Methods("POST")
	r.HandleFunc("/api/v1/scenarios/{id}/commits", h.GetCommitHistory).Methods("GET")
	r.HandleFunc("/api/v1/scenarios/{id}/merge-requests", h.CreateMergeRequest).Methods("POST")
	r.HandleFunc("/api/v1/scenarios/{id}/comments", h.GetComments).Methods("GET")
	r.HandleFunc("/api/v1/scenarios/{id}/comments", h.AddComment).Methods("POST")
}

// ListScenario handles GET /api/v1/scenarios.
func (h *ScenarioHandler) ListScenario(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	req := &pb.ListScenarioRequest{
		Status: q.Get("status"),
		Search: q.Get("search"),
	}
	if tags := q["tags"]; len(tags) > 0 {
		req.Tags = tags
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

	resp, err := h.client.ListScenario(r.Context(), req)
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// CreateScenario handles POST /api/v1/scenarios.
func (h *ScenarioHandler) CreateScenario(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var scenario pb.Scenario
	if err := json.Unmarshal(body, &scenario); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	resp, err := h.client.CreateScenario(r.Context(), &pb.CreateScenarioRequest{Scenario: &scenario})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

// GetScenario handles GET /api/v1/scenarios/{id}.
func (h *ScenarioHandler) GetScenario(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	branch := r.URL.Query().Get("branch")

	resp, err := h.client.GetScenario(r.Context(), &pb.GetScenarioRequest{
		Id:     id,
		Branch: branch,
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// UpdateScenario handles PUT /api/v1/scenarios/{id}.
func (h *ScenarioHandler) UpdateScenario(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var scenario pb.Scenario
	if err := json.Unmarshal(body, &scenario); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	scenario.Id = id

	resp, err := h.client.UpdateScenario(r.Context(), &pb.UpdateScenarioRequest{Scenario: &scenario})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// DeleteScenario handles DELETE /api/v1/scenarios/{id}.
func (h *ScenarioHandler) DeleteScenario(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	_, err := h.client.DeleteScenario(r.Context(), &pb.DeleteScenarioRequest{Id: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// CreateBranch handles POST /api/v1/scenarios/{id}/branches.
func (h *ScenarioHandler) CreateBranch(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["id"]

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var reqBody struct {
		Name           string `json:"name"`
		ParentBranchID string `json:"parent_branch_id"`
	}
	if err := json.Unmarshal(body, &reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	resp, err := h.client.CreateBranch(r.Context(), &pb.CreateBranchRequest{
		ScenarioId:     scenarioID,
		Name:           reqBody.Name,
		ParentBranchId: reqBody.ParentBranchID,
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

// ListBranches handles GET /api/v1/scenarios/{id}/branches.
func (h *ScenarioHandler) ListBranches(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["id"]

	resp, err := h.client.ListBranches(r.Context(), &pb.ListBranchesRequest{
		ScenarioId: scenarioID,
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// Commit handles POST /api/v1/scenarios/{id}/commits.
func (h *ScenarioHandler) Commit(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["id"]

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var reqBody struct {
		Branch  string        `json:"branch"`
		Message string        `json:"message"`
		Changes []*pb.Change  `json:"changes"`
	}
	if err := json.Unmarshal(body, &reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	resp, err := h.client.CommitChanges(r.Context(), &pb.CommitRequest{
		ScenarioId: scenarioID,
		Branch:     reqBody.Branch,
		Message:    reqBody.Message,
		Changes:    reqBody.Changes,
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

// GetCommitHistory handles GET /api/v1/scenarios/{id}/commits.
func (h *ScenarioHandler) GetCommitHistory(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["id"]
	q := r.URL.Query()

	req := &pb.GetCommitHistoryRequest{
		ScenarioId: scenarioID,
		Branch:     q.Get("branch"),
	}
	if v := q.Get("limit"); v != "" {
		if l, err := strconv.ParseInt(v, 10, 32); err == nil {
			req.Limit = int32(l)
		}
	}

	resp, err := h.client.GetCommitHistory(r.Context(), req)
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// CreateMergeRequest handles POST /api/v1/scenarios/{id}/merge-requests.
func (h *ScenarioHandler) CreateMergeRequest(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["id"]

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var reqBody struct {
		SourceBranch string `json:"source_branch"`
		TargetBranch string `json:"target_branch"`
		Title        string `json:"title"`
		Description  string `json:"description"`
	}
	if err := json.Unmarshal(body, &reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	resp, err := h.client.CreateMergeRequest(r.Context(), &pb.CreateMRRequest{
		ScenarioId:   scenarioID,
		SourceBranch: reqBody.SourceBranch,
		TargetBranch: reqBody.TargetBranch,
		Title:        reqBody.Title,
		Description:  reqBody.Description,
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

// GetComments handles GET /api/v1/scenarios/{id}/comments.
func (h *ScenarioHandler) GetComments(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["id"]
	q := r.URL.Query()

	resp, err := h.client.GetComments(r.Context(), &pb.GetCommentsRequest{
		ScenarioId: scenarioID,
		EntityType: q.Get("entity_type"),
		EntityId:   q.Get("entity_id"),
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// AddComment handles POST /api/v1/scenarios/{id}/comments.
func (h *ScenarioHandler) AddComment(w http.ResponseWriter, r *http.Request) {
	scenarioID := mux.Vars(r)["id"]

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var comment pb.Comment
	if err := json.Unmarshal(body, &comment); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	resp, err := h.client.AddComment(r.Context(), &pb.AddCommentRequest{
		ScenarioId: scenarioID,
		Comment:    &comment,
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}
