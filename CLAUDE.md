# TrueSim - AFSIM Web 化仿真平台

## 项目概述

将 AFSIM 军事仿真框架改造为可通过浏览器访问的云原生仿真服务。核心原则：**不修改 AFSIM 引擎**，仅在外层构建网关和 Web 前端。

## 技术选型

- **前端**: React 18 + TypeScript + CesiumJS + Leaflet + Ant Design 5 + Zustand + Vite
- **仿真网关**: Go + chi router + WebSocket + Protobuf
- **数据平台**: Go + gRPC + gorilla/mux + MongoDB + Redis + InfluxDB + NATS
- **引擎接口**: WSF 插件 (C++ DLL)，通过 Observer 回调 + 命名管道通信
- **部署**: Docker Compose

## 仓库布局

```
TrueSim/
├── AFSim/                    # AFSIM 引擎（不修改）
├── afsim-plugin/             # WSF Event Gateway 插件（C++）
├── afsim-gateway/            # Go 仿真网关（进程管理 + WebSocket）
├── afsim-web/                # React 前端（插件化 + 图层配置）
│   └── src/
│       ├── core/plugin/      #   插件系统
│       ├── core/layer/       #   图层系统
│       ├── core/map-engine/  #   地图引擎抽象
│       ├── plugins/          #   6 个内置插件
│       ├── config/roles/     #   4 个角色配置
│       └── modules/          #   功能模块
├── data-platform/            # 数据中间平台（5 微服务）
│   ├── services/             #   equipment, scenario, timeseries, geospatial, data-gateway
│   ├── shared/proto/         #   Protobuf 定义
│   └── deploy/               #   Docker Compose
├── deploy/                   # 全局部署配置
└── CLAUDE.md
```

## 数据流

```
AFSIM引擎 → WSF插件(Observer回调) → 命名管道(Protobuf) → Go仿真网关 → WebSocket(JSON) → React前端
                                                                      ↓
                                                              数据中间平台（持久化）
                                                                      ↓
                                                              MongoDB / InfluxDB
```

## 并行开发策略（分布式方向）

### 已验证的 Track

| Track | 组件 | 语言 | 开发者数 |
|-------|------|------|---------|
| A | afsim-plugin (C++ WSF 插件) | C++ | 1-2 |
| B | afsim-gateway (Go 仿真网关) | Go | 1-2 |
| C | afsim-web (React 前端) | TypeScript | 2-3 |
| D | data-platform (数据中间平台) | Go | 2-3 |

### 下一步分布式方向

**方向一：仿真网关 ↔ 数据平台 集成**
- 仿真事件实时写入时序数据库（InfluxDB）
- 仿真结束后自动创建回放记录
- 平台/航迹状态同步到装备数据库
- 适合 Track B + Track D 并行

**方向二：前端功能深化**
- 地形分析工具（剖面/通视/坡度）— 需要 CesiumJS 分析 API
- 协作编辑（多用户同时操作想定）— 需要 WebSocket CRDT
- 性能优化（大量实体 WebGL 渲染）— 需要 CesiumJS 实体池
- 适合 Track C 多人并行

**方向三：端到端集成验证**
- 实际 AFSIM 场景 → 仿真网关 → 前端全链路
- 数据平台持久化 → 回放 → 前端重放
- 多仿真并行管理
- 需要 Track A + B + C + D 协同

**方向四：基础设施完善**
- CI/CD 管道（GitHub Actions）
- E2E 测试（Playwright）
- 监控告警（Prometheus + Grafana）
- Kubernetes 部署清单
- 适合独立 Track E

## 共享依赖

- **Protobuf 定义**: `data-platform/shared/proto/` + `afsim-plugin/proto/` — 先修改，再并行
- **前端类型**: `src/core/*/types.ts` — 插件/图层/地图引擎类型
- **角色配置**: `src/config/roles/*.json` — 角色 → 插件映射

## 本地开发启动

```bash
# 仿真网关
cd afsim-gateway && bin/gateway.exe

# 数据平台（可选）
cd data-platform/deploy && docker compose up -d

# 前端
cd afsim-web && npm run dev
```

### 端口约定

| 服务 | 端口 | 说明 |
|------|------|------|
| Vite dev server | 3000 | 前端 HMR，自动代理后端 |
| Go 仿真网关 | 8080 | REST API + WebSocket |
| data-gateway | 8080 | 数据平台 REST API |
| gRPC 服务 | 50051-50054 | 装备/想定/时序/地图 |
| 命名管道 | — | `\\.\pipe\afsim_events` / `\\.\pipe\afsim_control` |

## 关键文件引用

- 插件注册模式参照: `AFSim/afsim-2.9.0-win64/swdev/src/wsf_plugins/wsf_simdis/`
- Observer 定义: `AFSim/afsim-2.9.0-win64/swdev/src/core/wsf/source/observer/`
- 仿真控制 API: `AFSim/afsim-2.9.0-win64/swdev/src/core/wsf/source/WsfSimulation.hpp`
- 插件加载器: `AFSim/afsim-2.9.0-win64/swdev/src/core/wsf/source/WsfPluginManager.hpp`

## 当前状态（2026-04-28）

### 已完成
- 端到端实时事件流验证通过（121 events/20s）
- 插件系统: PluginRegistry + 6 内置插件 + 4 角色配置
- 图层系统: LayerManager + 7 渲染器（direct/engine 双模式）+ 4 套预设
- 地图引擎: MapEngine 抽象，CesiumEngine (3D) + LeafletEngine (2D)
- 数据中间平台: 5 微服务 + 28 REST 端点 + Docker Compose
- 前端代码分割: 主 chunk 33kB，页面模块独立 chunk



