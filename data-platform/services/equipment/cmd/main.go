package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	"truesim/equipment/internal/service"
	"truesim/equipment/internal/store"
	pb "truesim/equipment/pb"
)

func main() {
	// Configuration from environment
	port := getEnv("PORT", "50051")
	mongoURI := getEnv("MONGODB_URI", "mongodb://localhost:27017")
	dbName := getEnv("DB_NAME", "truesim_equipment")
	natsURL := getEnv("NATS_URL", "")

	log.Printf("=== TrueSim Equipment Service ===")
	log.Printf("Port:     %s", port)
	log.Printf("MongoDB:  %s/%s", mongoURI, dbName)

	// Connect to MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	equipmentStore, err := store.NewEquipmentStore(ctx, mongoURI, dbName)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer func() {
		shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutCancel()
		if err := equipmentStore.Close(shutCtx); err != nil {
			log.Printf("Error closing MongoDB: %v", err)
		}
	}()
	log.Println("Connected to MongoDB")

	// Connect to NATS (optional — nil if NATS_URL not set)
	var natsConn *nats.Conn
	if natsURL != "" {
		nc, err := nats.Connect(natsURL, nats.Name("equipment-svc"), nats.MaxReconnects(-1))
		if err != nil {
			log.Printf("Warning: failed to connect to NATS, cross-service events disabled: %v", err)
		} else {
			natsConn = nc
			defer nc.Close()
			log.Printf("Connected to NATS: %s", natsURL)
		}
	} else {
		log.Println("NATS_URL not set, cross-service events disabled")
	}

	// Create gRPC server
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()

	// Register health check
	healthServer := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("equipment", grpc_health_v1.HealthCheckResponse_SERVING)

	// Register equipment service
	equipmentServer := service.NewEquipmentServer(equipmentStore, natsConn)
	pb.RegisterEquipmentServiceServer(grpcServer, equipmentServer)

	// Register reflection for tools like grpcurl
	reflection.Register(grpcServer)

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigCh
		log.Printf("Received signal %v, shutting down...", sig)

		healthServer.SetServingStatus("equipment", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		grpcServer.GracefulStop()
	}()

	log.Printf("Equipment Service listening on :%s", port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
