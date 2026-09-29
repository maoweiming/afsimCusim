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
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	pb "truesim/gen/pb/scenario"
	"truesim/scenario/internal/collab"
	"truesim/scenario/internal/service"
	"truesim/scenario/internal/store"
	"truesim/scenario/internal/subscriber"
)

func main() {
	// 配置
	port := getEnv("PORT", "50052")
	mongoURI := getEnv("MONGODB_URI", "mongodb://localhost:27017")
	dbName := getEnv("DB_NAME", "scenario")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	redisPassword := getEnv("REDIS_PASSWORD", "")
	natsURL := getEnv("NATS_URL", "")

	log.Printf("Starting Scenario Service...")
	log.Printf("Port: %s", port)
	log.Printf("MongoDB: %s/%s", mongoURI, dbName)
	log.Printf("Redis: %s", redisAddr)

	// 创建上下文
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 连接 MongoDB
	mongoStore, err := store.NewMongoStore(ctx, mongoURI, dbName)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer mongoStore.Close(context.Background())

	// 连接 Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       0,
	})
	defer redisClient.Close()

	// 测试 Redis 连接
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis not available, collaboration features will work without Redis: %v", err)
	}

	// 创建协同管理器
	collabMgr := collab.NewCollabManager(redisClient)

	// 连接 NATS（可选）并启动装备变更订阅
	if natsURL != "" {
		nc, err := nats.Connect(natsURL, nats.Name("scenario-svc"), nats.MaxReconnects(-1))
		if err != nil {
			log.Printf("Warning: failed to connect to NATS, equipment change notifications disabled: %v", err)
		} else {
			defer nc.Close()
			log.Printf("Connected to NATS: %s", natsURL)

			// 启动装备变更订阅器
			eqSub := subscriber.NewEquipmentSubscriber(nc, mongoStore)
			if err := eqSub.Start(); err != nil {
				log.Printf("Warning: failed to start equipment subscriber: %v", err)
			} else {
				defer eqSub.Close()
			}
		}
	} else {
		log.Println("NATS_URL not set, equipment change notifications disabled")
	}

	// 创建 gRPC 服务器
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()

	// 健康检查
	healthServer := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("scenario", grpc_health_v1.HealthCheckResponse_SERVING)

	// 注册想定服务
	scenarioSvc := service.NewScenarioService(mongoStore, collabMgr)
	pb.RegisterScenarioServiceServer(grpcServer, scenarioSvc)

	// 优雅关闭
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		log.Println("Shutting down...")
		healthServer.SetServingStatus("scenario", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		grpcServer.GracefulStop()
	}()

	log.Printf("Scenario Service listening on :%s", port)
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
