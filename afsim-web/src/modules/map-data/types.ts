/**
 * 地图数据管理模块 - 类型定义
 * 管理底图源、地形数据、矢量图层
 */

import type { LngLatBounds } from '../../core/types/common';
import type { UnifiedLayerStyle, LayerTreeNode as CoreLayerTreeNode, LayerGroupType } from '../../core/layer/types';

// ============ 地图数据源基础类型 ============

/** @deprecated Use LngLatBounds from core/types/common */
export type MapBounds = LngLatBounds;

export interface MapDataSourceMetadata {
  resolution?: number;    // 分辨率（米/像素）
  tileSize?: number;      // 瓦片大小
  srs?: string;           // 空间参考系，如 EPSG:4326
  format?: string;        // 数据格式描述
  fileSize?: number;      // 文件大小（字节）
  compression?: string;   // 压缩方式
}

export type DataSourceType = 'imagery' | 'terrain' | 'vector' | 'geojson' | 'wms';
export type DataSourceStatus = 'uploading' | 'processing' | 'ready' | 'error';

export interface MapDataSource {
  id: string;
  name: string;
  type: DataSourceType;
  url?: string;
  file?: File;
  format?: string;
  bounds?: MapBounds;
  metadata: MapDataSourceMetadata;
  status: DataSourceStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============ 地形数据 ============

export interface TerrainData extends MapDataSource {
  type: 'terrain';
  elevationRange: { min: number; max: number };
  sampleCount: number;
  meshType?: 'quantized-mesh' | 'terrarium' | 'custom';
}

// ============ 矢量图层 ============

export type GeometryType = 'point' | 'line' | 'polygon' | 'mixed';

/** @deprecated Use UnifiedLayerStyle from core/layer/types */
export type LayerStyle = UnifiedLayerStyle;

export interface VectorLayer extends MapDataSource {
  type: 'vector';
  featureCount: number;
  geometryType: GeometryType;
  style: LayerStyle;
  fields?: string[];  // 属性字段列表
}

// ============ 底图源 ============

export type ImagerySourceType = 'osm' | 'satellite' | 'dark' | 'terrain' | 'custom';

export interface ImageryPreset {
  id: string;
  name: string;
  type: ImagerySourceType;
  thumbnail: string;
  url?: string;
  attribution?: string;
  available: boolean;
}

// ============ 图层树节点 ============

export type LayerGroup = 'basemap' | 'terrain' | 'vector' | 'overlay';

export interface MapDataLayerTreeNode {
  key: string;
  title: string;
  group: LayerGroup;
  dataSourceId?: string;
  children?: MapDataLayerTreeNode[];
  visible: boolean;
  opacity: number;
  locked?: boolean;
}

/** @deprecated Use MapDataLayerTreeNode */
export type LayerTreeNode = MapDataLayerTreeNode;

// ============ 地形分析 ============

export interface LOSRequest {
  from: { lng: number; lat: number; alt: number };
  to: { lng: number; lat: number; alt: number };
}

export interface LOSResponse {
  hasLOS: boolean;
  obstructionPoint?: { lng: number; lat: number; alt: number };
  obstructionDistance?: number;
  profile: Array<{ distance: number; terrainHeight: number; losHeight: number }>;
}

export interface TerrainProfileRequest {
  points: Array<{ lng: number; lat: number }>;
  sampleCount?: number;
}

export interface TerrainProfilePoint {
  distance: number;
  lng: number;
  lat: number;
  altitude: number;
}

export interface CoverageAnalysisRequest {
  center: { lng: number; lat: number };
  radius: number;       // 米
  altitude: number;     // 米
  resolution?: number;  // 网格分辨率
}

export interface CoverageAnalysisResult {
  visiblePoints: Array<{ lng: number; lat: number; visible: boolean }>;
  coveragePercent: number;
  bounds: MapBounds;
}

// ============ 上传配置 ============

export interface UploadConfig {
  maxSize: number;          // 最大文件大小（字节）
  acceptedFormats: string[]; // 接受的文件格式
  chunkSize?: number;       // 分片大小
}

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  maxSize: 500 * 1024 * 1024, // 500MB
  acceptedFormats: ['.tif', '.tiff', '.dt1', '.dt2', '.shp', '.geojson', '.json', '.kml', '.kmz'],
};
