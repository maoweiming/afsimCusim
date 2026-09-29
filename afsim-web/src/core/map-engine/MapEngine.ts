/**
 * 地图引擎抽象层 - 统一接口定义
 * 支持 CesiumJS (3D), Leaflet (2D), MapboxGL, OpenLayers
 */

// ============ 基础类型 (权威定义在 core/types/common.ts) ============

import type { LngLat, LngLatAlt, LngLatBounds } from '../types/common';
import type { UnifiedLayerStyle } from '../layer/types';

export type { LngLat, LngLatAlt, LngLatBounds };
/** @deprecated Use UnifiedLayerStyle from core/layer/types */
export type LayerStyle = UnifiedLayerStyle;

export interface MapOptions {
  center?: LngLat;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  terrain?: boolean;
  imagery?: string; // 底图源标识
}

export interface FlyOptions {
  duration?: number; // 秒
  heading?: number;
  pitch?: number;
  roll?: number;
}

export type MapEngineType = 'cesium' | 'leaflet' | 'mapboxgl' | 'openlayers';
export type MapDimension = '2d' | '3d';

export interface MapEngineDescriptor {
  id: MapEngineType;
  name: string;
  dimension: MapDimension;
  icon: string; // Ant Design icon name
  available: boolean;
}

// ============ 图层类型 ============

export type LayerType = 'imagery' | 'terrain' | 'vector' | 'geojson' | 'wms' | 'wmts' | 'tile';

export interface MapLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number; // 0-1
  source: LayerSource;
  style?: LayerStyle;
}

export interface LayerSource {
  url?: string;
  file?: File;
  data?: any; // GeoJSON 等内联数据
  format?: string;
  layers?: string; // WMS 图层名
  parameters?: Record<string, string>;
}

// ============ 实体类型 ============

export type EntityType = 'point' | 'polyline' | 'polygon' | 'model' | 'label' | 'billboard';

export interface MapEntity {
  id: string;
  type: EntityType;
  position?: LngLatAlt;
  positions?: LngLatAlt[]; // polyline/polygon
  heading?: number;
  pitch?: number;
  roll?: number;
  style?: EntityStyle;
  properties?: Record<string, any>;
  label?: string;
  visible?: boolean;
}

export interface EntityStyle {
  // Point
  pointColor?: string;
  pointSize?: number;
  pointOutline?: boolean;
  pointOutlineColor?: string;
  pointOutlineWidth?: number;
  iconUrl?: string;
  iconScale?: number;
  iconRotation?: number;

  // Polyline
  lineColor?: string;
  lineWidth?: number;
  lineDash?: number[];
  lineGlow?: boolean;
  lineGlowColor?: string;
  lineGlowWidth?: number;

  // Polygon
  fillColor?: string;
  fillOpacity?: number;
  outlineColor?: string;
  outlineWidth?: number;

  // Label
  labelText?: string;
  labelFont?: string;
  labelSize?: number;
  labelColor?: string;
  labelBackground?: string;
  labelOffset?: [number, number];

  // 3D Model
  modelUrl?: string;
  modelScale?: number;
  modelMinimumPixelSize?: number;
}

// ============ 事件类型 ============

export interface MapClickEvent {
  lngLat: LngLatAlt;
  entity?: MapEntity;
  layerId?: string;
  screenPosition?: { x: number; y: number };
}

export interface MapHoverEvent {
  lngLat: LngLatAlt;
  entity?: MapEntity;
  layerId?: string;
}

export interface DrawEvent {
  type: 'point' | 'polyline' | 'polygon' | 'circle' | 'rectangle';
  positions: LngLatAlt[];
  properties?: Record<string, any>;
}

export interface ViewChangeEvent {
  center: LngLat;
  zoom: number;
  bounds: LngLatBounds;
  heading?: number;
  pitch?: number;
}

// ============ 分析结果 ============

export interface LOSResult {
  hasLOS: boolean;
  obstructionPoint?: LngLatAlt;
  obstructionDistance?: number;
  profile: Array<{ distance: number; terrainHeight: number; losHeight: number }>;
}

export interface ViewshedResult {
  visible: boolean[][]; // 网格可见性
  bounds: LngLatBounds;
  resolution: number; // 网格分辨率 (米)
  center: LngLat;
  radius: number;
}

// ============ 高程数据源 ============

