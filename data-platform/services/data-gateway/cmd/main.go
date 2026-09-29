package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	eqpb "truesim/equipment/pb"
	scpb "truesim/gen/pb/scenario"
	tspb "truesim/gen/pb/timeseries"
	"truesim/data-gateway/internal/handler"
	"truesim/data-gateway/internal/middleware"
)

func main() {
	// Configuration from environment
	port := getEnv("PORT", "8080")
	equipmentAddr := getEnv("EQUIPMENT_SERVICE_ADDR", ":50051")
	scenarioAddr := getEnv("SCENARIO_SERVICE_ADDR", ":50052")
	timeseriesAddr := getEnv("TIMESERIES_SERVICE_ADDR", ":50053")

	log.Printf("=== TrueSim Data Gateway ===")
	log.Printf("HTTP Port:           %s", port)
	log.Printf("Equipment Service:   %s", equipmentAddr)
	log.Printf("Scenario Service:    %s", scenarioAddr)
	log.Printf("Timeseries Service:  %s", timeseriesAddr)

	// Connect to gRPC services
	equipmentConn, err := grpc.NewClient(equipmentAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("Failed to connect to equipment service at %s: %v", equipmentAddr, err)
	}
	defer equipmentConn.Close()
	log.Println("Connected to Equipment Service")

	scenarioConn, err := grpc.NewClient(scenarioAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("Failed to connect to scenario service at %s: %v", scenarioAddr, err)
	}
	defer scenarioConn.Close()
	log.Println("Connected to Scenario Service")

	timeseriesConn, err := grpc.NewClient(timeseriesAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("Failed to connect to timeseries service at %s: %v", timeseriesAddr, err)
	}
	defer timeseriesConn.Close()
	log.Println("Connected to Timeseries Service")

	// Create gRPC clients
	equipmentClient := eqpb.NewEquipmentServiceClient(equipmentConn)
	scenarioClient := scpb.NewScenarioServiceClient(scenarioConn)
	timeseriesClient := tspb.NewTimeseriesServiceClient(timeseriesConn)

	// Create HTTP router
	r := mux.NewRouter()

	// Health check
	r.Handle("/health", handler.NewHealthHandler(equipmentConn, scenarioConn, timeseriesConn))

	// Register service handlers
	equipmentHandler := handler.NewEquipmentHandler(equipmentClient)
	equipmentHandler.RegisterRoutes(r)

	scenarioHandler := handler.NewScenarioHandler(scenarioClient)
	scenarioHandler.RegisterRoutes(r)

	timeseriesHandler := handler.NewTimeseriesHandler(timeseriesClient)
	timeseriesHandler.RegisterRoutes(r)

	// Apply CORS middleware
	corsHandler := middleware.CORSMiddleware(r)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      corsHandler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Data Gateway listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server failed: %v", err)
		}
	}()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("Received signal %v, shutting down...", sig)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("HTTP server shutdown error: %v", err)
	}
	log.Println("Data Gateway stopped")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
