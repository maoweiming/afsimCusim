// Package main is a standalone gRPC client that verifies the two P2-H additions
// to the timeseries service against a REAL InfluxDB-backed server:
//
//   1. GetEngagementEvents — reconstructs weapon_launch / impact events by
//      scanning stored frames (weapon_N_remaining decreasing, status -> destroyed).
//   2. StreamFrames        — server-stream that polls InfluxDB once per second and
//      pushes frames newer than its cursor until the context is canceled.
//
// It writes synthetic frames via WriteFrames, then exercises both RPCs and
// asserts the expected results, exiting non-zero on any failure.
//
// Usage (requires a running timeseries-service + InfluxDB; see verify-p2h.ps1/.sh):
//
//	cd data-platform/services/timeseries
//	go run ./scripts/verify_p2h            # defaults to localhost:50053
//	TS_ADDR=host:50053 go run ./scripts/verify_p2h
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "truesim/gen/pb/timeseries"
)

func main() {
	addr := getEnv("TS_ADDR", "localhost:50053")
	// A unique simulation id per run so repeated runs never collide in InfluxDB.
	simID := fmt.Sprintf("p2h-verify-%d", time.Now().UnixNano())

	log.Printf("[verify-p2h] connecting to timeseries gRPC at %s", addr)
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		fatalf("dial %s: %v", addr, err)
	}
	defer conn.Close()
	client := pb.NewTimeseriesServiceClient(conn)

	failures := 0
	if err := verifyEngagementEvents(client, simID+"-eng"); err != nil {
		log.Printf("[verify-p2h] ❌ GetEngagementEvents FAILED: %v", err)
		failures++
	} else {
		log.Printf("[verify-p2h] ✅ GetEngagementEvents OK")
	}
	if err := verifyStreamFrames(client, simID+"-stream"); err != nil {
		log.Printf("[verify-p2h] ❌ StreamFrames FAILED: %v", err)
		failures++
	} else {
		log.Printf("[verify-p2h] ✅ StreamFrames OK")
	}

	if failures > 0 {
		fatalf("%d/2 checks failed", failures)
	}
	log.Printf("[verify-p2h] ✅ ALL CHECKS PASSED (2/2)")
}

// verifyEngagementEvents writes a 4-frame sequence in which weapon_0_remaining
// drops 2->1->0 (two launches) and status transitions active->destroyed (one
// impact), then asserts GetEngagementEvents reconstructs exactly those.
func verifyEngagementEvents(client pb.TimeseriesServiceClient, simID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	frames := []*pb.SimulationFrame{
		engFrame(1.0, 2, "active"),
		engFrame(2.0, 1, "active"),    // launch #1 (2 -> 1)
		engFrame(3.0, 0, "active"),    // launch #2 (1 -> 0)
		engFrame(4.0, 0, "destroyed"), // impact   (active -> destroyed)
	}
	if err := writeFrames(ctx, client, simID, frames); err != nil {
		return err
	}

	// InfluxDB writes are durable but not instantly queryable; retry briefly.
	var events []*pb.EngagementEvent
	deadline := time.Now().Add(15 * time.Second)
	for {
		resp, err := client.GetEngagementEvents(ctx, &pb.GetEngagementRequest{SimulationId: simID})
		if err != nil {
			return fmt.Errorf("GetEngagementEvents rpc: %w", err)
		}
		events = resp.GetEvents()
		launches, impacts := countTypes(events)
		if launches >= 2 && impacts >= 1 {
			log.Printf("[verify-p2h]   engagement events: %d total (%d launch, %d impact)", len(events), launches, impacts)
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("expected >=2 weapon_launch and >=1 impact, got %d events (%d launch, %d impact)",
				len(events), launches, impacts)
		}
		time.Sleep(1 * time.Second)
	}
}

