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

	pb "truesim/gen/pb/timeseries"
	"truesim/timeseries/internal/service"
	"truesim/timeseries/internal/store"
)

func main() {
	// 配置
	port := getEnv("PORT", "50053")
	influxURL := getEnv("INFLUXDB_URL", "http://localhost:8086")
	influxToken := getEnv("INFLUXDB_TOKEN", "my-super-secret-token")
	influxOrg := getEnv("INFLUXDB_ORG", "truesim")
	influxBucket := getEnv("INFLUXDB_BUCKET", "simulation")

	log.Printf("Starting Timeseries Service...")
	log.Printf("Port: %s", port)
	log.Printf("InfluxDB: %s (org: %s, bucket: %s)", influxURL, influxOrg, influxBucket)

	// 创建 InfluxDB 存储
	tsStore := store.NewTimeseriesStore(influxURL, influxToken, influxOrg, influxBucket)
	defer tsStore.Close()

	// 创建 gRPC 服务器
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()

	// 健康检查
	healthServer := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("timeseries", grpc_health_v1.HealthCheckResponse_SERVING)

	// 注册时序数据服务
	tsSvc := service.NewTimeseriesService(tsStore)
	pb.RegisterTimeseriesServiceServer(grpcServer, tsSvc)

	// 优雅关闭
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		log.Println("Shutting down...")
		healthServer.SetServingStatus("timeseries", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		grpcServer.GracefulStop()
	}()

	log.Printf("Timeseries Service listening on :%s", port)
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
