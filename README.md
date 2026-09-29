# TrueSim - AFSIM Web 化仿真平台

将 AFSIM 军事仿真引擎 Web 化的分布式仿真平台。通过浏览器即可启动仿真、实时观察战场态势、控制仿真进程。

## 架构概览

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌────────────────────┐
│  AFSIM 引擎  │───▶│  WSF 插件 (DLL)   │───▶│  Go 网关      │───▶│  React 前端          │
│  mission.exe │    │  Observer 回调    │    │  REST + WS    │    │  插件化 + 图层配置    │
└─────────────┘    └──────────────────┘    └──────────────┘    └────────────────────┘
                   命名管道 (Protobuf)         WebSocket (JSON)       浏览器渲染
                                                       │
                                              ┌────────┴────────┐
                                              │  数据中间平台      │
                                              │  5 微服务 + 存储   │
                                              └─────────────────┘
```

核心原则：**不修改 AFSIM 引擎**，仅通过 WSF 插件接口在外层构建网关和前端。

## 功能特性

### 仿真核心（已验证）
- **3D 态势显示** — CesiumJS 全球三维场景，实时渲染平台位置、航向、损伤状态
- **多阵营着色** — 蓝方/红方/灰方自动着色
- **传感器可视化** — 传感器开关、探测事件实时反馈
- **武器交战** — 发射轨迹、命中/脱靶事件
- **航迹管理** — 发起、更新、丢失完整生命周期
- **仿真控制** — 启动、暂停、恢复、步进、终止、时钟速率调节
- **事件日志** — 时间线滚动显示

### 前端架构（已完成）
- **插件系统** — PluginRegistry + 6 个内置插件，按角色（admin/operator/analyst/viewer）动态加载
- **图层配置** — LayerManager + 7 个渲染器（direct/engine 双模式），4 套角色预设
- **地图引擎抽象** — MapEngine 接口，CesiumEngine (3D) + LeafletEngine (2D) 可切换
- **代码分割** — React.lazy() + Vite manualChunks，主 chunk 33kB
- **角色切换** — 运行时切换用户身份，导航/侧边栏/图层自动变化
- **主题系统** — 军事默认/红方/蓝方三套主题，CSS 变量 + Ant Design 动态切换，角色联动
- **数据来源标注** — 每个数据字段标注来源（引擎实时/想定静态/前端计算）

### 数据中间平台（已完成）
- **装备数据服务** — CRUD + 版本管理 + 锁定机制 + 装备变更 NATS 通知
- **想定数据服务** — 分支/提交/合并请求/评论（类 Git 协作模型）+ 装备版本锁定（EquipmentRef）
- **时序数据服务** — 仿真数据写入/查询 + 回放管理 + 统计分析（距离/武器/平台）
- **地图数据服务** — GeoJSON/WMS 图层管理
- **REST API 网关** — 28+ 端点，统一入口
- **跨服务通信** — NATS 消息队列，装备变更自动通知想定服务

### 使用流程（已打通）
1. **数据维护** — 装备 CRUD + 版本管理，真实后端 / Mock 模式可切换
2. **想定编辑** — 想定 CRUD + 地图编辑 + 装备选择（版本锁定）
3. **想定运行** — WebSocket 实时数据流 + 多面板态势显示
4. **想定回放** — InfluxDB 帧数据查询 + 时间轴播放控制
5. **统计分析** — 仿真概览、双方态势、平台明细、武器命中统计

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + CesiumJS + Leaflet + Ant Design 5 + Zustand + Vite |
| 网关 | Go + chi router + WebSocket + Protobuf |
| 数据平台 | Go + gRPC + gorilla/mux |
| 存储 | MongoDB + Redis + InfluxDB + MinIO + NATS |
| 引擎接口 | C++ WSF 插件，Observer 回调 + 命名管道 |
| 部署 | Docker Compose |

## 仓库结构

```
TrueSim/
├── afsim-plugin/             # C++ WSF Event Gateway 插件
│   ├── source/               #   5 个核心文件
│   └── proto/                #   Protobuf 定义
│
├── afsim-gateway/            # Go 仿真网关（AFSIM 进程管理 + WebSocket）
│   ├── cmd/gateway/main.go
│   ├── internal/             #   api/ engine/ pipe/ simstate/ ws/
│   └── scenarios/
│
├── afsim-web/                # React 前端（119 文件）
│   ├── src/
│   │   ├── core/
│   │   │   ├── plugin/       #     插件系统（Registry, Context, RoleLoader）
│   │   │   ├── layer/        #     图层系统（Manager, Presets, 7 Renderers）
│   │   │   ├── map-engine/   #     地图引擎抽象（Cesium, Leaflet）
│   │   │   ├── data-platform/#     数据总线 + 事件总线
│   │   │   └── collaboration/#     协作框架类型
│   │   ├── plugins/          #     6 个内置插件
│   │   ├── config/roles/     #     4 个角色 JSON 配置
│   │   ├── modules/          #     功能模块（equipment, scenario, simulation, map-data, data-center）
│   │   ├── components/       #     UI 组件（Globe, Map, Layout, LayerPanel...）
│   │   ├── pages/            #     6 个页面
│   │   └── store/            #     Zustand 状态管理
│   └── vite.config.ts
│
├── data-platform/            # 数据中间平台（37 个 Go 文件）
│   ├── services/
│   │   ├── equipment/        #     装备数据 gRPC :50051
│   │   ├── scenario/         #     想定数据 gRPC :50052
│   │   ├── timeseries/       #     时序数据 gRPC :50053
│   │   ├── geospatial/       #     地图数据 gRPC :50054
│   │   └── data-gateway/     #     REST API 网关 :8080
│   ├── shared/proto/         #     4 个 Protobuf 定义
│   ├── deploy/               #     Docker Compose
│   └── go.work
│
├── deploy/                   # 全局部署配置
├── CLAUDE.md                 # AI 开发指引
└── README.md
```

## 快速开始

### 前置条件

| 工具 | 版本 |
|------|------|
| Go | 1.23+ |
| Node.js | 18+ |
| npm | 9+ |
| Docker | 24+（数据平台） |
| CMake | 3.16+（仅构建插件时） |

### 运行

```bash
# 1. 启动仿真网关
cd afsim-gateway
go build -o bin/gateway.exe ./cmd/gateway
AFSIM_MISSION_PATH="../AFSim/afsim-2.9.0-win64/bin/mission.exe" \
SCENARIO_DIR="./scenarios" OUTPUT_DIR="./output" \
bin/gateway.exe

