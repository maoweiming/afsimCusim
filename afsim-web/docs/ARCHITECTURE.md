# TrueSim 前端架构文档

## 1. 技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | 18 | UI 组件化 |
| 语言 | TypeScript | 5.x | 类型安全 |
| 构建 | Vite | 5.x | 快速 HMR + 代码分割 |
| 地图（3D） | CesiumJS | 1.x | 三维地球渲染 |
| 地图（2D） | Leaflet | 1.x | 二维地图渲染 |
| UI 组件库 | Ant Design | 5 | 企业级 UI 组件 |
| 状态管理 | Zustand | 4.x | 轻量级状态管理（15+ stores） |
| 路由 | React Router | 6 | 插件化路由注册 |
| 协同 | OT（操作转换） | - | 想定协同编辑 |

---

## 2. 前端架构

### 2.1 整体架构图

```
┌──────────────────────────────────────────────────────────────┐
│                        App Shell                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  Router  │  │  Navbar  │  │ Sidebar  │  │ Map Container│ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│       ▲            ▲             ▲               ▲          │
│       │            │             │               │          │
│  ┌────┴────────────┴─────────────┴───────────────┴────┐     │
│  │              PluginRegistry (单例)                  │     │
│  │  按角色自动加载/卸载插件，聚合所有 Contribution      │     │
│  └────────────────────┬───────────────────────────────┘     │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────┐     │
│  │                  Plugins (6个)                      │     │
│  │  SimGlobe │ MapData │ Scenario │ Equipment │ ...   │     │
│  │  (BasePlugin 子类，实现 buildContribution())        │     │
│  └────────────────────────────────────────────────────┘     │
│       │           │            │            │               │
│  ┌────▼───┐  ┌───▼────┐  ┌───▼────┐  ┌───▼──────┐       │
│  │ Routes │  │ Nav    │  │Sidebar │  │ Layers   │       │
│  │        │  │ Items  │  │ Panels │  │          │       │
│  └────────┘  └────────┘  └────────┘  └──────────┘       │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    数据层                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │WebSocket │  │ REST API │  │ EventBus │  │  DataBus   │  │
│  │ Client   │  │ Client   │  │ 发布订阅 │  │  数据总线  │  │
│  └─────┬────┘  └────┬─────┘  └─────┬────┘  └─────┬──────┘  │
│        │            │              │              │         │
│  ┌─────▼────────────▼──────────────▼──────────────▼──────┐  │
│  │              Zustand Stores (15+)                      │  │
│  │  sim │ platform │ track │ weapon │ event │ ai │ ...   │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────▼───────────────────────────────┐  │
│  │              ConfigRegistry (单例)                     │  │
│  │  FieldConfig + ConfigDescriptor 配置驱动               │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 插件系统

**核心文件**：
- `src/core/plugin/types.ts` — 类型定义（Plugin, PluginManifest, PluginContribution）
- `src/core/plugin/PluginRegistry.ts` — 插件注册表单例
- `src/plugins/BasePlugin.ts` — 抽象基类

**生命周期**：
```
Registered → Initialized → Active → Inactive → Destroyed
```

**插件贡献类型**：
```typescript
interface PluginContribution {
  routes?: PluginRoute[];           // 页面路由
  navItems?: PluginNavItem[];       // 导航菜单项
  sidebarPanels?: PluginSidebarPanel[]; // 侧边栏面板
  layers?: PluginLayerContribution[];   // 图层定义
  dataSources?: PluginDataSource[];     // 数据源
  eventSubscriptions?: PluginEventSubscription[]; // 事件订阅
}
```

**6 个内置插件**：

| 插件 ID | 名称 | 角色 | 路由 | 图层 |
|---------|------|------|------|------|
| sim-globe | 仿真地球 | all | /simulation | platform, track, sensor_beam, weapon_arc |
| map-data | 地图数据 | admin, analyst | /mapdata | geojson, wms |
| scenario | 想定管理 | admin, operator | /scenarios, /scenario/:id | - |
| equipment | 装备管理 | admin, operator | /equipment | - |
| data-center | 数据中心 | admin, analyst | /datacenter | - |
| analysis | 地形分析 | admin, analyst | - | - |

### 2.3 图层系统

**核心文件**：
- `src/core/layer/types.ts` — 图层类型定义（UnifiedLayerType, LayerDefinition, LayerTreeNode）
- `src/core/layer/LayerManager.ts` — 图层管理器单例
- `src/core/layer/LayerPresets.ts` — 内置图层预设
- `src/core/layer/renderers/LayerRenderer.ts` — 渲染器接口

**渲染模式**：
- `direct` — 直接操作 CesiumJS viewer（高性能，仅 3D）
- `engine` — 通过 MapEngine 抽象（支持 2D/3D 切换）

**7 个内置渲染器**：

| 渲染器 | 类型 | 模式 | 说明 |
|--------|------|------|------|
| PlatformRenderer | platform | direct | 平台实体（图标 + 标签） |
| TrackRenderer | track | direct | 航迹线（发光效果） |
| SensorBeamRenderer | sensor_beam | direct | 传感器波束（虚线扇形） |
| WeaponArcRenderer | weapon_arc | direct | 武器射界（半透明扇形） |
| ZoneRenderer | zone | engine | 作战区域（圆形/多边形） |
| GeoJsonRenderer | geojson | engine | GeoJSON 矢量数据 |
| TileRenderer | tile/imagery/wms/wmts | engine | 瓦片/影像/WMS 图层 |

**渲染器接口**：
```typescript
interface LayerRenderer {
  readonly supportedTypes: string[];
  readonly renderingMode: 'direct' | 'engine';
  initialize(engine: MapEngine | null): void;
  addLayer(layer: LayerDefinition): LayerHandle;
  updateLayer(handle: LayerHandle, changes: Partial<LayerDefinition>): void;
  removeLayer(handle: LayerHandle): void;
  setVisibility(handle: LayerHandle, visible: boolean): void;
  setOpacity(handle: LayerHandle, opacity: number): void;
  onEngineChange(newEngine: MapEngine | null): void;
  destroy(): void;
}
```

### 2.4 地图引擎抽象

**核心文件**：
- `src/core/map-engine/MapEngine.ts` — 引擎接口定义
- `src/core/map-engine/CesiumEngine.ts` — CesiumJS 3D 实现
- `src/core/map-engine/LeafletEngine.ts` — Leaflet 2D 实现
- `src/core/map-engine/EngineFactory.ts` — 引擎工厂

**支持的引擎**：

| 引擎 | 维度 | 状态 |
|------|------|------|
| CesiumJS | 3D | 已实现 |
| Leaflet | 2D | 已实现 |
| MapboxGL | 2D/3D | 预留扩展点 |
| OpenLayers | 2D | 预留扩展点 |

**MapEngine 核心能力**：
- 生命周期：initialize / destroy / isReady
- 地图操作：setView / flyTo / fitBounds
- 底图地形：setImagerySource / setTerrainSource
- 图层管理：addLayer / removeLayer / updateLayer / reorderLayers
- 实体管理：addEntity / removeEntity / updateEntity / clearEntities
- 选择高亮：selectEntity / highlightEntity / deselectAll
- 相机控制：flyToEntity / trackEntity / untrackEntity
- 事件监听：onClick / onHover / onViewChange / onDraw
- 绘图工具：startDraw / cancelDraw
- 地形分析：getTerrainHeight / computeLineOfSight / computeViewshed
- 坐标转换：lngLatToScreen / screenToLngLat / metersToDegrees

---

## 3. 数据架构

### 3.1 Store 概览

共 15 个 Zustand Store，按职责分为 4 类：

**仿真核心 Store**：
| Store | 文件 | 职责 |
|-------|------|------|
| useSimStore | `store/simStore.ts` | 仿真阶段、仿真时间、时钟倍率、连接状态 |
| usePlatformStore | `store/platformStore.ts` | 平台实体（位置、姿态、传感器、燃料、任务、战斗状态） |
| useTrackStore | `store/trackStore.ts` | 航迹数据（Map 结构，key = originator:target:sensor） |
| useWeaponStore | `store/weaponStore.ts` | 武器交战（发射、飞行中、命中/脱靶） |

**分析态势 Store**：
| Store | 文件 | 职责 |
|-------|------|------|
| useThreatStore | `store/threatStore.ts` | 威胁评估（威胁等级、风险评分、WEZ 接近率） |
| useWezStore | `store/wezStore.ts` | 可发射区（射程、离轴角、命中概率） |
| useAiStore | `store/aiStore.ts` | AI 状态（OODA 循环、IADS C2、电子战） |

**系统辅助 Store**：
| Store | 文件 | 职责 |
|-------|------|------|
| useEventStore | `store/eventStore.ts` | 结构化事件（分类、严重级别、查询、导出、持久化） |
| useErrorStore | `store/errorStore.ts` | 全局错误收集（最多 200 条） |
| useWsHealthStore | `store/wsHealthStore.ts` | WebSocket 健康监控（延迟、消息速率、重连信息） |
| useHelpStore | `store/helpStore.ts` | 帮助和新手引导状态 |
| useTrackSettingsStore | `store/trackSettingsStore.ts` | 航迹显示设置（轨迹线、长度、着色模式、标签） |

**配置 Store**：
| Store | 文件 | 职责 |
|-------|------|------|
| useLayerStore | `store/layerStore.ts` | 图层配置（预设加载、可见性、透明度、自定义图层） |
| usePluginStore | `store/pluginStore.ts` | 插件状态（当前角色、已注册插件、活跃贡献） |
| useEnvironmentStore | `store/environmentStore.ts` | 环境数据（天气、海情、潮汐、大气） |

### 3.2 WebSocket 协议

**连接地址**：`ws://<host>:8080/api/simulations/<simId>/ws`

