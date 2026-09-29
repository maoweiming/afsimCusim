# TrueSim 数据模型参考

## 1. 仿真数据模型

### 1.1 SimPhase — 仿真阶段

**来源**：`src/store/simStore.ts`

```typescript
type SimPhase = 'idle' | 'running' | 'paused' | 'complete'
```

| 值 | 说明 |
|----|------|
| `idle` | 空闲，未启动仿真 |
| `running` | 仿真运行中 |
| `paused` | 仿真已暂停 |
| `complete` | 仿真已完成 |

### 1.2 PlatformInfo — 平台信息

**来源**：`src/store/platformStore.ts`

```typescript
interface PlatformInfo {
  index: number                    // 平台索引（唯一标识）
  name: string                     // 平台名称
  typeId: string                   // 装备型号 ID
  side: string                     // 阵营："blue" | "red" | "neutral"
  lat: number                      // 纬度（度）
  lon: number                      // 经度（度）
  alt: number                      // 高度（米）
  heading?: number                 // 航向角（度）
  pitch?: number                   // 俯仰角（度）
  roll?: number                    // 滚转角（度）
  velN?: number                    // 北向速度（m/s）
  velE?: number                    // 东向速度（m/s）
  velD?: number                    // 下向速度（m/s）
  damageFactor: number             // 损伤因子（0-1）
  broken?: boolean                 // 是否损毁
  initialized?: boolean            // 是否已初始化
  sensors: Record<string, SensorInfo>   // 传感器集合
  fuel: Record<string, number>         // 燃料集合（名称 → 剩余量）
  mission?: MissionStatus              // 任务状态
  combat?: CombatStatus                // 战斗状态
  communications?: CommunicationsStatus // 通信状态
  operational?: OperationalStatus       // 运维状态
}
```

**示例**：
```json
{
  "index": 1,
  "name": "F-16 #01",
  "typeId": "f16c",
  "side": "blue",
  "lat": 39.9042,
  "lon": 116.4074,
  "alt": 8000,
  "heading": 45,
  "damageFactor": 0,
  "sensors": {
    "APG-68": { "name": "APG-68", "type": "radar", "isOn": true }
  },
  "fuel": { "internal": 3200 },
  "mission": { "type": "patrol", "status": "on_station", "progress": 60 }
}
```

### 1.3 SensorInfo — 传感器信息

**来源**：`src/store/platformStore.ts`

```typescript
interface SensorInfo {
  name: string                     // 传感器名称
  type: string                     // 传感器类型
  isOn: boolean                    // 是否开启
  detections?: number[]            // 检测到的目标索引列表
}
```

### 1.4 MissionStatus — 任务状态

**来源**：`src/store/platformStore.ts`

```typescript
interface MissionStatus {
  type: 'patrol' | 'strike' | 'escort' | 'recon' | 'cargo' | 'cap' | 'cas'
  status: 'en_route' | 'on_station' | 'engaging' | 'rtb' | 'completed' | 'aborted'
  waypointsRemaining: number       // 剩余航路点数
  eta?: number                     // 预计到达时间（仿真秒）
  progress: number                 // 任务进度（0-100%）
}
```

### 1.5 TrackInfo — 航迹信息

**来源**：`src/api/types.ts`、`src/store/trackStore.ts`

```typescript
interface TrackId {
  originator_index: number         // 探测平台索引
  target_index: number             // 目标平台索引
  sensor_name: string              // 传感器名称
}

interface TrackData {
  id: TrackId                      // 航迹标识
  originator_index: number         // 探测平台索引
  target_index: number             // 目标平台索引
  lat: number                      // 目标纬度
  lon: number                      // 目标经度
  alt: number                      // 目标高度
  vel_n: number                    // 北向速度
  vel_e: number                    // 东向速度
  vel_d: number                    // 下向速度
  quality: number                  // 航迹质量（0-1）
}
```

**航迹键值**：`${originator_index}:${target_index}:${sensor_name}`

### 1.6 WeaponEngagement — 武器交战

**来源**：`src/api/types.ts`、`src/store/weaponStore.ts`

