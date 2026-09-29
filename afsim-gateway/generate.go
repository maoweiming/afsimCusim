// Package afsim_gateway contains go:generate directives for protobuf code generation.
//
// When protoc and the Go protobuf plugins are available, run:
//
//	go generate ./...
//
// This will replace the hand-crafted pb.go files with proper generated code.
package afsim_gateway

//go:generate protoc --go_out=internal/proto --go_opt=paths=source_relative ../../../proto/afsim_events.proto
//go:generate protoc --go_out=internal/proto --go_opt=paths=source_relative ../../../proto/afsim_control.proto