**心跳机制**：每 10s 发送 `ping`，接收 `pong` 计算延迟

**37 种消息类型**：

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `full_snapshot` | S→C | 初始连接全量快照 |
| `sim_starting` | S→C | 仿真启动 |
| `sim_state_changed` | S→C | 仿真状态变化 |
| `sim_complete` | S→C | 仿真完成 |
| `sim_pausing` | S→C | 仿真暂停 |
| `sim_resuming` | S→C | 仿真恢复 |
| `platform_added` | S→C | 平台加入 |
| `platform_initialized` | S→C | 平台初始化完成 |
| `platform_deleted` / `platform_removed` | S→C | 平台移除 |
| `platform_broken` | S→C | 平台损毁 |
| `platform_damage_changed` / `damage_update` | S→C | 损伤变化 |
| `mover_update` | S→C | 位置更新（高频） |
| `weapon_fired` | S→C | 武器发射 |
| `weapon_hit` | S→C | 武器命中 |
| `weapon_missed` | S→C | 武器脱靶 |
| `weapon_terminated` | S→C | 武器终止 |
| `sensor_turned_on` | S→C | 传感器开启 |
| `sensor_turned_off` | S→C | 传感器关闭 |
| `sensor_detection_changed` / `sensor_detection` | S→C | 传感器检测变化 |
| `track_initiated` | S→C | 航迹建立 |
| `track_update` / `track_updated` | S→C | 航迹更新 |
| `track_dropped` / `track_removed` | S→C | 航迹丢失 |
| `fuel_event` | S→C | 燃料事件 |
| `wez_update` | S→C | 可发射区更新 |
| `threat_assessment` | S→C | 威胁评估 |
| `ooda_state_change` / `ai_decision` | S→C | AI 决策 |
| `iads_c2_update` | S→C | IADS C2 更新 |
| `ew_update` | S→C | 电子战更新 |
| `frame_complete` | S→C | 帧完成（无操作） |
| `event` | S→C | 通用事件 |
| `pong` | S→C | 心跳响应 |
| `ping` | C→S | 心跳请求 |

