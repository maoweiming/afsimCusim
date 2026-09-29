// Package engine manages the AFSIM mission.exe process lifecycle and
// the pipe-based connection to the WSF plugin.
package engine

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// ProcessManager manages the lifecycle of a mission.exe child process.
type ProcessManager struct {
	mu sync.Mutex

	missionPath string
	scenarioDir string
	outputDir   string

	cmd    *exec.Cmd
	cancel context.CancelFunc

	// State tracking
	running bool
	exitCh  chan struct{}
	exitOnce sync.Once
	exitErr  error

	logger *slog.Logger
}

// ProcessConfig holds the configuration for starting a mission.exe process.
type ProcessConfig struct {
	MissionPath string // Path to mission.exe
	ScenarioDir string // Directory containing .scenario files
	OutputDir   string // Directory for simulation output files
}

// NewProcessManager creates a new ProcessManager.
func NewProcessManager(cfg ProcessConfig, logger *slog.Logger) *ProcessManager {
	if logger == nil {
		logger = slog.Default()
	}
	return &ProcessManager{
		missionPath: cfg.MissionPath,
		scenarioDir: cfg.ScenarioDir,
		outputDir:   cfg.OutputDir,
		exitCh:      make(chan struct{}),
		logger:      logger,
	}
}

// Start spawns the mission.exe process with the given scenario file and simulation mode.
// The mode string maps to AFSIM command-line arguments.
func (pm *ProcessManager) Start(ctx context.Context, scenarioFile string, mode string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.running {
		return fmt.Errorf("mission.exe is already running")
	}

	// Verify mission.exe exists
	if _, err := os.Stat(pm.missionPath); err != nil {
		return fmt.Errorf("mission.exe not found at %s: %w", pm.missionPath, err)
	}

	// Build the full scenario path
	// Try .scenario extension first (gateway convention), then .txt (AFSIM convention)
	scenarioPath := filepath.Join(pm.scenarioDir, scenarioFile)
	if _, err := os.Stat(scenarioPath); err != nil {
		// Try with .scenario extension
		scenarioPath = scenarioPath + ".scenario"
		if _, err2 := os.Stat(scenarioPath); err2 != nil {
			// Try with .txt extension
			scenarioPath = filepath.Join(pm.scenarioDir, scenarioFile+".txt")
			if _, err3 := os.Stat(scenarioPath); err3 != nil {
				return fmt.Errorf("scenario file not found: %s: %w", scenarioFile, err)
			}
		}
	}

	// Ensure output directory exists
	if pm.outputDir != "" {
		if err := os.MkdirAll(pm.outputDir, 0755); err != nil {
			return fmt.Errorf("failed to create output directory %s: %w", pm.outputDir, err)
		}
	}

	// Build command arguments - mode flag must come BEFORE scenario file
	args := []string{}

	// Mode-specific arguments (AFSIM flags: -e=event_step, -f=frame_step, -R=realtime)
	switch mode {
	case "event_step":
		args = append(args, "-e")
	case "frame_step":
		args = append(args, "-f")
	case "realtime":
		args = append(args, "-rt")
	default:
		// Pass through unknown modes as-is
		if mode != "" {
			args = append(args, mode)
		}
	}

	// mission.exe runs with cwd = scenarioDir, so pass only the filename
	args = append(args, filepath.Base(scenarioPath))

	// Reset exit channel for a new run
	pm.exitCh = make(chan struct{})
	pm.exitOnce = sync.Once{}
	pm.exitErr = nil

	procCtx, cancel := context.WithCancel(ctx)
	pm.cancel = cancel

	// Convert mission path to absolute path to ensure exec.Command can find it
	absMissionPath, err := filepath.Abs(pm.missionPath)
	if err != nil {
		absMissionPath = pm.missionPath
	}

	pm.cmd = exec.CommandContext(procCtx, absMissionPath, args...)

	// Set working directory to scenario dir so file_path directives resolve correctly
	// Convert to absolute path to avoid relative path issues
	absScenarioDir, err := filepath.Abs(pm.scenarioDir)
	if err != nil {
		absScenarioDir = pm.scenarioDir
	}
	pm.cmd.Dir = absScenarioDir

	// Set environment for plugin search path
	pm.cmd.Env = append(os.Environ(),
		fmt.Sprintf("AFSIM_PLUGIN_PATH=%s", filepath.Dir(absMissionPath)),
	)
	if pm.outputDir != "" {
		pm.cmd.Env = append(pm.cmd.Env,
			fmt.Sprintf("AFSIM_OUTPUT_DIR=%s", pm.outputDir),
		)
	}

	// Capture stdout/stderr for log access
	var stdout, stderr logWriter
	stdout.logger = pm.logger.With("stream", "stdout")
	stderr.logger = pm.logger.With("stream", "stderr")
	pm.cmd.Stdout = &stdout
	pm.cmd.Stderr = &stderr

	pm.logger.Info("starting mission.exe",
		"path", pm.missionPath,
		"scenario", scenarioPath,
		"mode", mode,
		"args", args,
	)

	if err := pm.cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("failed to start mission.exe: %w", err)
	}

	pm.running = true

	// Monitor process exit in a goroutine
	go func() {
		err := pm.cmd.Wait()
		pm.mu.Lock()
		pm.running = false
		// A context cancellation (Terminate) is an expected exit, not a failure.
		if err != nil && procCtx.Err() == nil {
			pm.exitErr = err
		}
		pm.mu.Unlock()

		if err != nil && procCtx.Err() == nil {
			pm.logger.Error("mission.exe exited with error", "error", err)
		} else {
			pm.logger.Info("mission.exe exited", "error", err)
		}

		pm.exitOnce.Do(func() {
			close(pm.exitCh)
		})
	}()

	return nil
}