# 2. 启动数据平台（可选）
cd data-platform/deploy && docker compose up -d

# 3. 启动前端
cd afsim-web && npm run dev

# 4. 打开浏览器 http://localhost:3000
```

### 角色切换

前端右上角支持运行时切换角色：
- **admin** — 全部 6 个插件 + 全部图层
- **operator** — 仿真 + 想定 + 装备
- **analyst** — 仿真 + 地图数据 + 分析 + 数据中心
- **viewer** — 仅仿真态势（只读）

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| Vite dev server | 3000 | 前端 HMR |
| Go 仿真网关 | 8080 | REST + WebSocket |
| data-gateway | 8080 | 数据平台 REST API |
| equipment | 50051 | gRPC |
| scenario | 50052 | gRPC |
| timeseries | 50053 | gRPC |
| geospatial | 50054 | gRPC |

## 代码规模

| 组件 | 文件数 | 语言 |
|------|--------|------|
| afsim-web | ~130 | TypeScript/TSX |
| afsim-gateway | ~10 | Go |
| afsim-plugin | ~8 | C++ |
| data-platform | ~40 | Go |
| **合计** | **~188** | — |

## 项目状态

### 已完成
- 端到端实时事件流验证通过（121 events/20s）
- 插件系统 + 6 个内置插件 + 4 个角色配置
- 图层系统 + 7 个渲染器 + 4 套预设
- 地图引擎抽象（Cesium 3D + Leaflet 2D）
- 数据中间平台 5 个微服务 + 28+ 个 REST 端点
- 代码分割 + 懒加载，主 chunk 33kB
- 装备版本锁定（EquipmentRef）+ 装备变更 NATS 通知
- 回放系统（InfluxDB 帧查询 + 列表/删除/播放）
- 统计分析（平台距离/武器发射/双方态势）
- 数据来源标注（引擎/想定/前端三色标识）
- UI 主题系统（军事默认/红方/蓝方 + 角色联动）
- 装备/想定 API 对接真实后端（VITE_USE_MOCK 可切换）

### 待开发
- 仿真网关与数据平台集成（事件持久化到时序库）
- 实际 AFSIM 场景数据驱动前端渲染
- 协作编辑（多用户同时操作想定）
- 地形分析工具（剖面/通视/坡度）
- 性能优化（大量实体渲染）
- E2E 测试 + CI/CD 管道

## 许可证

## 项目收尾与参与方式

这个项目仍在持续完善中，欢迎对 AFSIM、仿真可视化、前端工程或数据平台感兴趣的朋友一起参与。你可以从以下方向开始：

- 体验现有功能，反馈问题或提出改进建议；
- 认领“待开发”中的功能，或补充测试、文档和示例数据；
- 提交 Pull Request，说明改动目的、影响范围和验证方式；
- 参与架构讨论，共同推进协作编辑、真实场景驱动和性能优化。

每次功能更新都建议同步更新相关文档，并在提交信息中清晰描述变更内容。项目会持续迭代，期待更多有兴趣的开发者加入，一起把这套仿真系统做得更完整、更易用。

AFSIM 引擎为专有软件，受其自身许可协议约束。本仓库中的网关、插件、前端代码为自主开发。
# afsimCusim