```typescript
interface WeaponEngagement {
  weapon_platform_index: number    // 武器平台索引
  firing_platform_index: number    // 发射平台索引
  weapon_name: string              // 武器名称
  target_platform_index: number    // 目标平台索引
  launch_lat: number               // 发射纬度
  launch_lon: number               // 发射经度
  launch_alt: number               // 发射高度
  current_lat?: number             // 当前纬度
  current_lon?: number             // 当前经度
  current_alt?: number             // 当前高度
  hit?: boolean                    // 是否命中
}
```

### 1.7 FullSnapshotPayload — 全量快照

**来源**：`src/api/types.ts`

```typescript
interface FullSnapshotPayload {
  sim_state: SimState              // 仿真状态
  sim_time: number                 // 仿真时间（秒）
  clock_rate: number               // 时钟倍率
  platforms: PlatformData[]        // 所有平台
  tracks: TrackData[]              // 所有航迹
  active_weapons: WeaponEngagement[] // 活跃武器
  recent_events: SimEvent[]        // 最近事件
}
```

---

## 2. 装备数据模型

### 2.1 Equipment — 装备主模型

**来源**：`src/modules/equipment/types.ts`

```typescript
interface Equipment {
  id: string                       // 唯一标识
  code: string                     // 装备编码
  name: string                     // 中文名称
  nameEn?: string                  // 英文名称
  category: EquipmentCategory      // 装备分类
  platformType: string             // 平台类型标识
  description: string              // 描述
  version: number                  // 版本号
  status: EquipmentStatus          // 状态

  // 扩展元数据
  country?: string                 // 国家/地区
  manufacturer?: string            // 制造商

  platformParams: PlatformParams   // 平台参数
  sensors: SensorConfig[]          // 传感器配置列表
  weapons: WeaponConfig[]          // 武器配置列表
  communications: CommConfig[]     // 通信配置列表
  signatureParams: SignatureParams // 特征参数

  tags: string[]                   // 标签
  createdBy: string                // 创建者
  updatedBy: string                // 更新者
  createdAt: string                // 创建时间（ISO 8601）
  updatedAt: string                // 更新时间（ISO 8601）
}
```

### 2.2 EquipmentCategory — 装备分类

**来源**：`src/modules/equipment/types.ts`

```typescript
type EquipmentCategory = 'aircraft' | 'ship' | 'vehicle' | 'weapon_system' | 'sensor_system'
```

| 值 | 中文 | 说明 |
|----|------|------|
| `aircraft` | 飞行器 | 固定翼、旋翼、无人机 |
| `ship` | 舰船 | 水面舰艇、潜艇 |
| `vehicle` | 车辆 | 地面车辆、装甲车 |
| `weapon_system` | 武器系统 | 导弹系统、火炮系统 |
| `sensor_system` | 传感器系统 | 雷达站、声呐阵列 |

### 2.3 PlatformParams — 平台参数

**来源**：`src/modules/equipment/types.ts`

```typescript
interface PlatformParams {
  maxSpeed: number          // 最大速度（km/h）
  minSpeed: number          // 最小速度（km/h）
  cruiseSpeed: number       // 巡航速度（km/h）
  maxAltitude: number       // 最大高度（m）
  minAltitude: number       // 最小高度（m）
  ceiling: number           // 升限（m）
  range: number             // 航程（km）
  endurance: number         // 续航时间（h）
  maxG: number              // 最大过载（G）
  length: number            // 长度（m）
  width: number             // 宽度/翼展（m）
  height: number            // 高度（m）
  weight: number            // 空重（kg）
  maxTakeoffWeight: number  // 最大起飞重量（kg）
  fuelCapacity: number      // 燃料容量（kg 或 L）
  motionModel: MotionModel  // 运动模型
}
```

### 2.4 MotionModel — 运动模型

**来源**：`src/modules/equipment/types.ts`

```typescript
type MotionModel = 'point_mass' | 'six_dof' | 'three_dof' | 'flat_earth'
                 | 'air_mover' | 'sea_mover' | 'ground_mover' | 'math3d'
```

| 值 | 中文 | 说明 |
|----|------|------|
| `point_mass` | 质点模型 | 最简单的运动模型 |
| `six_dof` | 六自由度 | 完整飞行动力学 |
| `three_dof` | 三自由度 | 简化飞行动力学 |
| `flat_earth` | 平面地球 | 忽略地球曲率 |
| `air_mover` | 空中机动 | AFSIM 空中机动模型 |
| `sea_mover` | 海上机动 | AFSIM 海上机动模型 |
| `ground_mover` | 地面机动 | AFSIM 地面机动模型 |
| `math3d` | 数学3D | 数学路径定义 |

