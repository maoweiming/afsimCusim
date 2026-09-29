/**
 * 地图数据模块 - Mock 数据
 * 包含全球底图、台湾地形、矢量图层等
 */
import type { MapDataSource, ImageryPreset, LayerTreeNode, TerrainData, VectorLayer } from '../types';

// ============ Mock 数据源 ============

export const MOCK_DATA_SOURCES: MapDataSource[] = [
  // 底图源
  {
    id: 'ds-osm',
    name: 'OpenStreetMap',
    type: 'imagery',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    format: 'png',
    bounds: { south: -85, west: -180, north: 85, east: 180 },
    metadata: { tileSize: 256, srs: 'EPSG:3857' },
    status: 'ready',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'ds-satellite',
    name: '全球卫星影像',
    type: 'imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    format: 'jpeg',
    bounds: { south: -85, west: -180, north: 85, east: 180 },
    metadata: { resolution: 15, tileSize: 256, srs: 'EPSG:3857' },
    status: 'ready',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'ds-dark',
    name: '暗色底图',
    type: 'imagery',
    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    format: 'png',
    bounds: { south: -85, west: -180, north: 85, east: 180 },
    metadata: { tileSize: 256, srs: 'EPSG:3857' },
    status: 'ready',
    createdAt: '2026-02-01T10:00:00Z',
  },
  // 地形数据
  {
    id: 'ds-terrain-world',
    name: '全球地形',
    type: 'terrain',
    url: 'https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles',
    format: 'quantized-mesh',
    bounds: { south: -85, west: -180, north: 85, east: 180 },
    metadata: { resolution: 30, srs: 'EPSG:4326', format: 'quantized-mesh' },
    status: 'ready',
    createdAt: '2026-01-15T08:00:00Z',
  } as TerrainData & MapDataSource,
  {
    id: 'ds-terrain-taiwan',
    name: '台湾高精度地形',
    type: 'terrain',
    format: 'dt2',
    bounds: { south: 21.8, west: 119.3, north: 25.4, east: 122.1 },
    metadata: { resolution: 5, srs: 'EPSG:4326', fileSize: 256 * 1024 * 1024 },
    status: 'ready',
    createdAt: '2026-03-10T14:30:00Z',
  } as TerrainData & MapDataSource,
  {
    id: 'ds-terrain-scs',
    name: '南海岛礁地形',
    type: 'terrain',
    format: 'dt1',
    bounds: { south: 3.5, west: 105.0, north: 21.0, east: 121.0 },
    metadata: { resolution: 10, srs: 'EPSG:4326', fileSize: 128 * 1024 * 1024 },
    status: 'processing',
    createdAt: '2026-04-05T09:15:00Z',
  } as TerrainData & MapDataSource,
  // 矢量图层
  {
    id: 'ds-boundary-cn',
    name: '中国国界',
    type: 'vector',
    format: 'geojson',
    metadata: { srs: 'EPSG:4326' },
    status: 'ready',
    createdAt: '2026-02-20T11:00:00Z',
    featureCount: 1,
    geometryType: 'polygon',
    style: {
      fillColor: 'transparent',
      fillOpacity: 0,
      strokeColor: '#ff4d4f',
      strokeWidth: 2,
    },
    fields: ['name', 'iso_code', 'area_km2'],
  } as unknown as VectorLayer & MapDataSource,
  {
    id: 'ds-runways',
    name: '军用机场跑道',
    type: 'vector',
    format: 'geojson',
    metadata: { srs: 'EPSG:4326' },
    status: 'ready',
    createdAt: '2026-03-15T16:00:00Z',
    featureCount: 42,
    geometryType: 'line',
    style: {
      strokeColor: '#52c41a',
      strokeWidth: 3,
    },
    fields: ['name', 'icao', 'runway_length', 'runway_heading', 'elevation'],
  } as unknown as VectorLayer & MapDataSource,
  {
    id: 'ds-threat-zones',
    name: '威胁区域',
    type: 'geojson',
    format: 'geojson',
    metadata: { srs: 'EPSG:4326' },
    status: 'ready',
    createdAt: '2026-04-01T08:30:00Z',
    featureCount: 8,
    geometryType: 'polygon',
    style: {
      fillColor: '#ff4d4f',
      fillOpacity: 0.25,
      strokeColor: '#ff4d4f',
      strokeWidth: 1.5,
    },
    fields: ['name', 'threat_type', 'range_km', 'system_name'],
  } as unknown as VectorLayer & MapDataSource,
  {
    id: 'ds-missile-sites',
    name: '导弹阵地',
    type: 'vector',
    format: 'geojson',
    metadata: { srs: 'EPSG:4326' },
    status: 'error',
    errorMessage: '数据格式校验失败：缺少 geometry 字段',
    createdAt: '2026-04-10T12:00:00Z',
    featureCount: 0,
    geometryType: 'point',
    style: {
      fillColor: '#faad14',
      pointRadius: 8,
      strokeColor: '#fff',
      strokeWidth: 2,
    },
    fields: ['name', 'system_type', 'status'],
  } as unknown as VectorLayer & MapDataSource,
  // WMS 源
  {
    id: 'ds-wms-maritime',
    name: '海事图 WMS',
    type: 'wms',
    url: 'https://wms.maritime.gov/wms',
    format: 'wms',
    bounds: { south: 5, west: 100, north: 30, east: 130 },
    metadata: { srs: 'EPSG:4326', tileSize: 512 },
    status: 'ready',
    createdAt: '2026-02-28T09:00:00Z',
  },
];

