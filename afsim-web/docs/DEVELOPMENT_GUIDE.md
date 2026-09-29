# TrueSim 开发指南

## 1. 环境搭建

### 1.1 前置条件

- Node.js 18+（推荐 LTS）
- npm 9+
- 现代浏览器（Chrome 100+ / Firefox 100+ / Edge 100+）

### 1.2 安装与启动

```bash
# 克隆仓库
git clone <repo-url>
cd afsim-web

# 安装依赖
npm install

# 启动开发服务器（默认端口 3000）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 1.3 环境变量

在项目根目录创建 `.env.local`：

```bash
# 仿真网关端口（默认 8080）
VITE_GATEWAY_PORT=8080

# 数据平台 API 地址（默认 http://localhost:8080/api/v1）
VITE_DATA_API_URL=http://localhost:8080/api/v1
```

### 1.4 后端服务（可选）

```bash
# 仿真网关
cd afsim-gateway && bin/gateway.exe

# 数据平台
cd data-platform/deploy && docker compose up -d
```

---

## 2. 项目结构

```
afsim-web/
├── public/                          # 静态资源
├── src/
│   ├── api/                         # API 客户端
│   │   ├── client.ts                #   仿真网关 REST 客户端
│   │   ├── controlApi.ts            #   控制指令 API（传感器/武器）
│   │   ├── dataPlatform.ts          #   数据平台 REST 客户端
│   │   ├── replayApi.ts             #   回放数据 API
│   │   ├── types.ts                 #   WebSocket 消息类型定义
│   │   └── websocket.ts             #   WebSocket 客户端（37 种消息处理）
│   │
│   ├── config/
│   │   └── roles/                   # 角色配置
│   │       ├── admin.json           #   管理员角色
│   │       ├── operator.json        #   操作员角色
│   │       ├── analyst.json         #   分析师角色
│   │       └── viewer.json          #   观察员角色
│   │
│   ├── core/                        # 核心框架
│   │   ├── collaboration/           #   协同编辑（OT、分支、合并请求）
│   │   ├── config/                  #   配置驱动（ConfigRegistry、FieldConfig）
│   │   ├── data-platform/           #   数据总线（EventBus、DataBus）
│   │   ├── layer/                   #   图层系统（LayerManager、7 渲染器、预设）
│   │   ├── map-engine/              #   地图引擎（MapEngine、CesiumEngine、LeafletEngine）
│   │   ├── plugin/                  #   插件系统（PluginRegistry、类型定义）
│   │   ├── storage/                 #   本地存储（IndexedDBStore）
│   │   └── types/                   #   共享类型（坐标、验证、分页）
│   │
│   ├── modules/                     # 功能模块
│   │   ├── data-center/             #   数据中心（仪表盘、版本、生命周期、导出）
│   │   ├── equipment/               #   装备管理（列表、详情、编辑器、导入导出）
│   │   ├── map-data/                #   地图数据（图层面板、数据源、样式编辑、地形分析）
│   │   ├── scenario/                #   想定编辑（列表、编辑器、平台放置、航线、区域、协同）
│   │   └── simulation/              #   仿真增强（传感器、武器、航迹、回放、AI、EW）
│   │
│   ├── plugins/                     # 插件定义
│   │   ├── BasePlugin.ts            #   插件抽象基类
│   │   ├── SimGlobePlugin.tsx       #   仿真地球插件（所有角色）
│   │   ├── MapDataPlugin.tsx        #   地图数据插件（admin, analyst）
│   │   ├── ScenarioPlugin.tsx       #   想定管理插件（admin, operator）
│   │   ├── EquipmentPlugin.tsx      #   装备管理插件（admin, operator）
│   │   ├── DataCenterPlugin.tsx     #   数据中心插件（admin, analyst）
│   │   └── AnalysisPlugin.tsx       #   地形分析插件（admin, analyst）
│   │
│   ├── store/                       # Zustand 状态管理（15 个 store）
│   │   ├── simStore.ts              #   仿真阶段/时间/时钟
│   │   ├── platformStore.ts         #   平台实体
│   │   ├── trackStore.ts            #   航迹数据
│   │   ├── weaponStore.ts           #   武器交战
│   │   ├── eventStore.ts            #   结构化事件
│   │   ├── aiStore.ts               #   AI/OODA/EW 状态
│   │   ├── threatStore.ts           #   威胁评估
│   │   ├── wezStore.ts              #   可发射区
│   │   ├── environmentStore.ts      #   环境数据
│   │   ├── layerStore.ts            #   图层配置
│   │   ├── pluginStore.ts           #   插件状态
│   │   ├── errorStore.ts            #   全局错误
│   │   ├── wsHealthStore.ts         #   WebSocket 健康
│   │   ├── helpStore.ts             #   帮助/引导
│   │   └── trackSettingsStore.ts    #   航迹显示设置
│   │
│   ├── pages/                       # 页面组件（按路由加载）
│   ├── components/                  # 共享组件
│   └── App.tsx                      # 应用入口
│
├── docs/                            # 文档
│   ├── REQUIREMENTS.md              #   系统需求
│   ├── ARCHITECTURE.md              #   架构设计
│   ├── DATA_MODEL.md                #   数据模型
│   └── DEVELOPMENT_GUIDE.md         #   开发指南（本文件）
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## 3. 添加新模块