### 2.5 SensorConfig — 传感器配置

**来源**：`src/modules/equipment/types.ts`

```typescript
interface SensorConfig {
  id: string                // 唯一标识
  name: string              // 名称
  type: SensorType          // 类型
  enabled: boolean          // 是否启用
  maxRange: number          // 最大探测距离（km）
  minRange: number          // 最小探测距离（km）
  fovAzimuth: number        // 方位视场角（度）
  fovElevation: number      // 俯仰视场角（度）
  scanRate: number          // 扫描速率（度/秒）
  accuracy: number          // 精度（m CEP）
  frequency: number         // 频率（GHz 或 μm）
  power: number             // 功率（kW）
  antennaGain: number       // 天线增益（dBi）
  pulseWidth: number        // 脉宽（μs）
  prf: number               // 脉冲重复频率（Hz）
  sensitivity: number       // 灵敏度（dBm）
  description?: string      // 描述
}
```

**SensorType**：
```typescript
type SensorType = 'radar' | 'ir' | 'eo' | 'sonar' | 'ew' | 'esm' | 'ladar' | 'sar'
```

### 2.6 WeaponConfig — 武器配置

**来源**：`src/modules/equipment/types.ts`

```typescript
interface WeaponConfig {
  id: string                // 唯一标识
  name: string              // 名称
  type: WeaponType          // 类型
  quantity: number          // 携带数量
  maxRange: number          // 最大射程（km）
  minRange: number          // 最小射程（km）
  noEscapeRange: number     // 不可逃逸区（km）
  noManeuverRange: number   // 不可机动区（km）
  maxSpeed: number          // 最大速度（km/h）
  maxAltitude: number       // 最大高度（m）
  maxG: number              // 最大过载（G）
  flightTime: number        // 飞行时间（s）
  warheadType: WarheadType  // 战斗部类型
  guidanceType: GuidanceType // 制导方式
  weight: number            // 重量（kg）
  warheadWeight: number     // 战斗部重量（kg）
  blastRadius: number       // 爆破半径（m）
  penetration: number       // 穿透力（mm）
  seekerRange: number       // 导引头作用距离（km）
  description?: string      // 描述
}
```

**WarheadType**：`'he' | 'fragmentation' | 'shaped_charge' | 'penetrating' | 'nuclear' | 'kinetic'`

**GuidanceType**：`'active_radar' | 'semi_active_radar' | 'ir' | 'gps_ins' | 'laser' | 'wire' | 'inertial' | 'command'`

### 2.7 CommConfig — 通信配置

**来源**：`src/modules/equipment/types.ts`

```typescript
interface CommConfig {
  id: string                // 唯一标识
  name: string              // 名称
  type: CommType            // 类型
  enabled: boolean          // 是否启用
  frequency: number         // 频率（MHz）
  maxRange: number          // 最大通信距离（km）
  dataRate: number          // 数据速率（kbps）
  bandwidth: number         // 带宽（MHz）
  latency: number           // 延迟（ms）
  hopRate: number           // 跳频速率（hops/s）
  encryption: string        // 加密方式
  description?: string      // 描述
}
```

**CommType**：`'uhf' | 'vhf' | 'satcom' | 'datalink'`

### 2.8 SignatureParams — 特征参数

**来源**：`src/modules/equipment/types.ts`

```typescript
interface SignatureParams {
  rcs: {
    frontal: number         // 前向 RCS（m² dBsm）
    side: number            // 侧向 RCS
    rear: number            // 后向 RCS
    average: number         // 平均 RCS
  }
  ir: {
    frontal: number         // 前向红外特征（W/sr）
    side: number            // 侧向红外特征
    rear: number            // 后向红外特征
  }
  acoustic: {
    noise_level: number     // 噪声级别（dB）
    frequency: number       // 频率（Hz）
  }
  visual: {
    visibility: number      // 可见性（0-1）
  }
}
```

---

## 3. 想定数据模型

### 3.1 Scenario — 想定主模型

**来源**：`src/modules/scenario/types.ts`

