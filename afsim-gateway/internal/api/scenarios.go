package api

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// ScenarioInfo is the JSON representation of a scenario file listing entry.
type ScenarioInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`       // display name without .scenario extension
	Filename  string `json:"filename"`   // full filename with .scenario extension
	SizeBytes int64  `json:"size_bytes"`
	CreatedAt string `json:"created_at"`
}

// handleListScenarios lists all .scenario files in the scenario directory.
func (a *API) handleListScenarios(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(a.scenarioDir)
	if err != nil {
		a.logger.Error("failed to read scenario directory", "dir", a.scenarioDir, "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list scenarios")
		return
	}

	var scenarios []ScenarioInfo
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".scenario") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		scenarios = append(scenarios, ScenarioInfo{
			ID:        strings.TrimSuffix(entry.Name(), ".scenario"),
			Name:      strings.TrimSuffix(entry.Name(), ".scenario"),
			Filename:  entry.Name(),
			SizeBytes: info.Size(),
			CreatedAt: info.ModTime().UTC().Format(time.RFC3339),
		})
	}

	// Sort by name for deterministic output
	sort.Slice(scenarios, func(i, j int) bool {
		return scenarios[i].Name < scenarios[j].Name
	})

	writeJSON(w, http.StatusOK, scenarios)
}

// handleUploadScenario uploads a new scenario file via multipart form.
func (a *API) handleUploadScenario(w http.ResponseWriter, r *http.Request) {
	// Limit upload size to 50 MB
	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse multipart form: "+err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing 'file' field in form")
		return
	}
	defer file.Close()

	// Ensure the filename ends with .scenario
	filename := header.Filename
	if !strings.HasSuffix(filename, ".scenario") {
		filename += ".scenario"
	}

	destPath := filepath.Join(a.scenarioDir, filename)

	// Ensure scenario directory exists
	if err := os.MkdirAll(a.scenarioDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create scenario directory")
		return
	}

	dest, err := os.Create(destPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create scenario file")
		return
	}
	defer dest.Close()

	written, err := io.Copy(dest, file)
	if err != nil {
		os.Remove(destPath)
		writeError(w, http.StatusInternalServerError, "failed to write scenario file")
		return
	}

	a.logger.Info("uploaded scenario", "filename", filename, "size", written)

	writeJSON(w, http.StatusCreated, ScenarioInfo{
		ID:        strings.TrimSuffix(filename, ".scenario"),
		Name:      strings.TrimSuffix(filename, ".scenario"),
		Filename:  filename,
		SizeBytes: written,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

// handleGetScenario returns the content of a specific scenario file.
func (a *API) handleGetScenario(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "missing scenario id")
		return
	}

	// Prevent path traversal
	filename := sanitizeFilename(id) + ".scenario"
	path := filepath.Join(a.scenarioDir, filename)

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "scenario not found: "+id)
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to read scenario")
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write(data)
}

// handleUpdateScenario updates the content of a specific scenario file.
func (a *API) handleUpdateScenario(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "missing scenario id")
		return
	}

	filename := sanitizeFilename(id) + ".scenario"
	path := filepath.Join(a.scenarioDir, filename)

	// Check it exists
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "scenario not found: "+id)
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to stat scenario")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	defer r.Body.Close()

	if err := os.WriteFile(path, body, 0644); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to write scenario")
		return
	}

	a.logger.Info("updated scenario", "id", id, "size", len(body))

	writeJSON(w, http.StatusOK, map[string]string{
		"id":     id,
		"status": "updated",
	})
}

// handleDeleteScenario deletes a scenario file.
func (a *API) handleDeleteScenario(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "missing scenario id")
		return
	}

	filename := sanitizeFilename(id) + ".scenario"
	path := filepath.Join(a.scenarioDir, filename)

	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "scenario not found: "+id)
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete scenario")
		return
	}

	a.logger.Info("deleted scenario", "id", id)

	writeJSON(w, http.StatusOK, map[string]string{
		"id":     id,
		"status": "deleted",
	})
}

// sanitizeFilename strips path separators and potentially dangerous characters.
func sanitizeFilename(id string) string {
	// Remove any path separator characters
	id = strings.ReplaceAll(id, "/", "")
	id = strings.ReplaceAll(id, "\\", "")
	id = strings.ReplaceAll(id, "..", "")
	id = strings.ReplaceAll(id, string(filepath.Separator), "")
	return id
}