// ============ 底图预设 ============

export const MOCK_IMAGERY_PRESETS: ImageryPreset[] = [
  {
    id: 'preset-osm',
    name: 'OpenStreetMap',
    type: 'osm',
    thumbnail: '/thumbnails/osm.png',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    available: true,
  },
  {
    id: 'preset-satellite',
    name: '卫星影像',
    type: 'satellite',
    thumbnail: '/thumbnails/satellite.png',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    available: true,
  },
  {
    id: 'preset-dark',
    name: '暗色底图',
    type: 'dark',
    thumbnail: '/thumbnails/dark.png',
    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; CartoDB',
    available: true,
  },
  {
    id: 'preset-terrain',
    name: '地形底图',
    type: 'terrain',
    thumbnail: '/thumbnails/terrain.png',
    url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
    attribution: '&copy; Stamen Design',
    available: true,
  },
];

// ============ 图层树 ============

export const MOCK_LAYER_TREE: LayerTreeNode[] = [
  {
    key: 'group-basemap',
    title: '底图',
    group: 'basemap',
    visible: true,
    opacity: 1,
    locked: true,
    children: [
      { key: 'ds-osm', title: 'OpenStreetMap', group: 'basemap', dataSourceId: 'ds-osm', visible: false, opacity: 1 },
      { key: 'ds-satellite', title: '卫星影像', group: 'basemap', dataSourceId: 'ds-satellite', visible: true, opacity: 1 },
      { key: 'ds-dark', title: '暗色底图', group: 'basemap', dataSourceId: 'ds-dark', visible: false, opacity: 1 },
    ],
  },
  {
    key: 'group-terrain',
    title: '地形',
    group: 'terrain',
    visible: true,
    opacity: 1,
    children: [
      { key: 'ds-terrain-world', title: '全球地形', group: 'terrain', dataSourceId: 'ds-terrain-world', visible: true, opacity: 1 },
      { key: 'ds-terrain-taiwan', title: '台湾高精度地形', group: 'terrain', dataSourceId: 'ds-terrain-taiwan', visible: false, opacity: 1 },
      { key: 'ds-terrain-scs', title: '南海岛礁地形', group: 'terrain', dataSourceId: 'ds-terrain-scs', visible: false, opacity: 0.8 },
    ],
  },
  {
    key: 'group-vector',
    title: '矢量图层',
    group: 'vector',
    visible: true,
    opacity: 1,
    children: [
      { key: 'ds-boundary-cn', title: '中国国界', group: 'vector', dataSourceId: 'ds-boundary-cn', visible: true, opacity: 1 },
      { key: 'ds-runways', title: '军用机场跑道', group: 'vector', dataSourceId: 'ds-runways', visible: true, opacity: 1 },
      { key: 'ds-threat-zones', title: '威胁区域', group: 'vector', dataSourceId: 'ds-threat-zones', visible: true, opacity: 0.7 },
      { key: 'ds-missile-sites', title: '导弹阵地', group: 'vector', dataSourceId: 'ds-missile-sites', visible: false, opacity: 1 },
    ],
  },
  {
    key: 'group-overlay',
    title: '叠加层',
    group: 'overlay',
    visible: true,
    opacity: 1,
    children: [
      { key: 'ds-wms-maritime', title: '海事图 WMS', group: 'overlay', dataSourceId: 'ds-wms-maritime', visible: false, opacity: 0.6 },
    ],
  },
];