```typescript
interface Scenario {
  id: string                       // 唯一标识
  name: string                     // 想定名称
  description: string              // 描述
  version: string                  // 语义化版本
  status: ScenarioStatus           // 状态

  terrain: TerrainConfig           // 地形配置
  platforms: PlatformInstance[]    // 平台实例列表
  routes: RouteDefinition[]       // 航线列表
  zones: ZoneDefinition[]         // 区域列表

  tags: string[]                   // 标签
  classification: string           // 密级
  collaborators: Collaborator[]    // 协作者列表
  createdBy: string                // 创建者
  createdAt: string                // 创建时间
  updatedAt: string                // 更新时间
}
```

**ScenarioStatus**：`'draft' | 'in_review' | 'approved' | 'archived'`

### 3.2 PlatformInstance — 平台实例

**来源**：`src/modules/scenario/types.ts`

```typescript
interface PlatformInstance {
  id: string                       // 唯一标识
  equipmentId: string              // 引用装备库 ID
  name: string                     // 实例名称
  side: 'blue' | 'red' | 'neutral' | 'green'  // 阵营
  initialPosition: { lng: number; lat: number } // 初始位置
  initialAltitude: number          // 初始高度（米）
  initialHeading: number           // 初始航向（度）
  initialSpeed: number             // 初始速度（节）
  routeId?: string                 // 关联航线 ID
  sensors?: string[]               // 传感器配置
  weapons?: string[]               // 武器配置
  lockedBy?: string                // 锁定用户 ID
}
```

### 3.3 RouteDefinition — 航线定义

**来源**：`src/modules/scenario/types.ts`

```typescript
interface RouteDefinition {
  id: string                       // 唯一标识
  name: string                     // 航线名称
  waypoints: RouteWaypoint[]       // 航路点列表
  color?: string                   // 显示颜色
  lockedBy?: string                // 锁定用户 ID
}

interface RouteWaypoint {
  position: { lng: number; lat: number }  // 位置
  altitude: number                 // 高度（米）
  speed: number                    // 速度（节）
  name?: string                    // 航路点名称
}
```

### 3.4 ZoneDefinition — 区域定义

**来源**：`src/modules/scenario/types.ts`

```typescript
interface ZoneDefinition {
  id: string                       // 唯一标识
  name: string                     // 区域名称
  type: 'exclusion' | 'inclusion' | 'threat' | 'safe'  // 区域类型
  geometry: ZoneGeometry           // 几何形状
  fillColor?: string               // 填充颜色
  strokeColor?: string             // 描边颜色
  lockedBy?: string                // 锁定用户 ID
}

type ZoneGeometry = ZoneCircleGeometry | ZonePolygonGeometry

interface ZoneCircleGeometry {
  type: 'circle'
  center: { lng: number; lat: number }
  radius: number                   // 半径（米）
}

interface ZonePolygonGeometry {
  type: 'polygon'
  vertices: Array<{ lng: number; lat: number }>
}
```

---

## 4. 环境数据模型

### 4.1 WeatherData — 天气数据

**来源**：`src/modules/map-data/types/environment.ts`（对标 WMO SYNOP/METAR 标准）

```typescript
interface WeatherData {
  stationId: string                // 站点编号
  stationName?: string             // 站点名称
  position: LngLat                 // 位置
  timestamp: number                // unix 时间戳（秒）

  wind: {
    speed: number                  // 风速
    direction: number              // 风向（0-360°，正北为 0）
    gust?: number                  // 阵风
    unit: 'knots' | 'm/s' | 'km/h'
  }
  temperature: {
    air: number                    // 气温（°C）
    dewPoint?: number              // 露点（°C）
    feelsLike?: number             // 体感温度（°C）
    unit: 'C' | 'K'
  }
  pressure: {
    seaLevel: number               // 海平面气压（hPa）
    station?: number               // 站点气压（hPa）
    unit: 'hPa' | 'inHg'
  }
  visibility: number               // 能见度（米）
  precipitation: {
    type: 'none' | 'rain' | 'snow' | 'sleet' | 'hail' | 'drizzle'
    intensity?: number             // 降水强度（mm/h）
  }
  cloudCover: {
    total: number                  // 总云量（0-1）
    layers: CloudLayer[]           // 云层列表
  }
  humidity: number                 // 湿度（0-100%）
  weatherCode?: string             // METAR/SYNOP 天气代码
  source?: string                  // 数据源
}
```