以添加"告警中心"模块为例，完整步骤如下：

### 步骤 1：定义类型

创建 `src/modules/alert-center/types.ts`：

```typescript
export type AlertLevel = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  title: string;
  message: string;
  level: AlertLevel;
  source: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  level: AlertLevel;
  enabled: boolean;
}
```

### 步骤 2：创建 Store

创建 `src/modules/alert-center/store/alertStore.ts`：

```typescript
import { create } from 'zustand';
import type { Alert, AlertRule } from '../types';

interface AlertState {
  alerts: Alert[];
  rules: AlertRule[];
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => void;
  acknowledge: (id: string, userId: string) => void;
  clearAcknowledged: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  rules: [],
  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        ...state.alerts,
        {
          ...alert,
          id: `alert-${Date.now()}`,
          timestamp: Date.now(),
          acknowledged: false,
        },
      ],
    })),
  acknowledge: (id, userId) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true, acknowledgedBy: userId } : a
      ),
    })),
  clearAcknowledged: () =>
    set((state) => ({
      alerts: state.alerts.filter((a) => !a.acknowledged),
    })),
}));
```

### 步骤 3：创建组件

创建 `src/modules/alert-center/components/AlertPanel.tsx`：

```tsx
import { List, Tag, Button } from 'antd';
import { useAlertStore } from '../store/alertStore';
import type { AlertLevel } from '../types';

const levelColors: Record<AlertLevel, string> = {
  info: 'blue',
  warning: 'orange',
  critical: 'red',
};

export default function AlertPanel() {
  const { alerts, acknowledge } = useAlertStore();
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <List
      dataSource={unacknowledged}
      renderItem={(alert) => (
        <List.Item
          actions={[
            <Button size="small" onClick={() => acknowledge(alert.id, 'current-user')}>
              确认
            </Button>,
          ]}
        >
          <Tag color={levelColors[alert.level]}>{alert.level}</Tag>
          {alert.title}
        </List.Item>
      )}
    />
  );
}
```

### 步骤 4：创建插件

创建 `src/plugins/AlertCenterPlugin.tsx`：

```tsx
import { lazy } from 'react';
import { AlertOutlined } from '@ant-design/icons';
import type { PluginContribution } from '../core/plugin/types';
import { BasePlugin } from './BasePlugin';

const AlertPage = lazy(() => import('../pages/AlertPage'));

export class AlertCenterPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'alert-center',
      name: '告警中心',
      version: '1.0.0',
      description: '仿真告警管理',
      author: 'TrueSim',
      allowedRoles: ['admin', 'operator', 'analyst'],
      icon: 'AlertOutlined',
    });
  }

  protected buildContribution(): PluginContribution {
    return {
      routes: [{ path: '/alerts', component: AlertPage, requiresAuth: true }],
      navItems: [{ key: 'alerts', label: '告警中心', icon: <AlertOutlined />, order: 7 }],
    };
  }
}

export default AlertCenterPlugin;
```

### 步骤 5：注册插件

在角色配置中添加插件 ID：

