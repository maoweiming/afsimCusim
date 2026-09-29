# TrueSim 数据中间平台

## 概述

数据中间平台是 TrueSim 的核心数据服务层，提供装备数据、想定数据、时序数据和地图数据的统一管理。

## 架构

```
data-platform/
├── services/                    # 微服务
│   ├── equipment/               # 装备数据服务 (gRPC :50051)
│   ├── scenario/                # 想定数据服务 (gRPC :50052)
│   ├── timeseries/              # 时序数据服务 (gRPC :50053)
│   ├── geospatial/              # 地图数据服务 (gRPC :50054)
│   └── data-gateway/            # REST API 网关 (HTTP :8080)
├── shared/
│   ├── proto/                   # Protobuf 定义
│   └── gen/                     # 生成的 Go 代码
├── deploy/                      # 部署配置
├── scripts/                     # 启动脚本
└── go.work                      # Go workspace
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 服务框架 | Go + gRPC |
| API 网关 | Go + gorilla/mux (REST) |
| 文档存储 | MongoDB 7.0 |
| 缓存 | Redis 7.2 |
| 对象存储 | MinIO |
| 时序数据库 | InfluxDB 2.7 |
| 消息队列 | NATS 2.10 |

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
cd deploy
docker compose up -d
```

这将启动所有服务和基础设施，包括：
- MongoDB、Redis、InfluxDB、MinIO、NATS
- 4 个微服务 + REST API 网关

### 方式二：本地开发

```bash
# Windows
scripts\start-dev.ps1

# Linux/Mac
bash scripts/start-dev.sh
```

或手动启动：

```bash
# 1. 启动基础设施
cd deploy && docker compose up -d mongo redis influxdb nats minio

# 2. 启动装备数据服务
cd services/equipment && go run cmd/main.go

# 3. 启动想定数据服务
cd services/scenario && go run cmd/main.go

# 4. 启动时序数据服务
cd services/timeseries && go run cmd/main.go

# 5. 启动 REST API 网关
cd services/data-gateway && go run cmd/main.go
```

## 服务端口

| 服务 | 端口 | 协议 | 说明 |
|------|------|------|------|
| data-gateway | 8080 | HTTP/REST | API 网关（前端入口） |
| equipment-service | 50051 | gRPC | 装备数据 |
| scenario-service | 50052 | gRPC | 想定数据 |
| timeseries-service | 50053 | gRPC | 时序数据 |
| geospatial-service | 50054 | gRPC | 地图数据 |

### 基础设施端口

| 服务 | 端口 | 说明 |
|------|------|------|
| MongoDB | 27017 | 文档存储 |
| Redis | 6379 | 缓存/协同锁 |
| InfluxDB | 8086 | 时序数据库 |
| MinIO | 9000/9001 | 对象存储/API控制台 |
| NATS | 4222 | 消息队列 |

## REST API 端点

所有前端请求通过 data-gateway (HTTP :8080) 代理到后端 gRPC 服务：

### 装备数据

```
GET    /api/v1/equipment              # 装备列表
POST   /api/v1/equipment              # 创建装备
GET    /api/v1/equipment/{id}         # 装备详情
PUT    /api/v1/equipment/{id}         # 更新装备
DELETE /api/v1/equipment/{id}         # 删除装备
POST   /api/v1/equipment/{id}/lock    # 锁定装备
POST   /api/v1/equipment/{id}/unlock  # 解锁装备
GET    /api/v1/equipment/{id}/versions # 版本历史
POST   /api/v1/equipment/import       # 批量导入
GET    /api/v1/equipment/export       # 批量导出
```

### 想定数据

```
GET    /api/v1/scenarios              # 想定列表
POST   /api/v1/scenarios              # 创建想定
GET    /api/v1/scenarios/{id}         # 想定详情
PUT    /api/v1/scenarios/{id}         # 更新想定
DELETE /api/v1/scenarios/{id}         # 删除想定
POST   /api/v1/scenarios/{id}/branches # 创建分支
GET    /api/v1/scenarios/{id}/branches # 分支列表
POST   /api/v1/scenarios/{id}/commits # 提交变更
GET    /api/v1/scenarios/{id}/commits # 提交历史
POST   /api/v1/scenarios/{id}/merge-requests # 合并请求
GET    /api/v1/scenarios/{id}/comments # 评论列表
POST   /api/v1/scenarios/{id}/comments # 添加评论
```

### 时序数据

```
POST   /api/v1/timeseries/data        # 写入仿真数据
GET    /api/v1/timeseries/query       # 查询时序数据
POST   /api/v1/timeseries/replays     # 创建回放
GET    /api/v1/timeseries/replays     # 回放列表
GET    /api/v1/timeseries/replays/{id} # 回放详情
GET    /api/v1/timeseries/stats/{id}  # 仿真统计
```

## API 定义

所有 API 定义在 `shared/proto/` 目录：

- `equipment.proto` - 装备数据服务 API
- `scenario.proto` - 想定数据服务 API
- `timeseries.proto` - 时序数据服务 API
- `geospatial.proto` - 地图数据服务 API

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | API 网关端口 |
| `EQUIPMENT_SERVICE_ADDR` | `:50051` | 装备服务地址 |
| `SCENARIO_SERVICE_ADDR` | `:50052` | 想定服务地址 |
| `TIMESERIES_SERVICE_ADDR` | `:50053` | 时序服务地址 |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB 连接串 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接串 |
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB 地址 |

## 与前端集成

前端通过 REST API Gateway 访问数据平台：

```
前端 → Vite Proxy (:3000/api) → data-gateway (:8080) → gRPC 服务
```

开发环境 Vite 自动代理 `/api` 到 `localhost:8080`。

## 开发指南

### 生成 Protobuf 代码

```bash
# 安装工具
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# 生成代码
protoc --go_out=. --go-grpc_out=. shared/proto/*.proto
```

### 添加新服务

1. 在 `services/` 下创建新目录
2. 初始化 Go 模块: `go mod init truesim/<service>`
3. 在 `go.work` 中添加新服务
4. 创建 `cmd/main.go` 入口
5. 实现 gRPC 服务接口
6. 在 `data-gateway` 中添加 REST 路由
7. 在 `docker-compose.yml` 中添加服务配置