// Terminate kills the mission.exe process.
func (pm *ProcessManager) Terminate() error {
	pm.mu.Lock()
	running := pm.running
	pm.mu.Unlock()

	if !running {
		return nil
	}

	pm.logger.Info("terminating mission.exe")

	if pm.cancel != nil {
		pm.cancel()
	}

	// Give the process a moment to exit gracefully
	select {
	case <-pm.exitCh:
		return nil
	case <-time.After(5 * time.Second):
		// Force kill
		pm.mu.Lock()
		cmd := pm.cmd
		pm.mu.Unlock()

		if cmd != nil && cmd.Process != nil {
			return cmd.Process.Kill()
		}
		return nil
	}
}

// IsRunning returns whether the mission.exe process is currently running.
func (pm *ProcessManager) IsRunning() bool {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	return pm.running
}

// ExitCh returns a channel that is closed when the process exits.
func (pm *ProcessManager) ExitCh() <-chan struct{} {
	return pm.exitCh
}

// ExitErr returns the error mission.exe exited with, or nil if it has not
// exited yet or exited cleanly (or was terminated intentionally).
func (pm *ProcessManager) ExitErr() error {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	return pm.exitErr
}

// Pid returns the process ID, or 0 if not running.
func (pm *ProcessManager) Pid() int {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	if pm.cmd != nil && pm.cmd.Process != nil {
		return pm.cmd.Process.Pid
	}
	return 0
}

// logWriter is an io.Writer that logs each line.
type logWriter struct {
	logger *slog.Logger
	buf    []byte
}

func (w *logWriter) Write(p []byte) (n int, err error) {
	w.buf = append(w.buf, p...)
	for {
		idx := -1
		for i, b := range w.buf {
			if b == '\n' {
				idx = i
				break
			}
		}
		if idx < 0 {
			break
		}
		line := string(w.buf[:idx])
		w.buf = w.buf[idx+1:]
		w.logger.Info(line)
	}
	return len(p), nil
}
