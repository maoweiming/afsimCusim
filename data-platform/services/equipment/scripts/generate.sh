#!/bin/bash
# Generate protobuf Go code for the equipment service.
#
# Prerequisites:
#   go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
#   go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
#
# Usage:
#   cd services/equipment
#   bash scripts/generate.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$(cd "$SERVICE_DIR/../../shared/proto" && pwd)"
OUTPUT_DIR="$SERVICE_DIR/pb"

mkdir -p "$OUTPUT_DIR"

echo "Generating protobuf code..."
echo "  Proto source: $PROTO_DIR/equipment.proto"
echo "  Output dir:   $OUTPUT_DIR"

protoc \
  --go_out="$OUTPUT_DIR" \
  --go_opt=paths=source_relative \
  --go-grpc_out="$OUTPUT_DIR" \
  --go-grpc_opt=paths=source_relative \
  --proto_path="$PROTO_DIR" \
  equipment.proto

echo "Done. Generated files:"
ls -la "$OUTPUT_DIR"/*.go