```json
// src/config/roles/admin.json
{
  "plugins": ["sim-globe", "map-data", "scenario", "equipment", "data-center", "analysis", "alert-center"]
}
```

在应用入口注册插件：

```typescript
import { AlertCenterPlugin } from './plugins/AlertCenterPlugin';

const registry = PluginRegistry.getInstance();
registry.register(new AlertCenterPlugin(), { autoInit: true });
```

### 步骤 6：导出模块

更新 `src/modules/index.ts`：

```typescript
export { AlertPanel } from './alert-center/components/AlertPanel';
export { useAlertStore } from './alert-center/store/alertStore';
export type { Alert, AlertLevel, AlertRule } from './alert-center/types';
```

---

## 4. 添加新图层

以添加"热力图"渲染器为例：

### 步骤 1：实现渲染器

创建 `src/core/layer/renderers/HeatmapRenderer.ts`：

```typescript
import type { MapEngine } from '../../map-engine/MapEngine';
import type { LayerRenderer, LayerHandle } from './LayerRenderer';
import type { LayerDefinition } from '../types';

export class HeatmapRenderer implements LayerRenderer {
  readonly supportedTypes = ['heatmap'];
  readonly renderingMode: 'engine' = 'engine';

  private engine: MapEngine | null = null;

  initialize(engine: MapEngine | null): void {
    this.engine = engine;
  }

  addLayer(layer: LayerDefinition): LayerHandle {
    // 创建热力图图层
    const state = {
      layerId: layer.id,
      points: [],
      style: layer.style,
    };
    // 调用 MapEngine 添加图层
    // this.engine?.addLayer(...)
    return { layerId: layer.id, state };
  }

  updateLayer(handle: LayerHandle, changes: Partial<LayerDefinition>): void {
    // 更新图层样式或数据
  }

  removeLayer(handle: LayerHandle): void {
    // 移除图层
  }

  setVisibility(handle: LayerHandle, visible: boolean): void {
    // 设置可见性
  }

  setOpacity(handle: LayerHandle, opacity: number): void {
    // 设置透明度
  }

  onEngineChange(newEngine: MapEngine | null): void {
    this.engine = newEngine;
  }

  destroy(): void {
    this.engine = null;
  }
}
```

### 步骤 2：注册渲染器

在应用初始化时注册：

```typescript
import { LayerManager } from './core/layer/LayerManager';
import { HeatmapRenderer } from './core/layer/renderers/HeatmapRenderer';

const layerManager = LayerManager.getInstance();
layerManager.registerRenderer(new HeatmapRenderer());
```

### 步骤 3：定义图层

在插件的 `buildContribution()` 中添加图层定义：

```typescript
const heatmapLayer: LayerDefinition = {
  id: 'layer-heatmap',
  name: '热力图',
  type: 'heatmap',
  renderingMode: 'engine',
  style: { fillColor: '#ff0000', fillOpacity: 0.6 },
  tags: ['analysis', 'visualization'],
};

// 在 contribution 中
layers: [{ layerDefinition: heatmapLayer, presetGroup: 'analysis' }]
```

---

## 5. 添加新数据源

以添加"自定义气象站"数据适配器为例：

### 步骤 1：定义数据类型

在 `src/modules/map-data/types/environment.ts` 中扩展：

```typescript
export interface CustomWeatherStation {
  stationId: string;
  name: string;
  position: LngLat;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  lastUpdate: number;
}
```

### 步骤 2：在 Store 中添加方法

在 `src/store/environmentStore.ts` 中扩展：

```typescript
// 在 EnvironmentState 接口中添加
customWeather: Map<string, CustomWeatherStation>;
setCustomWeather: (data: CustomWeatherStation[]) => void;
getCustomWeatherAt: (pos: LngLat, maxDistanceKm?: number) => CustomWeatherStation | null;
```

### 步骤 3：注册配置描述符

在 `src/core/config/ConfigRegistry.ts` 中注册：

