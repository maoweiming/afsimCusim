/**
 * 统一图层配置类型定义
 * 支持 CesiumJS direct 模式和 MapEngine engine 模式
 */

// ============ 图层类型 ============

export type UnifiedLayerType =
  | 'platform'
  | 'track'
  | 'sensor_beam'
  | 'weapon_arc'
  | 'zone'
  | 'route'
  | 'geojson'
  | 'tile'
  | 'wms'
  | 'wmts'
  | 'imagery'
  | 'terrain';

export type LayerRenderingMode = 'direct' | 'engine';

// ============ 图层样式 ============

export interface UnifiedLayerStyle {
  // Point/Platform
  pointColor?: string;
  pointSize?: number;
  pointRadius?: number;      // alias for pointSize (backward compat)
  pointOutline?: boolean;
  pointOutlineColor?: string;
  pointOutlineWidth?: number;
  iconUrl?: string;
  pointIcon?: string;        // alias for iconUrl (backward compat)
  iconScale?: number;
  iconRotation?: number;

  // Line/Polyline
  lineColor?: string;
  lineWidth?: number;
  lineDash?: number[];
  lineGlow?: boolean;
  lineGlowColor?: string;
  lineGlowPower?: number;

  // Polygon/Fill
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeDash?: number[];

  // Label
  labelField?: string;
  labelFont?: string;
  labelSize?: number;
  labelColor?: string;
  showLabel?: boolean;

  // Beam-specific
  beamAlpha?: number;
  beamDashLength?: number;

  // 3D Model
  modelUrl?: string;
  modelScale?: number;
}

// ============ 数据源 ============

export interface LayerDataSource {
  url?: string;
  data?: unknown;
  layers?: string;
  parameters?: Record<string, string>;
  format?: string;
}

// ============ 图层定义 ============

export interface LayerDefinition {
  id: string;
  name: string;
  type: UnifiedLayerType;
  renderingMode: LayerRenderingMode;
  source?: LayerDataSource;
  style: UnifiedLayerStyle;
  dataStoreRef?: string;
  metadata?: {
    description?: string;
    attribution?: string;
    bounds?: { south: number; west: number; north: number; east: number };
  };
  tags?: string[];
}

// ============ 图层树 ============

export type LayerGroupType = 'simulation' | 'scenario' | 'geospatial' | 'basemap' | 'custom';

export interface LayerTreeNode {
  key: string;
  title: string;
  group: LayerGroupType;
  layerId?: string;
  children?: LayerTreeNode[];
  visible: boolean;
  opacity: number;
  zIndex: number;
  locked?: boolean;
  icon?: string;
}

// ============ 图层预设 ============

export interface LayerPreset {
  id: string;
  name: string;
  description: string;
  targetRole: string | null;
  layers: LayerDefinition[];
  tree: LayerTreeNode[];
}

// ============ 序列化 ============

export interface SerializedLayerConfig {
  version: number;
  presetId: string;
  customLayers: LayerDefinition[];
  treeOverrides: Record<string, { visible?: boolean; opacity?: number; zIndex?: number }>;
  savedAt: string;
}
