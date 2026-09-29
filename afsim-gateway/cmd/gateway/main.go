// Package main is the entry point for the AFSIM gateway service.
//
// The gateway bridges the AFSIM simulation engine (via Windows named pipes)
// and web browsers (via WebSocket and REST API).
//
// Configuration is via environment variables:
//   - AFSIM_MISSION_PATH: Path to mission.exe (required)
//   - SCENARIO_DIR: Directory containing .scenario files (default: ./scenarios)
//   - OUTPUT_DIR: Directory for simulation output files (default: ./output)
//   - PORT: HTTP server port (default: 8080)
//   - AFSIM_EVENT_PIPE: Named pipe path for events (default: \\.\pipe\afsim_events)
//   - AFSIM_CONTROL_PIPE: Named pipe path for control (default: \\.\pipe\afsim_control)
//   - DATA_PLATFORM_URL: Base URL of the data-platform timeseries service (default: empty = disabled)
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/truesim/afsim-gateway/internal/api"
	"github.com/truesim/afsim-gateway/internal/simstate"
	"github.com/truesim/afsim-gateway/internal/ws"
)

func main() {
	// Initialize structured logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	logger.Info("AFSIM gateway starting")

	// Load configuration from environment
	cfg := loadConfig(logger)

	// Initialize simulation state
	state := simstate.NewSimulationState()

	// Initialize WebSocket hub
	hub := ws.NewHub(state, logger.With("component", "hub"))

	// Create API handler
	apiHandler := api.NewAPI(api.Config{
		ScenarioDir:     cfg.ScenarioDir,
		OutputDir:       cfg.OutputDir,
		MissionPath:     cfg.MissionPath,
		Port:            cfg.Port,
		DataPlatformURL: cfg.DataPlatformURL,
	}, state, hub, logger.With("component", "api"))

	// Start the hub in a background goroutine
	hubDone := make(chan struct{})
	go func() {
		hub.Run(hubDone)
	}()

	// Ensure scenario and output directories exist
	if err := os.MkdirAll(cfg.ScenarioDir, 0755); err != nil {
		logger.Error("failed to create scenario directory", "dir", cfg.ScenarioDir, "error", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(cfg.OutputDir, 0755); err != nil {
		logger.Error("failed to create output directory", "dir", cfg.OutputDir, "error", err)
		os.Exit(1)
	}

	// Start HTTP server
	addr := fmt.Sprintf(":%d", cfg.Port)
	server := &http.Server{
		Addr:         addr,
		Handler:      apiHandler.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown setup
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Start server in a goroutine
	serverErr := make(chan error, 1)
	go func() {
		logger.Info("HTTP server listening", "addr", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	// Wait for interrupt or server error
	select {
	case <-ctx.Done():
		logger.Info("received shutdown signal")
	case err := <-serverErr:
		logger.Error("HTTP server error", "error", err)
	}

	// Graceful shutdown with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("HTTP server shutdown error", "error", err)
	}

	// Stop the hub
	close(hubDone)

	logger.Info("AFSIM gateway stopped")
}

// config holds the gateway configuration loaded from environment variables.
type config struct {
	MissionPath     string
	ScenarioDir     string
	OutputDir       string
	Port            int
	EventPipe       string
	ControlPipe     string
	DataPlatformURL string
}

// loadConfig reads configuration from environment variables with sensible defaults.
func loadConfig(logger *slog.Logger) config {
	cfg := config{
		MissionPath:     getEnv("AFSIM_MISSION_PATH", "mission.exe"),
		ScenarioDir:     getEnv("SCENARIO_DIR", "./scenarios"),
		OutputDir:       getEnv("OUTPUT_DIR", "./output"),
		Port:            getEnvInt("PORT", 8080),
		EventPipe:       getEnv("AFSIM_EVENT_PIPE", `\\.\pipe\afsim_events`),
		ControlPipe:     getEnv("AFSIM_CONTROL_PIPE", `\\.\pipe\afsim_control`),
		DataPlatformURL: getEnv("DATA_PLATFORM_URL", ""),
	}

	logger.Info("configuration loaded",
		"mission_path", cfg.MissionPath,
		"scenario_dir", cfg.ScenarioDir,
		"output_dir", cfg.OutputDir,
		"port", cfg.Port,
		"event_pipe", cfg.EventPipe,
		"control_pipe", cfg.ControlPipe,
		"data_platform_url", cfg.DataPlatformURL,
	)

	return cfg
}

// getEnv reads an environment variable with a default fallback.
func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// getEnvInt reads an integer environment variable with a default fallback.
func getEnvInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	var result int
	if _, err := fmt.Sscanf(val, "%d", &result); err != nil {
		return defaultVal
	}
	return result
}