### 3.3 数据流图

```
                    ┌─────────────────────┐
                    │   Go 仿真网关       │
                    │   :8080             │
                    └─────┬───────┬───────┘
                          │       │
                    WS    │       │  REST
                    events│       │  control
                          ▼       ▲
┌──────────────────────────────────────────────────────────┐
│                     React 前端                           │
│                                                          │
│  ┌──────────────┐                                        │
│  │ websocket.ts │  ← 解析 37 种消息类型                   │
│  │ processMessage│                                       │
│  └──────┬───────┘                                        │
│         │ 按 msg.type 分发                               │
│         ▼                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Zustand Stores                       │   │
│  │                                                   │   │
│  │  simStore ◄── sim_state_changed / sim_complete   │   │
│  │  platformStore ◄── platform_added / mover_update │   │
│  │  trackStore ◄── track_initiated / track_update   │   │
│  │  weaponStore ◄── weapon_fired / weapon_hit       │   │
│  │  eventStore ◄── event (所有事件统一记录)          │   │
│  │  aiStore ◄── ooda_state_change / ew_update       │   │
│  │  threatStore ◄── threat_assessment               │   │
│  │  wezStore ◄── wez_update                         │   │
│  └──────────────────────────────────────────────────┘   │
│         │                                                │
│         ▼                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              渲染层                               │   │
│  │  LayerManager → LayerRenderer → MapEngine        │   │
│  │  (PlatformRenderer / TrackRenderer / ...)        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │ controlApi   │     │ dataPlatform │                  │
│  │ (REST → 网关)│     │ (REST → 平台)│                  │
│  └──────────────┘     └──────────────┘                  │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 组件架构

### 4.1 仿真模块（src/modules/simulation/）

| 组件 | 文件 | 职责 |
|------|------|------|
| SensorControl | components/SensorControl.tsx | 传感器转向控制面板 |
| WeaponBrowser | components/WeaponBrowser.tsx | 武器列表和发射控制 |
| TrackHistory | components/TrackHistory.tsx | 航迹历史显示设置 |
| ReplayControl | components/ReplayControl.tsx | 仿真回放控制 |
| CommandChainView | components/CommandChainView.tsx | 命令链层级视图 |
| PlatformInfoPanel | components/PlatformInfoPanel.tsx | 平台详细信息面板 |
| ThreatPanel | components/ThreatPanel.tsx | 威胁评估面板 |
| AiDecisionPanel | components/AiDecisionPanel.tsx | AI 决策状态面板 |
| EwStatusPanel | components/EwStatusPanel.tsx | 电子战状态面板 |
| EngagementTimeline | components/EngagementTimeline.tsx | 交战时间线 |
| SimulationSidebar | components/SimulationSidebar.tsx | 仿真侧边栏容器 |

### 4.2 装备模块（src/modules/equipment/）

| 组件 | 文件 | 职责 |
|------|------|------|
| EquipmentList | components/EquipmentList.tsx | 装备列表（筛选、排序、分页） |
| EquipmentDetail | components/EquipmentDetail.tsx | 装备详情查看 |
| EquipmentEditor | components/EquipmentEditor.tsx | 装备编辑器（表单驱动） |
| EquipmentImportExport | components/EquipmentImportExport.tsx | 装备导入导出 |
| EquipmentVersionHistory | components/EquipmentVersionHistory.tsx | 装备版本历史 |

### 4.3 想定模块（src/modules/scenario/）

| 组件 | 文件 | 职责 |
|------|------|------|
| ScenarioList | components/ScenarioList.tsx | 想定列表 |
| ScenarioEditor | components/ScenarioEditor.tsx | 想定编辑器（地图 + 工具栏） |
| PlatformPlacer | components/PlatformPlacer.tsx | 平台放置工具 |
| RouteEditor | components/RouteEditor.tsx | 航线编辑器 |
| ZoneEditor | components/ZoneEditor.tsx | 区域编辑器 |
| CollabPanel | components/CollabPanel.tsx | 协同面板（用户列表、评论、聊天） |
| ScenarioValidator | components/ScenarioValidator.tsx | 想定校验器 |

### 4.4 地图数据模块（src/modules/map-data/）

| 组件 | 文件 | 职责 |
|------|------|------|
| MapLayerPanel | components/MapLayerPanel.tsx | 地图图层管理面板 |
| DataSourceManager | components/DataSourceManager.tsx | 数据源管理器 |
| LayerStyleEditor | components/LayerStyleEditor.tsx | 图层样式编辑器 |
| TerrainAnalysis | components/TerrainAnalysis.tsx | 地形分析工具 |
| ImagerySelector | components/ImagerySelector.tsx | 底图源选择器 |

### 4.5 数据中心模块（src/modules/data-center/）

| 组件 | 文件 | 职责 |
|------|------|------|
| DataDashboard | components/DataDashboard.tsx | 数据仪表盘 |
| DataLifecycle | components/DataLifecycle.tsx | 数据生命周期管理 |
| DataVersion | components/DataVersion.tsx | 数据版本管理 |
| DataExport | components/DataExport.tsx | 数据导入导出 |

---

## 5. 配置架构

### 5.1 FieldConfig 模式

**来源**：`src/core/config/ConfigRegistry.ts`

FieldConfig 是统一的表单字段描述符，用于驱动表单渲染和验证：

```typescript
interface FieldConfig {
  key: string;           // 数据字段名（支持点号嵌套: 'rcs.frontal'）
  label: string;         // 中文显示标签
  type: 'number' | 'text' | 'select' | 'textarea' | 'boolean' | 'date' | 'json';
  unit?: string;         // 单位后缀
  group: string;         // 分组名
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  colspan?: number;
  tooltip?: string;
  defaultValue?: unknown;
  readonly?: boolean;
  hidden?: boolean;
  validate?: (value: unknown) => string | null;
}
```

### 5.2 ConfigRegistry

全局单例配置注册表，支持：
- `register(descriptor)` — 注册配置描述符
- `get(id)` / `getRequired(id)` — 获取配置
- `createDefault(id)` — 创建默认数据实例
- `validate(id, data)` — 基于 schema 验证数据
- `list()` / `listByPrefix(prefix)` — 列出配置
- `subscribe(listener)` — 订阅变更

**预注册配置**：
- `equipment.*` — 装备分类配置（aircraft, ship, vehicle, weapon_system, sensor_system）
- `environment.weather` — 气象数据配置
- `environment.sea_state` — 海情数据配置
- `environment.tide` — 潮汐数据配置
- `entity.platform_status` — 平台状态配置
- `event.categories` — 事件分类配置

### 5.3 角色配置

**来源**：`src/config/roles/*.json`

```json
{
  "role": "admin",
  "label": "管理员",
  "description": "完全访问权限，可管理所有功能模块",
  "plugins": ["sim-globe", "map-data", "scenario", "equipment", "data-center", "analysis"],
  "defaultPreset": "admin-full",
  "restrictions": {}
}
```

### 5.4 图层预设

**来源**：`src/core/layer/LayerPresets.ts`

4 套内置预设，每套包含图层定义列表和图层树结构：
- `admin-full` — 8 图层（全部仿真图层 + 双底图）
- `operator-standard` — 7 图层（仿真图层 + 卫星底图）
- `analyst-analysis` — 4 图层（核心仿真 + 分析工具）
- `viewer-minimal` — 3 图层（最小化视图）

---

## 6. 扩展点

### 6.1 添加新模块

1. 在 `src/modules/` 下创建模块目录
2. 定义 `types.ts`（类型）→ `store/`（状态管理）→ `components/`（UI 组件）
3. 创建 `Plugin` 子类（继承 BasePlugin），实现 `buildContribution()`
4. 在角色配置 `src/config/roles/*.json` 中添加插件 ID
5. 在 `src/modules/index.ts` 中导出公开接口

### 6.2 添加新图层

1. 实现 `LayerRenderer` 接口（`src/core/layer/renderers/`）
2. 定义 `supportedTypes` 和 `renderingMode`
3. 实现 `addLayer / removeLayer / updateLayer / setVisibility / setOpacity`
4. 在 `LayerPresets.ts` 中添加图层定义和树节点
5. 在插件的 `buildContribution()` 中注册图层

### 6.3 添加新数据源

1. 在 `src/modules/map-data/types/environment.ts` 中定义数据类型
2. 在 `src/store/environmentStore.ts` 中添加存储方法
3. 在 `src/core/config/ConfigRegistry.ts` 中注册配置描述符
4. 实现适配器函数（API 调用 + 数据转换）

### 6.4 添加新地图引擎

1. 实现 `MapEngine` 接口（`src/core/map-engine/MapEngine.ts`）
2. 在 `EngineFactory.ts` 中注册引擎
3. 确保支持所有核心方法（图层/实体/事件/分析）

### 6.5 添加新验证规则

1. 在 `FieldConfig.validate` 中添加字段级自定义验证
2. 在 `ConfigDescriptor.validator` 中添加跨字段验证
3. 验证结果格式：`{ field, message, code }`

### 6.6 添加新 WebSocket 消息类型

1. 在 `src/api/websocket.ts` 的 `processMessage()` 方法中添加 `case`
2. 更新对应的 Zustand Store
3. 在 `src/api/types.ts` 中定义 payload 类型
4. 在 `src/store/eventStore.ts` 中记录事件（如适用）