```typescript
configRegistry.register({
  id: 'environment.custom_weather',
  name: '自定义气象站',
  version: '1.0.0',
  schema: [
    { key: 'stationId', label: '站点编号', type: 'text', group: 'basic', required: true },
    { key: 'temperature', label: '温度', type: 'number', unit: '°C', group: 'basic' },
    { key: 'humidity', label: '湿度', type: 'number', unit: '%', group: 'basic', min: 0, max: 100 },
    { key: 'windSpeed', label: '风速', type: 'number', unit: 'm/s', group: 'wind', min: 0 },
    { key: 'windDirection', label: '风向', type: 'number', unit: '°', group: 'wind', min: 0, max: 360 },
  ],
  defaults: { stationId: '', temperature: 0, humidity: 50, windSpeed: 0, windDirection: 0 },
  groups: [
    { key: 'basic', label: '基本信息', order: 0 },
    { key: 'wind', label: '风场', order: 1 },
  ],
});
```

### 步骤 4：实现适配器函数

创建 `src/modules/map-data/adapters/customWeatherAdapter.ts`：

```typescript
import type { CustomWeatherStation } from '../types/environment';

export async function fetchCustomWeather(
  apiUrl: string,
  bounds?: { south: number; west: number; north: number; east: number }
): Promise<CustomWeatherStation[]> {
  const params = bounds
    ? `?bounds=${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
    : '';
  const response = await fetch(`${apiUrl}/weather${params}`);
  if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
  return response.json();
}
```

---

## 6. 配置驱动开发

### 6.1 FieldConfig 使用模式

FieldConfig 模式用于自动生成表单和验证：

```typescript
import { configRegistry } from '../core/config/ConfigRegistry';

// 1. 注册配置
configRegistry.register({
  id: 'my_module.my_config',
  name: '我的配置',
  version: '1.0.0',
  schema: [
    { key: 'name', label: '名称', type: 'text', group: 'basic', required: true },
    { key: 'value', label: '数值', type: 'number', group: 'basic', min: 0, max: 100 },
    { key: 'type', label: '类型', type: 'select', group: 'basic',
      options: [
        { value: 'a', label: '类型A' },
        { value: 'b', label: '类型B' },
      ]
    },
  ],
  defaults: { name: '', value: 50, type: 'a' },
  groups: [{ key: 'basic', label: '基本信息', order: 0 }],
});

// 2. 创建默认实例
const defaultData = configRegistry.createDefault('my_module.my_config');

// 3. 验证数据
const result = configRegistry.validate('my_module.my_config', formData);
if (!result.valid) {
  console.error('验证失败:', result.errors);
}

// 4. 遍历 schema 自动生成表单
const descriptor = configRegistry.get('my_module.my_config');
for (const field of descriptor.schema) {
  // 根据 field.type 渲染对应的表单控件
  // field.key 支持点号嵌套，如 'rcs.frontal'
}
```

### 6.2 嵌套字段访问

```typescript
import { getNestedValue, setNestedValue } from '../core/config/ConfigRegistry';

const data = { rcs: { frontal: 0.5, side: 1.2 } };

// 读取嵌套值
const frontal = getNestedValue(data, 'rcs.frontal'); // 0.5

// 设置嵌套值
setNestedValue(data, 'rcs.frontal', 0.3);
// data.rcs.frontal === 0.3
```

---

## 7. WebSocket 协议扩展

### 7.1 添加新消息类型

在 `src/api/websocket.ts` 的 `processMessage()` 方法中添加新的 `case`：

```typescript
case 'my_new_event': {
  if (p) {
    // 1. 更新对应的 Store
    useMyStore.getState().updateSomething({
      id: p.id,
      value: p.value,
    });

    // 2. 记录事件（如适用）
    events.addEvent({
      timestamp: t,
      category: 'system',     // 选择合适的分类
      severity: 'info',       // 选择合适的严重级别
      message: `自定义事件: ${p.description}`,
      entityRefs: p.entity_index !== undefined
        ? [{ type: 'platform', index: p.entity_index }]
        : undefined,
      payload: p,
      source: 'websocket',
      tags: ['custom', 'my_feature'],
    });
  }
  break;
}
```

### 7.2 添加新 Payload 类型

在 `src/api/types.ts` 中定义：

```typescript
export interface MyNewEventPayload {
  id: string;
  value: number;
  description: string;
  entity_index?: number;
}
```

### 7.3 发送控制指令

```typescript
import { getWebSocket } from '../api/websocket';