// verifyStreamFrames opens a StreamFrames server-stream, writes frames in two
// batches, and asserts the stream delivers all of them across poll cycles.
func verifyStreamFrames(client pb.TimeseriesServiceClient, simID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Batch A before opening the stream (exercises the "from cursor 0" first poll).
	if err := writeFrames(ctx, client, simID, []*pb.SimulationFrame{
		streamFrame(1.0), streamFrame(2.0), streamFrame(3.0),
	}); err != nil {
		return err
	}

	streamCtx, streamCancel := context.WithCancel(ctx)
	defer streamCancel()
	stream, err := client.StreamFrames(streamCtx, &pb.StreamFramesRequest{SimulationId: simID})
	if err != nil {
		return fmt.Errorf("StreamFrames rpc: %w", err)
	}

	received := make(chan float64, 32)
	errCh := make(chan error, 1)
	go func() {
		for {
			f, err := stream.Recv()
			if err == io.EOF {
				close(received)
				return
			}
			if err != nil {
				errCh <- err
				return
			}
			received <- f.GetSimTime()
		}
	}()

	// After the first poll cycle, append Batch B; the cursor-based poll must pick it up.
	time.Sleep(2 * time.Second)
	if err := writeFrames(ctx, client, simID, []*pb.SimulationFrame{
		streamFrame(4.0), streamFrame(5.0),
	}); err != nil {
		return err
	}

	seen := map[float64]bool{}
	deadline := time.After(12 * time.Second)
	for len(seen) < 5 {
		select {
		case t, ok := <-received:
			if !ok {
				return fmt.Errorf("stream closed early; got %d/5 frames", len(seen))
			}
			seen[t] = true
		case err := <-errCh:
			return fmt.Errorf("stream recv: %w", err)
		case <-deadline:
			return fmt.Errorf("timed out; got %d/5 frames %v", len(seen), keys(seen))
		}
	}
	log.Printf("[verify-p2h]   stream delivered all 5 frames across poll cycles: %v", keys(seen))
	return nil
}

func writeFrames(ctx context.Context, client pb.TimeseriesServiceClient, simID string, frames []*pb.SimulationFrame) error {
	resp, err := client.WriteFrames(ctx, &pb.WriteFramesRequest{SimulationId: simID, Frames: frames})
	if err != nil {
		return fmt.Errorf("WriteFrames rpc: %w", err)
	}
	if resp.GetFailed() > 0 {
		return fmt.Errorf("WriteFrames reported %d failed (errors: %v)", resp.GetFailed(), resp.GetErrors())
	}
	return nil
}

func engFrame(simTime float64, weaponRemaining int32, status string) *pb.SimulationFrame {
	return &pb.SimulationFrame{
		SimTime:      simTime,
		PlatformId:   "red-01",
		PlatformName: "Red Fighter 01",
		Side:         "red",
		Status:       status,
		Position:     &pb.GeoPosition{Longitude: 122.0, Latitude: 25.0, AltitudeMsl: 8000},
		Velocity:     &pb.Velocity{North: 200, Speed: 200},
		Weapons:      []*pb.WeaponState{{WeaponId: "w0", WeaponName: "int_missile", Remaining: weaponRemaining, Total: 2}},
	}
}

func streamFrame(simTime float64) *pb.SimulationFrame {
	return &pb.SimulationFrame{
		SimTime:      simTime,
		PlatformId:   "blue-01",
		PlatformName: "Blue Fighter 01",
		Side:         "blue",
		Status:       "active",
		Position:     &pb.GeoPosition{Longitude: 121.0, Latitude: 26.0, AltitudeMsl: 9000},
		Velocity:     &pb.Velocity{North: 250, Speed: 250},
	}
}

func countTypes(events []*pb.EngagementEvent) (launches, impacts int) {
	for _, e := range events {
		switch e.GetType() {
		case "weapon_launch":
			launches++
		case "impact":
			impacts++
		}
	}
	return
}

func keys(m map[float64]bool) []float64 {
	out := make([]float64, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func getEnv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func fatalf(format string, args ...any) {
	log.Printf("[verify-p2h] FATAL: "+format, args...)
	os.Exit(1)
}
