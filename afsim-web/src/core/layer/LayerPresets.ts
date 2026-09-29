/**
 * LayerPresets - 内置图层预设
 * 定义每种角色默认可见的图层组合
 */
import type { LayerPreset, LayerDefinition, LayerTreeNode, LayerGroupType } from './types';

// ============ 内置图层定义 ============

const basePlatformLayer: LayerDefinition = {
  id: 'layer-platforms',
  name: '平台',
  type: 'platform',
  renderingMode: 'direct',
  style: { pointColor: '#00ff88', pointSize: 8, showLabel: true, labelSize: 12 },
  tags: ['simulation', 'core'],
};

const baseTrackLayer: LayerDefinition = {
  id: 'layer-tracks',
  name: '航迹',
  type: 'track',
  renderingMode: 'direct',
  style: { lineColor: '#00bfff', lineWidth: 2, lineGlow: true, lineGlowColor: '#00bfff', lineGlowPower: 3 },
  tags: ['simulation', 'core'],
};

const baseSensorBeamLayer: LayerDefinition = {
  id: 'layer-sensor-beams',
  name: '传感器波束',
  type: 'sensor_beam',
  renderingMode: 'direct',
  style: { beamAlpha: 0.3, beamDashLength: 10, lineColor: '#ffff00' },
  tags: ['simulation', 'sensor'],
};

const baseWeaponArcLayer: LayerDefinition = {
  id: 'layer-weapon-arcs',
  name: '武器射界',
  type: 'weapon_arc',
  renderingMode: 'direct',
  style: { fillColor: '#ff4444', fillOpacity: 0.2, strokeColor: '#ff4444', strokeWidth: 1 },
  tags: ['simulation', 'weapon'],
};

const satelliteImagery: LayerDefinition = {
  id: 'layer-satellite',
  name: '卫星底图',
  type: 'imagery',
  renderingMode: 'engine',
  source: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  style: {},
  tags: ['basemap'],
};

const openStreetMap: LayerDefinition = {
  id: 'layer-osm',
  name: 'OpenStreetMap',
  type: 'tile',
  renderingMode: 'engine',
  source: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  style: {},
  tags: ['basemap'],
};

const zoneLayer: LayerDefinition = {
  id: 'layer-zones',
  name: '作战区域',
  type: 'zone',
  renderingMode: 'engine',
  style: { fillColor: '#ff8800', fillOpacity: 0.15, strokeColor: '#ff8800', strokeWidth: 2, strokeDash: [5, 5] },
  tags: ['simulation', 'tactical'],
};

const routeLayer: LayerDefinition = {
  id: 'layer-routes',
  name: '航线',
  type: 'route',
  renderingMode: 'engine',
  style: { lineColor: '#00ff00', lineWidth: 3, lineDash: [10, 5] },
  tags: ['simulation', 'navigation'],
};

// ============ 图层树 ============

interface TreeNodeInput {
  key?: string;
  title: string;
  group: LayerGroupType;
  layerId?: string;
  children?: TreeNodeInput[];
  visible?: boolean;
  opacity?: number;
  zIndex?: number;
  locked?: boolean;
  icon?: string;
}

function makeTree(nodes: TreeNodeInput[]): LayerTreeNode[] {
  return nodes.map((n, i) => ({
    key: n.key ?? n.layerId ?? `node-${i}`,
    title: n.title ?? '',
    group: n.group ?? 'simulation',
    layerId: n.layerId,
    children: n.children ? makeTree(n.children) : undefined,
    visible: n.visible ?? true,
    opacity: n.opacity ?? 1,
    zIndex: n.zIndex ?? i,
    locked: n.locked,
    icon: n.icon,
  }));
}

const adminTree: LayerTreeNode[] = makeTree([
  { key: 'group-sim', title: '仿真态势', group: 'simulation', children: [
    { key: 'platforms', title: '平台', group: 'simulation', layerId: 'layer-platforms', icon: 'EnvironmentOutlined' },
    { key: 'tracks', title: '航迹', group: 'simulation', layerId: 'layer-tracks', icon: 'BranchesOutlined' },
    { key: 'sensors', title: '传感器', group: 'simulation', layerId: 'layer-sensor-beams', icon: 'WifiOutlined' },
    { key: 'weapons', title: '武器', group: 'simulation', layerId: 'layer-weapon-arcs', icon: 'AimOutlined' },
    { key: 'zones', title: '区域', group: 'simulation', layerId: 'layer-zones', icon: 'BorderOutlined' },
    { key: 'routes', title: '航线', group: 'simulation', layerId: 'layer-routes', icon: 'SendOutlined' },
  ]},
  { key: 'group-basemap', title: '底图', group: 'basemap', children: [
    { key: 'satellite', title: '卫星', group: 'basemap', layerId: 'layer-satellite', icon: 'GlobalOutlined' },
    { key: 'osm', title: 'OSM', group: 'basemap', layerId: 'layer-osm', icon: 'HeatMapOutlined' },
  ]},
]);

