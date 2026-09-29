/**
 * 地图数据管理模块入口
 *
 * 功能：
 * - 底图源管理（OSM、卫星、暗色、地形）
 * - 地形数据管理（全球/局部高精度地形）
 * - 矢量图层管理（GeoJSON、Shapefile、WMS）
 * - 图层树（分组、可见性、透明度、排序）
 * - 样式编辑器（填充、描边、标签）
 * - 地形分析（视线、剖面、覆盖范围）
 */

// 类型导出
export type {
  MapDataSource,
  MapBounds,
  MapDataSourceMetadata,
  DataSourceType,
  DataSourceStatus,
  TerrainData,
  VectorLayer,
  GeometryType,
  LayerStyle,
  ImageryPreset,
  ImagerySourceType,
  LayerGroup,
  LayerTreeNode,
  LOSRequest,
  LOSResponse,
  TerrainProfileRequest,
  TerrainProfilePoint,
  CoverageAnalysisRequest,
  CoverageAnalysisResult,
  UploadConfig,
} from './types';

export { DEFAULT_UPLOAD_CONFIG } from './types';

// 环境数据类型导出
export type {
  WeatherData,
  SeaStateData,
  TideData,
  AtmosphericData,
  EnvironmentDataSource,
  EnvironmentDataType,
  EnvironmentQuery,
  TidePrediction,
  CloudLayer,
  WindUnit,
  PrecipitationType,
  SeaStateGrade,
  TideTrend,
  TideDatum,
  TurbulenceLevel,
  IcingCondition,
  IceCondition,
} from './types/environment';

// Store 导出
export { useMapDataStore } from './store/mapDataStore';

// 组件导出
export { default as MapLayerPanel } from './components/MapLayerPanel';
export { default as DataSourceManager } from './components/DataSourceManager';
export { default as LayerStyleEditor } from './components/LayerStyleEditor';
export { default as TerrainAnalysis } from './components/TerrainAnalysis';
export { default as ImagerySelector } from './components/ImagerySelector';
export { default as EnvironmentPanel } from './components/EnvironmentPanel';