**示例**：
```json
{
  "stationId": "ZBAA",
  "stationName": "北京首都",
  "position": { "lng": 116.588, "lat": 40.072 },
  "timestamp": 1714300800,
  "wind": { "speed": 5.2, "direction": 270, "unit": "m/s" },
  "temperature": { "air": 22.5, "unit": "C" },
  "pressure": { "seaLevel": 1013.25, "unit": "hPa" },
  "visibility": 10000,
  "humidity": 45
}
```

### 4.2 SeaStateData — 海情数据

**来源**：`src/modules/map-data/types/environment.ts`（对标 WMO 45 标准）

```typescript
interface SeaStateData {
  position: LngLat                 // 位置
  timestamp: number                // 时间戳

  wave: {
    significantHeight: number      // 有效浪高（米）
    maxHeight?: number             // 最大浪高（米）
    direction: number              // 浪向（0-360°）
    period: number                 // 周期（秒）
    unit: 'm'
  }
  swell: {
    height: number                 // 涌浪高（米）
    direction: number              // 涌浪向（0-360°）
    period: number                 // 涌浪周期（秒）
  }
  current: {
    speed: number                  // 流速
    direction: number              // 流向（0-360°）
    unit: 'knots' | 'm/s'
  }
  seaSurfaceTemperature: number    // 海表温度（°C）
  seaState: SeaStateGrade          // 海况等级（Douglas scale 0-9）
  iceCondition?: IceCondition      // 冰况
  source?: string                  // 数据源
}
```

### 4.3 TideData — 潮汐数据

**来源**：`src/modules/map-data/types/environment.ts`（对标 IHO/NOAA 标准）

```typescript
interface TideData {
  stationId: string                // 站点编号
  stationName: string              // 站点名称
  position: LngLat                 // 位置
  timestamp: number                // 时间戳

  level: number                    // 当前潮位（米）
  trend: TideTrend                 // 潮汐趋势
  predictions: TidePrediction[]    // 潮汐预测
  current?: {
    speed: number                  // 潮流速度（节）
    direction: number              // 潮流方向（0-360°）
    type: 'flood' | 'ebb' | 'slack'
  }
  datum: TideDatum                 // 基准面
  source?: string                  // 数据源
}

type TideTrend = 'rising' | 'falling' | 'high' | 'low' | 'slack'
type TideDatum = 'MLLW' | 'MSL' | 'LAT' | 'MLW' | 'MHW' | 'HHW' | 'ISLW'
```

### 4.4 AtmosphericData — 大气数据

**来源**：`src/modules/map-data/types/environment.ts`

```typescript
interface AtmosphericData {
  position: LngLat                 // 位置
  timestamp: number                // 时间戳

  ceiling?: number                 // 云底高（米 AGL）
  turbulence: 'none' | 'light' | 'moderate' | 'severe'  // 湍流等级
  icingConditions: 'none' | 'light' | 'moderate' | 'severe'  // 结冰条件
  windShear?: {
    altitude: number               // 高度（米）
    speedChange: number            // 风速变化（m/s）
    directionChange: number        // 风向变化（度）
  }
  tropopause?: {
    altitude: number               // 对流层顶高度（米）
    temperature: number            // 对流层顶温度（°C）
  }
  source?: string                  // 数据源
}
```

---

## 5. 事件数据模型

### 5.1 SimEvent — 仿真事件

**来源**：`src/store/eventStore.ts`

```typescript
interface SimEvent {
  id: string                       // 事件 ID（自动生成）
  timestamp: number                // 仿真时间（秒）
  wallTime: number                 // 墙钟时间（Date.now()）
  category: EventCategory          // 事件分类
  severity: EventSeverity          // 严重级别
  message: string                  // 事件消息
  entityRefs?: EntityRef[]         // 关联实体列表
  payload?: Record<string, unknown> // 附加数据
  source: 'websocket' | 'client' | 'system' // 事件来源
  tags?: string[]                  // 标签
  simId?: string                   // 关联仿真 ID
}
```

### 5.2 EventCategory — 事件分类

**来源**：`src/store/eventStore.ts`

