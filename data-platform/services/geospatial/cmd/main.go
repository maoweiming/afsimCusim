package main

import (
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	"truesim/geospatial/internal/service"
	pb "truesim/gen/pb/geospatial"
)

func main() {
	port := getEnv("PORT", "50054")

	log.Printf("=== TrueSim Geospatial Service ===")
	log.Printf("Port: %s", port)

	// Create gRPC server
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()

	// Register health check
	healthServer := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("geospatial", grpc_health_v1.HealthCheckResponse_SERVING)

	// Register geospatial service
	geospatialServer := service.NewGeospatialServer()
	pb.RegisterGeospatialServiceServer(grpcServer, geospatialServer)

	// Register reflection for tools like grpcurl
	reflection.Register(grpcServer)

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigCh
		log.Printf("Received signal %v, shutting down...", sig)

		healthServer.SetServingStatus("geospatial", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		grpcServer.GracefulStop()
	}()

	log.Printf("Geospatial Service listening on :%s", port)
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