const operatorTree: LayerTreeNode[] = makeTree([
  { key: 'group-sim', title: '仿真态势', group: 'simulation', children: [
    { key: 'platforms', title: '平台', group: 'simulation', layerId: 'layer-platforms' },
    { key: 'tracks', title: '航迹', group: 'simulation', layerId: 'layer-tracks' },
    { key: 'sensors', title: '传感器', group: 'simulation', layerId: 'layer-sensor-beams' },
    { key: 'weapons', title: '武器', group: 'simulation', layerId: 'layer-weapon-arcs' },
    { key: 'zones', title: '区域', group: 'simulation', layerId: 'layer-zones' },
    { key: 'routes', title: '航线', group: 'simulation', layerId: 'layer-routes' },
  ]},
  { key: 'group-basemap', title: '底图', group: 'basemap', layerId: 'layer-satellite', locked: true },
]);

const analystTree: LayerTreeNode[] = makeTree([
  { key: 'group-sim', title: '仿真态势', group: 'simulation', children: [
    { key: 'platforms', title: '平台', group: 'simulation', layerId: 'layer-platforms' },
    { key: 'tracks', title: '航迹', group: 'simulation', layerId: 'layer-tracks' },
    { key: 'sensors', title: '传感器', group: 'simulation', layerId: 'layer-sensor-beams' },
  ]},
  { key: 'group-basemap', title: '底图', group: 'basemap', layerId: 'layer-satellite' },
]);

const viewerTree: LayerTreeNode[] = makeTree([
  { key: 'group-sim', title: '态势总览', group: 'simulation', children: [
    { key: 'platforms', title: '平台', group: 'simulation', layerId: 'layer-platforms' },
    { key: 'tracks', title: '航迹', group: 'simulation', layerId: 'layer-tracks' },
  ]},
  { key: 'group-basemap', title: '底图', group: 'basemap', layerId: 'layer-satellite', locked: true },
]);

// ============ 预设定义 ============

const adminPreset: LayerPreset = {
  id: 'admin-full',
  name: '管理员全景',
  description: '全部图层 + 全部底图，完全控制',
  targetRole: 'admin',
  layers: [
    basePlatformLayer, baseTrackLayer, baseSensorBeamLayer, baseWeaponArcLayer,
    zoneLayer, routeLayer, satelliteImagery, openStreetMap,
  ],
  tree: adminTree,
};

const operatorPreset: LayerPreset = {
  id: 'operator-standard',
  name: '操作员标准',
  description: '仿真图层 + 卫星底图',
  targetRole: 'operator',
  layers: [
    basePlatformLayer, baseTrackLayer, baseSensorBeamLayer, baseWeaponArcLayer,
    zoneLayer, routeLayer, satelliteImagery,
  ],
  tree: operatorTree,
};

const analystPreset: LayerPreset = {
  id: 'analyst-analysis',
  name: '分析师专用',
  description: '核心仿真图层 + 分析工具',
  targetRole: 'analyst',
  layers: [
    basePlatformLayer, baseTrackLayer, baseSensorBeamLayer, satelliteImagery,
  ],
  tree: analystTree,
};

const viewerPreset: LayerPreset = {
  id: 'viewer-minimal',
  name: '观察员最小化',
  description: '平台 + 航迹 + 卫星底图',
  targetRole: 'viewer',
  layers: [
    basePlatformLayer, baseTrackLayer, satelliteImagery,
  ],
  tree: viewerTree,
};

// ============ 预设注册表 ============

const allPresets: LayerPreset[] = [adminPreset, operatorPreset, analystPreset, viewerPreset];
const presetMap = new Map(allPresets.map((p) => [p.id, p]));

export const LayerPresets = {
  getById(id: string): LayerPreset | undefined {
    return presetMap.get(id);
  },

  forRole(role: string): LayerPreset {
    const preset = allPresets.find((p) => p.targetRole === role);
    return preset ?? viewerPreset;
  },

  getAll(): LayerPreset[] {
    return [...allPresets];
  },
};