```typescript
type EventCategory = 'simulation' | 'platform' | 'weapon' | 'sensor'
  | 'track' | 'communication' | 'system' | 'environment' | 'ai'
```

| 值 | 中文 | 颜色 |
|----|------|------|
| `simulation` | 仿真 | #4fc3f7 |
| `platform` | 平台 | #81c784 |
| `weapon` | 武器 | #ef5350 |
| `sensor` | 传感器 | #ffb74d |
| `track` | 航迹 | #00bcd4 |
| `communication` | 通信 | #ab47bc |
| `system` | 系统 | #78909c |
| `environment` | 环境 | #26a69a |
| `ai` | AI | #ffa726 |

### 5.3 EventSeverity — 事件严重级别

**来源**：`src/store/eventStore.ts`

```typescript
type EventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical'
```

| 值 | 中文 | 颜色 |
|----|------|------|
| `debug` | 调试 | #616161 |
| `info` | 信息 | #4fc3f7 |
| `warning` | 警告 | #ffb74d |
| `error` | 错误 | #ef5350 |
| `critical` | 严重 | #d32f2f |

### 5.4 EventQuery — 事件查询

**来源**：`src/store/eventStore.ts`

```typescript
interface EventQuery {
  timeRange?: [number, number]     // 仿真时间范围
  wallTimeRange?: [number, number] // 墙钟时间范围
  categories?: EventCategory[]     // 分类过滤
  severities?: EventSeverity[]     // 严重级别过滤
  entityIndex?: number             // 关联实体索引
  searchText?: string              // 消息关键字搜索
  tags?: string[]                  // 标签过滤
  limit?: number                   // 返回数量限制
  offset?: number                  // 偏移量
}
```

### 5.5 EntityRef — 实体引用

**来源**：`src/core/types/common.ts`

```typescript
interface EntityRef {
  type: 'platform' | 'weapon' | 'track' | 'sensor' | 'zone' | 'route'
  index: number                    // 实体索引
  name?: string                    // 实体名称
}
```

---

## 6. AI/作战数据模型

### 6.1 PlatformAiState — 平台 AI 状态

**来源**：`src/store/aiStore.ts`

```typescript
interface PlatformAiState {
  platformIndex: number            // 平台索引
  oodaPhase: OodaPhase             // OODA 循环阶段
  oodaPhaseStartTime: number       // 阶段开始时间
  threatScore: number              // 威胁评分（0-1）
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  engagementDecision: 'hold' | 'engage' | 'evade' | 'rtb'
  aiBehaviorMode: string           // AI 行为模式
  lastDecisionTime: number         // 最后决策时间
}

type OodaPhase = 'observe' | 'orient' | 'decide' | 'act'
```

### 6.2 ThreatAssessment — 威胁评估

**来源**：`src/store/threatStore.ts`

```typescript
interface ThreatAssessment {
  platformIndex: number            // 评估平台索引
  targetIndex: number              // 目标平台索引
  threatLevel: 'low' | 'medium' | 'high' | 'critical'
  engagementStatus: 'tracking' | 'engaging' | 'defending' | 'evading'
  riskScore: number                // 风险评分（0-1）
  wezClosureRate?: number          // WEZ 接近速率（km/s）
  timeToWez?: number               // 进入 WEZ 时间（秒）
  timestamp: number                // 评估时间
}
```

### 6.3 WezEntry — 可发射区

**来源**：`src/store/wezStore.ts`

```typescript
interface WezEntry {
  platformIndex: number            // 平台索引
  weaponName: string               // 武器名称
  rangeKm: number                  // 射程（km）
  maxOffAxisDeg: number            // 最大离轴角（度）
  probabilityOfKill: number        // 命中概率（0-1）
  side: 'blue' | 'red' | 'neutral'
}
```

### 6.4 IadsC2State — IADS C2 状态

**来源**：`src/store/aiStore.ts`

```typescript
interface IadsC2State {
  battleManagerId: string          // 战斗管理器 ID
  engagementAuthority: boolean     // 交战授权
  shotDoctrine: 'shoot-look-shoot' | 'shoot-shoot' | 'salvo'
  activeEngagements: number        // 活跃交战数
  pendingEngagements: number       // 待处理交战数
}
```

### 6.5 EwState — 电子战状态