export interface TerrainSource {
  id: string;
  name: string;
  type: 'cesium-ion' | 'quantized-mesh' | 'terrarium' | 'custom';
  url?: string;
  assetId?: number; // Cesium Ion asset ID
  available: boolean;
}

// ============ 底图源 ============

export interface ImagerySource {
  id: string;
  name: string;
  type: 'cesium-ion' | 'openstreetmap' | 'wmts' | 'wms' | 'tile' | 'custom';
  url?: string;
  assetId?: number;
  icon?: string;
  thumbnail?: string;
  available: boolean;
  layers?: string;
  parameters?: Record<string, string>;
}

// ============ 核心引擎接口 ============

export interface MapEngine {
  // 引擎信息
  readonly type: MapEngineType;
  readonly dimension: MapDimension;

  // 生命周期
  initialize(container: HTMLElement, options?: MapOptions): Promise<void>;
  destroy(): void;
  isReady(): boolean;

  // 地图操作
  setView(center: LngLat, zoom: number): void;
  flyTo(center: LngLat, zoom?: number, options?: FlyOptions): void;
  fitBounds(bounds: LngLatBounds, padding?: number): void;
  getCenter(): LngLat;
  getZoom(): number;
  getBounds(): LngLatBounds;

  // 底图和地形
  setImagerySource(source: ImagerySource): void;
  setTerrainSource(source: TerrainSource): void;
  getImagerySources(): ImagerySource[];
  getTerrainSources(): TerrainSource[];

  // 图层管理
  addLayer(layer: MapLayer): string;
  removeLayer(layerId: string): void;
  updateLayer(layerId: string, updates: Partial<MapLayer>): void;
  setLayerVisibility(layerId: string, visible: boolean): void;
  setLayerOpacity(layerId: string, opacity: number): void;
  getLayers(): MapLayer[];
  reorderLayers(layerIds: string[]): void;

  // 实体管理
  addEntity(entity: MapEntity): string;
  removeEntity(entityId: string): void;
  updateEntity(entityId: string, updates: Partial<MapEntity>): void;
  setEntityVisibility(entityId: string, visible: boolean): void;
  getEntity(entityId: string): MapEntity | undefined;
  getEntities(): MapEntity[];
  clearEntities(): void;

  // 选择和高亮
  selectEntity(entityId: string): void;
  deselectEntity(entityId: string): void;
  deselectAll(): void;
  getSelectedEntities(): MapEntity[];
  highlightEntity(entityId: string, color?: string): void;
  unhighlightEntity(entityId: string): void;

  // 相机控制
  flyToEntity(entityId: string, options?: FlyOptions): void;
  trackEntity(entityId: string): void;
  untrackEntity(): void;

  // 事件监听
  onClick(callback: (event: MapClickEvent) => void): () => void;
  onDoubleClick(callback: (event: MapClickEvent) => void): () => void;
  onRightClick(callback: (event: MapClickEvent) => void): () => void;
  onHover(callback: (event: MapHoverEvent) => void): () => void;
  onViewChange(callback: (event: ViewChangeEvent) => void): () => void;
  onDraw(callback: (event: DrawEvent) => void): () => void;

  // 绘图工具
  startDraw(type: DrawEvent['type']): void;
  cancelDraw(): void;

  // 地形分析
  getTerrainHeight(lng: number, lat: number): Promise<number>;
  computeLineOfSight(from: LngLatAlt, to: LngLatAlt): Promise<LOSResult>;
  computeViewshed(center: LngLatAlt, radius: number, resolution?: number): Promise<ViewshedResult>;
  getTerrainProfile(positions: LngLat[]): Promise<Array<{ lng: number; lat: number; altitude: number }>>;

  // 坐标转换
  lngLatToScreen(lngLat: LngLat): { x: number; y: number } | null;
  screenToLngLat(screen: { x: number; y: number }): LngLatAlt | null;

  // 截图
  captureImage(options?: { width?: number; height?: number; format?: 'png' | 'jpeg' }): Promise<Blob>;

  // 坐标系转换工具
  metersToDegrees(meters: number, atLatitude: number): { lng: number; lat: number };
  degreesToMeters(lngDelta: number, latDelta: number, atLatitude: number): { east: number; north: number };

  // 获取底层引擎实例（用于特殊需求）
  getNativeEngine(): any;
}
