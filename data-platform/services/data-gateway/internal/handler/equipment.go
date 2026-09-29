package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	pb "truesim/equipment/pb"
)

// EquipmentHandler handles REST API requests for equipment management.
type EquipmentHandler struct {
	client pb.EquipmentServiceClient
}

// NewEquipmentHandler creates a new EquipmentHandler.
func NewEquipmentHandler(client pb.EquipmentServiceClient) *EquipmentHandler {
	return &EquipmentHandler{client: client}
}

// RegisterRoutes registers all equipment-related routes on the given router.
func (h *EquipmentHandler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/equipment", h.ListEquipment).Methods("GET")
	r.HandleFunc("/api/v1/equipment", h.CreateEquipment).Methods("POST")
	r.HandleFunc("/api/v1/equipment/import", h.ImportEquipment).Methods("POST")
	r.HandleFunc("/api/v1/equipment/export", h.ExportEquipment).Methods("GET")
	r.HandleFunc("/api/v1/equipment/{id}", h.GetEquipment).Methods("GET")
	r.HandleFunc("/api/v1/equipment/{id}", h.UpdateEquipment).Methods("PUT")
	r.HandleFunc("/api/v1/equipment/{id}", h.DeleteEquipment).Methods("DELETE")

	// Lock management
	r.HandleFunc("/api/v1/equipment/{id}/lock", h.GetLockStatus).Methods("GET")
	r.HandleFunc("/api/v1/equipment/{id}/lock", h.LockEquipment).Methods("POST")
	r.HandleFunc("/api/v1/equipment/{id}/lock", h.UnlockEquipment).Methods("DELETE")
	// Backward-compatible unlock endpoint
	r.HandleFunc("/api/v1/equipment/{id}/unlock", h.UnlockEquipment).Methods("POST")

	// Version management
	r.HandleFunc("/api/v1/equipment/{id}/versions", h.GetVersionHistory).Methods("GET")
	r.HandleFunc("/api/v1/equipment/{id}/versions/{version}/rollback", h.RollbackVersion).Methods("POST")
}

// ListEquipment handles GET /api/v1/equipment.
func (h *EquipmentHandler) ListEquipment(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	req := &pb.ListEquipmentRequest{
		Category: q.Get("category"),
		Status:   q.Get("status"),
		Search:   q.Get("search"),
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

	resp, err := h.client.ListEquipment(r.Context(), req)
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// CreateEquipment handles POST /api/v1/equipment.
func (h *EquipmentHandler) CreateEquipment(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var eq pb.Equipment
	if err := json.Unmarshal(body, &eq); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	resp, err := h.client.CreateEquipment(r.Context(), &pb.CreateEquipmentRequest{Equipment: &eq})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

// GetEquipment handles GET /api/v1/equipment/{id}.
func (h *EquipmentHandler) GetEquipment(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	resp, err := h.client.GetEquipment(r.Context(), &pb.GetEquipmentRequest{Id: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// UpdateEquipment handles PUT /api/v1/equipment/{id}.
func (h *EquipmentHandler) UpdateEquipment(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	var eq pb.Equipment
	if err := json.Unmarshal(body, &eq); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	eq.Id = id

	resp, err := h.client.UpdateEquipment(r.Context(), &pb.UpdateEquipmentRequest{Equipment: &eq})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// DeleteEquipment handles DELETE /api/v1/equipment/{id}.
func (h *EquipmentHandler) DeleteEquipment(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	_, err := h.client.DeleteEquipment(r.Context(), &pb.DeleteEquipmentRequest{Id: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// LockEquipment handles POST /api/v1/equipment/{id}/lock.
func (h *EquipmentHandler) LockEquipment(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	resp, err := h.client.LockEquipment(r.Context(), &pb.LockRequest{Id: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// UnlockEquipment handles POST /api/v1/equipment/{id}/unlock.
func (h *EquipmentHandler) UnlockEquipment(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	_, err := h.client.UnlockEquipment(r.Context(), &pb.UnlockRequest{Id: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetVersionHistory handles GET /api/v1/equipment/{id}/versions.
func (h *EquipmentHandler) GetVersionHistory(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	resp, err := h.client.GetVersionHistory(r.Context(), &pb.GetVersionRequest{EquipmentId: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// GetLockStatus handles GET /api/v1/equipment/{id}/lock.
// Returns the current lock status without acquiring a lock.
func (h *EquipmentHandler) GetLockStatus(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	// Attempt a lock; if already locked, the response contains locked_by.
	// If we succeed, immediately release (since this is a read-only query).
	resp, err := h.client.LockEquipment(r.Context(), &pb.LockRequest{Id: id})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	if resp.GetSuccess() {
		// We acquired the lock — release immediately and report unlocked
		_, _ = h.client.UnlockEquipment(r.Context(), &pb.UnlockRequest{Id: id})
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"locked": false,
		})
		return
	}
	// Lock held by someone else
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"locked":    true,
		"locked_by": resp.GetLockedBy(),
		"error":     resp.GetError(),
	})
}

// RollbackVersion handles POST /api/v1/equipment/{id}/versions/{version}/rollback.
func (h *EquipmentHandler) RollbackVersion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	versionStr := vars["version"]

	version, err := strconv.ParseInt(versionStr, 10, 32)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid version number: "+versionStr)
		return
	}

	resp, err := h.client.RollbackVersion(r.Context(), &pb.RollbackRequest{
		EquipmentId:   id,
		TargetVersion: int32(version),
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// ImportEquipment handles POST /api/v1/equipment/import.
func (h *EquipmentHandler) ImportEquipment(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	resp, err := h.client.ImportEquipment(r.Context(), &pb.ImportRequest{
		Data:   body,
		Format: format,
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// ExportEquipment handles GET /api/v1/equipment/export.
func (h *EquipmentHandler) ExportEquipment(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	format := q.Get("format")
	if format == "" {
		format = "json"
	}
	ids := q["ids"]

	resp, err := h.client.ExportEquipment(r.Context(), &pb.ExportRequest{
		Ids:    ids,
		Format: format,
	})
	if err != nil {
		writeGRPCError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// --- JSON response helpers ---

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("Failed to encode JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

func writeGRPCError(w http.ResponseWriter, err error) {
	log.Printf("gRPC error: %v", err)
	writeError(w, http.StatusBadGateway, err.Error())
}