**来源**：`src/store/aiStore.ts`

```typescript
interface EwState {
  platformIndex: number            // 平台索引
  isJamming: boolean               // 是否正在干扰
  jammingType: string              // 干扰类型
  jammingTarget?: number           // 干扰目标索引
  emitters: Array<{
    name: string                   // 辐射源名称
    type: string                   // 辐射源类型
    isOn: boolean                  // 是否开启
    frequency?: number             // 频率
    power?: number                 // 功率
  }>
}
```

---

## 7. 地图数据模型

### 7.1 MapEngine — 地图引擎接口

**来源**：`src/core/map-engine/MapEngine.ts`

```typescript
interface MapEngine {
  readonly type: MapEngineType     // 'cesium' | 'leaflet' | 'mapboxgl' | 'openlayers'
  readonly dimension: MapDimension // '2d' | '3d'

  // 生命周期（6 个方法）
  initialize / destroy / isReady

  // 地图操作（7 个方法）
  setView / flyTo / fitBounds / getCenter / getZoom / getBounds

  // 底图地形（4 个方法）
  setImagerySource / setTerrainSource / getImagerySources / getTerrainSources

  // 图层管理（7 个方法）
  addLayer / removeLayer / updateLayer / setLayerVisibility / setLayerOpacity / getLayers / reorderLayers

  // 实体管理（7 个方法）
  addEntity / removeEntity / updateEntity / setEntityVisibility / getEntity / getEntities / clearEntities

  // 选择高亮（6 个方法）
  selectEntity / deselectEntity / deselectAll / getSelectedEntities / highlightEntity / unhighlightEntity

  // 相机控制（3 个方法）
  flyToEntity / trackEntity / untrackEntity

  // 事件监听（6 个方法）
  onClick / onDoubleClick / onRightClick / onHover / onViewChange / onDraw

  // 绘图工具（2 个方法）
  startDraw / cancelDraw

  // 地形分析（4 个方法）
  getTerrainHeight / computeLineOfSight / computeViewshed / getTerrainProfile

  // 坐标转换（2 个方法）
  lngLatToScreen / screenToLngLat

  // 截图（1 个方法）
  captureImage

  // 坐标系转换（2 个方法）
  metersToDegrees / degreesToMeters

  // 底层引擎（1 个方法）
  getNativeEngine
}
```

### 7.2 UnifiedLayerStyle — 统一图层样式

**来源**：`src/core/layer/types.ts`

```typescript
interface UnifiedLayerStyle {
  // 点/平台
  pointColor?: string              // 点颜色
  pointSize?: number               // 点大小
  pointOutline?: boolean           // 是否描边
  pointOutlineColor?: string       // 描边颜色
  pointOutlineWidth?: number       // 描边宽度
  iconUrl?: string                 // 图标 URL
  iconScale?: number               // 图标缩放
  iconRotation?: number            // 图标旋转

  // 线
  lineColor?: string               // 线颜色
  lineWidth?: number               // 线宽度
  lineDash?: number[]              // 虚线模式
  lineGlow?: boolean               // 是否发光
  lineGlowColor?: string           // 发光颜色
  lineGlowPower?: number           // 发光强度

  // 面
  fillColor?: string               // 填充颜色
  fillOpacity?: number             // 填充透明度
  strokeColor?: string             // 描边颜色
  strokeWidth?: number             // 描边宽度
  strokeDash?: number[]            // 描边虚线

  // 标签
  labelField?: string              // 标签字段
  labelFont?: string               // 字体
  labelSize?: number               // 字号
  labelColor?: string              // 颜色
  showLabel?: boolean              // 是否显示

  // 波束
  beamAlpha?: number               // 波束透明度
  beamDashLength?: number          // 波束虚线长度

  // 3D 模型
  modelUrl?: string                // 模型 URL
  modelScale?: number              // 模型缩放
}
```

### 7.3 LayerTreeNode — 图层树节点

**来源**：`src/core/layer/types.ts`

```typescript
interface LayerTreeNode {
  key: string                      // 唯一键
  title: string                    // 显示标题
  group: LayerGroupType            // 分组类型
  layerId?: string                 // 关联图层 ID
  children?: LayerTreeNode[]       // 子节点
  visible: boolean                 // 是否可见
  opacity: number                  // 透明度（0-1）
  zIndex: number                   // 层级
  locked?: boolean                 // 是否锁定
  icon?: string                    // 图标名称
}

type LayerGroupType = 'simulation' | 'scenario' | 'geospatial' | 'basemap' | 'custom'
```

