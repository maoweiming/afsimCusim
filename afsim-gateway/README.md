# AFSIM Gateway

Go gateway service that bridges the AFSIM simulation engine (via Windows named pipes) and web browsers (via WebSocket and REST API).

## Quick Start

```bash
# Set required environment variables
export AFSIM_MISSION_PATH=/path/to/mission.exe
export SCENARIO_DIR=/path/to/scenarios
export OUTPUT_DIR=/path/to/output

# Build and run
go build -o afsim-gateway ./cmd/gateway
./afsim-gateway
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `AFSIM_MISSION_PATH` | `mission.exe` | Path to the AFSIM mission executable |
| `SCENARIO_DIR` | `./scenarios` | Directory containing `.scenario` files |
| `OUTPUT_DIR` | `./output` | Directory for simulation output files |
| `PORT` | `8080` | HTTP server port |
| `AFSIM_EVENT_PIPE` | `\\.\pipe\afsim_events` | Named pipe for reading simulation events |
| `AFSIM_CONTROL_PIPE` | `\\.\pipe\afsim_control` | Named pipe for sending control commands |

## API Endpoints

### Scenarios
- `GET /api/scenarios` - List scenario files
- `POST /api/scenarios` - Upload scenario (multipart form)
- `GET /api/scenarios/{id}` - Get scenario content
- `PUT /api/scenarios/{id}` - Update scenario content
- `DELETE /api/scenarios/{id}` - Delete scenario

### Simulations
- `POST /api/simulations` - Start simulation `{scenario_id, mode}`
- `GET /api/simulations/{id}` - Get status
- `POST /api/simulations/{id}/pause` - Pause
- `POST /api/simulations/{id}/resume` - Resume
- `POST /api/simulations/{id}/step` - Step forward
- `POST /api/simulations/{id}/clock-rate` - Set clock rate `{rate}`
- `POST /api/simulations/{id}/terminate` - Terminate
- `GET /api/simulations/{id}/files/{type}` - Download output (evt/aer/log)

### WebSocket
- `WS /api/simulations/{id}/ws` - Real-time event stream

### Health
- `GET /health` - Health check

## WebSocket Protocol

Messages are JSON with the format:

```json
{
  "type": "platform_added",
  "sim_time": 12.5,
  "payload": { ... }
}
```

New connections receive a `full_snapshot` message with the complete simulation state, followed by incremental event messages.

## Protobuf Generation

When `protoc` is available:

```bash
go generate ./...
```

This replaces the hand-crafted Go structs in `internal/proto/` with proper generated protobuf code.