// 通过 WebSocket 发送
const ws = getWebSocket();
ws?.send({
  type: 'my_command',
  sim_time: Date.now() / 1000,
  payload: { target_index: 1, action: 'do_something' },
});

// 通过 REST API 发送
import { steerSensor, fireWeapon } from '../api/controlApi';

// 传感器转向
await steerSensor(simId, {
  platform_index: 1,
  sensor_name: 'APG-68',
  azimuth: 45,
  elevation: 10,
});

// 武器发射
await fireWeapon(simId, {
  firing_platform_index: 1,
  weapon_name: 'AIM-120',
  target_platform_index: 5,
});
```

---

## 8. 事件系统

### 8.1 添加新事件分类

在 `src/store/eventStore.ts` 中扩展 `EventCategory`：

```typescript
export type EventCategory =
  | 'simulation' | 'platform' | 'weapon' | 'sensor' | 'track'
  | 'communication' | 'system' | 'environment' | 'ai'
  | 'logistics';  // 新增后勤分类
```

同时更新标签和颜色映射：

```typescript
const CATEGORY_LABELS: Record<EventCategory, string> = {
  // ... 现有标签
  logistics: '后勤',
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  // ... 现有颜色
  logistics: '#8d6e63',
};
```

在 `src/core/config/ConfigRegistry.ts` 的事件分类配置中同步更新：

```typescript
configRegistry.register({
  id: 'event.categories',
  schema: [
    { key: 'category', type: 'select', options: [
      // ... 现有选项
      { value: 'logistics', label: '后勤' },
    ]},
  ],
});
```

### 8.2 记录事件

```typescript
import { useEventStore } from '../store/eventStore';

const { addEvent } = useEventStore.getState();

// 基本事件
addEvent({
  timestamp: simTime,
  category: 'platform',
  severity: 'info',
  message: '平台加入: F-16 #01 (blue)',
  entityRefs: [{ type: 'platform', index: 1, name: 'F-16 #01' }],
  source: 'client',
  tags: ['platform_lifecycle'],
});

// 带附加数据的事件
addEvent({
  timestamp: simTime,
  category: 'weapon',
  severity: 'warning',
  message: '武器命中: AIM-120 → Su-27',
  entityRefs: [
    { type: 'weapon', index: 10, name: 'AIM-120' },
    { type: 'platform', index: 5 },
  ],
  payload: { weapon_name: 'AIM-120', damage: 0.85 },
  source: 'websocket',
  tags: ['engagement', 'weapon_hit'],
});
```

### 8.3 查询事件

```typescript
const { query } = useEventStore.getState();

// 查询所有武器事件
const weaponEvents = query({
  categories: ['weapon'],
  severities: ['warning', 'error', 'critical'],
  limit: 50,
});

// 查询特定平台相关事件
const platformEvents = query({
  entityIndex: 1,
  timeRange: [100, 200],
});

// 关键字搜索
const searchResults = query({
  searchText: '命中',
  limit: 20,
});
```

### 8.4 导出事件

```typescript
const { exportJSON, exportCSV } = useEventStore.getState();

// JSON 导出
const json = exportJSON({ categories: ['weapon'] });
downloadFile(json, 'events.json', 'application/json');

// CSV 导出
const csv = exportCSV();
downloadFile(csv, 'events.csv', 'text/csv');
```

### 8.5 使用 EventBus 发布/订阅

```typescript
import { eventBus } from '../core/data-platform/EventBus';

// 订阅
const unsubscribe = eventBus.on('my-topic', (data) => {
  console.log('收到:', data);
}, 10); // 优先级 10

// 发布
eventBus.emit('my-topic', { message: 'hello' });

// 只订阅一次
eventBus.once('one-time-event', (data) => {
  console.log('仅一次:', data);
});

// 等待事件（Promise）
const data = await eventBus.waitFor('ready-signal', 5000);