---

## 8. 配置数据模型

### 8.1 FieldConfig — 字段配置

**来源**：`src/core/config/ConfigRegistry.ts`

```typescript
interface FieldConfig {
  key: string                      // 数据字段名（支持点号嵌套）
  label: string                    // 中文显示标签
  type: 'number' | 'text' | 'select' | 'textarea' | 'boolean' | 'date' | 'json'
  unit?: string                    // 单位后缀
  group: string                    // 分组名
  required?: boolean               // 是否必填
  options?: { value: string; label: string }[]  // 选项列表
  min?: number                     // 最小值
  max?: number                     // 最大值
  step?: number                    // 步长
  colspan?: number                 // 列跨度
  tooltip?: string                 // 提示文本
  defaultValue?: unknown           // 默认值
  readonly?: boolean               // 是否只读
  hidden?: boolean                 // 是否隐藏
  validate?: (value: unknown) => string | null  // 自定义验证
}
```

### 8.2 ConfigDescriptor — 配置描述符

**来源**：`src/core/config/ConfigRegistry.ts`

```typescript
interface ConfigDescriptor<T = any> {
  id: string                       // 唯一标识（如 'equipment.aircraft'）
  name: string                     // 显示名称
  version: string                  // 配置版本
  schema: FieldConfig[]            // 字段定义
  defaults: T                      // 默认值
  groups?: FieldGroup[]            // 字段分组元数据
  validator?: (data: T) => ValidationResult  // 自定义验证器
}
```

### 8.3 ValidationResult — 验证结果

**来源**：`src/core/types/common.ts`

```typescript
interface ValidationResult {
  valid: boolean                   // 是否通过
  errors: ValidationError[]        // 错误列表
  warnings: ValidationError[]      // 警告列表
}

interface ValidationError {
  field: string                    // 字段路径
  message: string                  // 错误消息
  code: string                     // 错误代码
}
```

### 8.4 协同编辑类型

**来源**：`src/core/collaboration/types.ts`

```typescript
// 协同用户
interface CollabUser {
  userId: string
  userName: string
  avatar?: string
  role: 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer'
  color: string                    // 用户颜色标识
  online: boolean
  lastActive: Date
}

// 操作转换
interface Operation {
  id: string
  userId: string
  timestamp: number
  type: 'insert' | 'update' | 'delete' | 'move'
  path: string                     // JSON path
  oldValue?: any
  newValue?: any
  vectorClock: Record<string, number>
}

// 分支
interface Branch {
  id: string
  scenarioId: string
  name: string
  parentBranchId?: string
  createdBy: string
  createdAt: Date
  status: 'active' | 'merged' | 'abandoned'
}

// 合并请求
interface MergeRequest {
  id: string
  scenarioId: string
  sourceBranch: string
  targetBranch: string
  title: string
  description: string
  status: 'open' | 'reviewing' | 'approved' | 'merged' | 'closed' | 'conflict'
  conflicts: Conflict[]
  reviewers: Reviewer[]
}
```

---

## 9. 通用类型

### 9.1 坐标类型

**来源**：`src/core/types/common.ts`

```typescript
interface LngLat {
  lng: number                      // 经度
  lat: number                      // 纬度
}

interface LngLatAlt extends LngLat {
  alt: number                      // 高度（米）
}

interface LngLatBounds {
  south: number                    // 南界
  west: number                     // 西界
  north: number                    // 北界
  east: number                     // 东界
}
```

### 9.2 分页类型

**来源**：`src/core/types/common.ts`

```typescript
interface PaginationParams {
  page: number                     // 页码（从 1 开始）
  pageSize: number                 // 每页数量
}

interface PaginatedResult<T> {
  data: T[]                        // 数据列表
  total: number                    // 总数
  page: number                     // 当前页
  pageSize: number                 // 每页数量
}
```

### 9.3 时间范围

**来源**：`src/core/types/common.ts`

```typescript
interface TimeRange {
  start: number                    // 开始时间
  end: number                      // 结束时间
}
```