// 取消订阅
unsubscribe();
```

---

## 9. 角色配置

### 9.1 创建新角色

在 `src/config/roles/` 下创建新的角色配置文件：

```json
// src/config/roles/commander.json
{
  "role": "commander",
  "label": "指挥员",
  "description": "高级指挥角色，可控制仿真和管理想定",
  "plugins": ["sim-globe", "scenario", "equipment", "analysis"],
  "defaultPreset": "commander-tactical",
  "restrictions": {
    "canControlSimulation": true,
    "canModifyScenarios": true,
    "canAddLayers": true
  }
}
```

### 9.2 在插件系统中注册角色

在 `src/core/plugin/types.ts` 中扩展 `UserRole`：

```typescript
export type UserRole = 'admin' | 'operator' | 'analyst' | 'viewer' | 'commander';
```

### 9.3 创建角色专属图层预设

在 `src/core/layer/LayerPresets.ts` 中添加：

```typescript
const commanderPreset: LayerPreset = {
  id: 'commander-tactical',
  name: '指挥员战术',
  description: '完整战术态势 + 威胁显示',
  targetRole: 'commander',
  layers: [
    basePlatformLayer, baseTrackLayer, baseSensorBeamLayer,
    baseWeaponArcLayer, zoneLayer, routeLayer, satelliteImagery,
  ],
  tree: commanderTree, // 定义图层树
};

// 注册到预设列表
const allPresets: LayerPreset[] = [
  adminPreset, operatorPreset, analystPreset, viewerPreset,
  commanderPreset,  // 新增
];
```

### 9.4 设置角色

```typescript
import { PluginRegistry } from '../core/plugin/PluginRegistry';
import { useLayerStore } from '../store/layerStore';
import { usePluginStore } from '../store/pluginStore';

const registry = PluginRegistry.getInstance();

// 切换角色
await registry.setRole('commander');

// 加载角色对应的图层预设
useLayerStore.getState().loadForRole('commander');

// 更新插件状态
usePluginStore.getState().setRole('commander');
```

---

## 10. 常见开发模式

### 10.1 Store 模式

```typescript
import { create } from 'zustand';

interface MyState {
  data: Map<string, MyItem>;
  addItem: (item: MyItem) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
}

export const useMyStore = create<MyState>((set) => ({
  data: new Map(),

  addItem: (item) =>
    set((state) => {
      const next = new Map(state.data);
      next.set(item.id, item);
      return { data: next };
    }),

  removeItem: (id) =>
    set((state) => {
      const next = new Map(state.data);
      next.delete(id);
      return { data: next };
    }),

  clearAll: () => set({ data: new Map() }),
}));
```

### 10.2 插件模式

```typescript
import { lazy } from 'react';
import { SomeIcon } from '@ant-design/icons';
import type { PluginContribution } from '../core/plugin/types';
import { BasePlugin } from './BasePlugin';

const MyPage = lazy(() => import('../pages/MyPage'));

export class MyPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'my-plugin',
      name: '我的插件',
      version: '1.0.0',
      description: '插件描述',
      author: '作者',
      allowedRoles: ['admin', 'operator'],
      icon: 'SomeIcon',
    });
  }

  protected buildContribution(): PluginContribution {
    return {
      routes: [{ path: '/my-page', component: MyPage, requiresAuth: true }],
      navItems: [{ key: 'my-page', label: '我的页面', icon: <SomeIcon />, order: 10 }],
      sidebarPanels: [{
        id: 'my-panel',
        title: '我的面板',
        side: 'right',
        order: 5,
        component: MyPanel,
        collapsible: true,
      }],
    };
  }
}
```

### 10.3 配置驱动表单模式

```typescript
import { configRegistry } from '../core/config/ConfigRegistry';
import type { FieldConfig } from '../core/config/ConfigRegistry';

// 获取配置描述符
const descriptor = configRegistry.getRequired('equipment.aircraft');

// 遍历 schema 渲染表单
function renderForm(schema: FieldConfig[], data: any, onChange: (key: string, value: any) => void) {
  return schema
    .filter((f) => !f.hidden)
    .map((field) => {
      const value = getNestedValue(data, field.key);
      switch (field.type) {
        case 'number':
          return <InputNumber value={value} min={field.min} max={field.max} onChange={(v) => onChange(field.key, v)} />;
        case 'select':
          return <Select value={value} options={field.options} onChange={(v) => onChange(field.key, v)} />;
        case 'boolean':
          return <Switch checked={value} onChange={(v) => onChange(field.key, v)} />;
        default:
          return <Input value={value} onChange={(e) => onChange(field.key, e.target.value)} />;
      }
    });
}
```
