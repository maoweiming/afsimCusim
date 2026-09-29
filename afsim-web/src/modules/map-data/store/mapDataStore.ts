import { create } from 'zustand';
import * as Cesium from 'cesium';
import type {
  MapDataSource,
  LayerTreeNode,
  TerrainData,
  VectorLayer,
  ImageryPreset,
  ImagerySourceType,
  LayerStyle,
  LOSRequest,
  LOSResponse,
  TerrainProfileRequest,
  TerrainProfilePoint,
  CoverageAnalysisRequest,
  CoverageAnalysisResult,
} from '../types';
import type { MapEngine, ImagerySource } from '../../../core/map-engine/MapEngine';
import { MOCK_DATA_SOURCES, MOCK_IMAGERY_PRESETS, MOCK_LAYER_TREE } from './mockData';

// ============ State 接口 ============

interface MapDataState {
  // 数据源
  dataSources: MapDataSource[];
  activeLayers: string[];        // 当前激活的图层 ID
  layerTree: LayerTreeNode[];    // 图层树
  terrainEnabled: boolean;
  currentImagery: ImagerySourceType;

  // 状态
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;

  // 底图预设
  imageryPresets: ImageryPreset[];

  // 地形分析结果
  losResult: LOSResponse | null;
  terrainProfile: TerrainProfilePoint[] | null;
  coverageResult: CoverageAnalysisResult | null;
  analyzing: boolean;

  // 数据源操作
  addDataSource: (source: MapDataSource) => void;
  removeDataSource: (id: string) => void;
  updateDataSource: (id: string, updates: Partial<MapDataSource>) => void;
  getDataSource: (id: string) => MapDataSource | undefined;

  // 图层操作
  toggleLayer: (id: string) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  setActiveLayers: (ids: string[]) => void;

  // 图层树操作
  updateTreeNode: (key: string, updates: Partial<LayerTreeNode>) => void;

  // 底图操作
  setImagery: (type: ImagerySourceType) => void;

  // 地图引擎引用
  activeEngine: MapEngine | null;
  setActiveEngine: (engine: MapEngine | null) => void;

  // 地形操作
  setTerrainEnabled: (enabled: boolean) => void;

  // 样式操作
  updateLayerStyle: (dataSourceId: string, style: Partial<LayerStyle>) => void;

  // 上传状态
  setUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;

  // 地形分析
  computeLOS: (request: LOSRequest) => Promise<void>;
  getTerrainProfile: (request: TerrainProfileRequest) => Promise<void>;
  computeCoverage: (request: CoverageAnalysisRequest) => Promise<void>;
  clearAnalysisResults: () => void;

  // 错误处理
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// ============ Store ============

export const useMapDataStore = create<MapDataState>((set, get) => ({
  // 初始状态
  dataSources: MOCK_DATA_SOURCES,
  activeLayers: ['ds-osm', 'ds-satellite', 'ds-terrain-world'],
  layerTree: MOCK_LAYER_TREE,
  terrainEnabled: true,
  currentImagery: 'satellite',
  loading: false,
  uploading: false,
  uploadProgress: 0,
  error: null,
  imageryPresets: MOCK_IMAGERY_PRESETS,
  losResult: null,
  terrainProfile: null,
  coverageResult: null,
  analyzing: false,

  activeEngine: null,

  // 数据源操作
  addDataSource: (source) =>
    set((state) => ({ dataSources: [...state.dataSources, source] })),

  removeDataSource: (id) =>
    set((state) => ({
      dataSources: state.dataSources.filter((s) => s.id !== id),
      activeLayers: state.activeLayers.filter((l) => l !== id),
    })),

  updateDataSource: (id, updates) =>
    set((state) => ({
      dataSources: state.dataSources.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  getDataSource: (id) => get().dataSources.find((s) => s.id === id),

  // 图层操作
  toggleLayer: (id) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(id)
        ? state.activeLayers.filter((l) => l !== id)
        : [...state.activeLayers, id],
    })),

  setLayerVisibility: (id, visible) =>
    set((state) => ({
      activeLayers: visible
        ? [...new Set([...state.activeLayers, id])]
        : state.activeLayers.filter((l) => l !== id),
    })),

  setLayerOpacity: (id, opacity) =>
    set((state) => ({
      layerTree: updateNodeInTree(state.layerTree, id, { opacity }),
    })),

  reorderLayers: (fromIndex, toIndex) =>
    set((state) => {
      const newActive = [...state.activeLayers];
      const [removed] = newActive.splice(fromIndex, 1);
      newActive.splice(toIndex, 0, removed);
      return { activeLayers: newActive };
    }),

  setActiveLayers: (ids) => set({ activeLayers: ids }),

  // 图层树操作
  updateTreeNode: (key, updates) =>
    set((state) => ({
      layerTree: updateNodeInTree(state.layerTree, key, updates),
    })),

  // 底图操作
  setImagery: (type) => {
    set({ currentImagery: type });
    // 同步到底图引擎
    const engine = get().activeEngine;
    if (engine) {
      const sources = engine.getImagerySources();
      const match = sources.find((s) => {
        const typeMap: Record<ImagerySourceType, string> = {
          osm: 'openstreetmap',
          satellite: 'tile',
          dark: 'tile',
          terrain: 'tile',
          custom: 'custom',
        };
        return s.type === typeMap[type] || s.id === type;
      });
      if (match) {
        engine.setImagerySource(match);
      }
    }
  },

  setActiveEngine: (engine) => set({ activeEngine: engine }),

  // 地形操作
  setTerrainEnabled: (enabled) => set({ terrainEnabled: enabled }),

  // 样式操作
  updateLayerStyle: (dataSourceId, style) =>
    set((state) => ({
      dataSources: state.dataSources.map((s) => {
        if (s.id === dataSourceId && (s.type === 'vector' || s.type === 'geojson')) {
          return { ...s, style: { ...(s as VectorLayer).style, ...style } } as VectorLayer;
        }
        return s;
      }),
    })),

  // 上传状态
  setUploading: (uploading) => set({ uploading }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),

  // 地形分析 - 尝试使用 CesiumJS 地形 API，回退到模拟
  computeLOS: async (request) => {
    set({ analyzing: true, losResult: null });

    const dist = Math.sqrt(
      Math.pow(request.to.lng - request.from.lng, 2) +
      Math.pow(request.to.lat - request.from.lat, 2)
    ) * 111000; // 粗略转换为米
    const steps = 50;

    let profile: LOSResponse['profile'] = [];

    // Try CesiumJS real terrain sampling
    const viewer = (window as any).__cesiumViewer as Cesium.Viewer | undefined;
    if (viewer?.terrainProvider) {
      try {
        const positions: Cesium.Cartographic[] = [];
        for (let i = 0; i <= steps; i++) {
          const ratio = i / steps;
          positions.push(
            Cesium.Cartographic.fromDegrees(
              request.from.lng + (request.to.lng - request.from.lng) * ratio,
              request.from.lat + (request.to.lat - request.from.lat) * ratio,
            )
          );
        }
        const sampled = await (Cesium as any).sampleTerrainMostDetailed(
          viewer.terrainProvider,
          positions,
        );
        profile = sampled.map((pos: Cesium.Cartographic, i: number) => {
          const ratio = i / steps;
          return {
            distance: ratio * dist,
            terrainHeight: pos.height ?? 0,
            losHeight: request.from.alt + (request.to.alt - request.from.alt) * ratio,
          };
        });
      } catch (err) {
        console.warn('[mapDataStore] Cesium terrain sampling failed, using mock:', err);
        profile = [];
      }
    }

    // Fallback to mock profile if Cesium sampling didn't produce results
    if (profile.length === 0) {
      await new Promise((r) => setTimeout(r, 800));
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        profile.push({
          distance: ratio * dist,
          terrainHeight: 100 + Math.sin(ratio * Math.PI * 3) * 200 + Math.random() * 50,
          losHeight: request.from.alt + (request.to.alt - request.from.alt) * ratio,
        });
      }
    }

    // Determine LOS from the profile
    let hasLOS = true;
    let obstructionIdx: number | undefined;
    for (let i = 0; i < profile.length; i++) {
      if (profile[i].terrainHeight > profile[i].losHeight) {
        hasLOS = false;
        obstructionIdx = i;
        break;
      }
    }

    const obstructionRatio = obstructionIdx !== undefined ? obstructionIdx / steps : undefined;
    const result: LOSResponse = {
      hasLOS,
      obstructionPoint: hasLOS ? undefined : {
        lng: request.from.lng + (request.to.lng - request.from.lng) * (obstructionRatio ?? 0.5),
        lat: request.from.lat + (request.to.lat - request.from.lat) * (obstructionRatio ?? 0.5),
        alt: profile[obstructionIdx ?? 0]?.terrainHeight ?? 350,
      },
      obstructionDistance: hasLOS ? undefined : (obstructionRatio ?? 0.5) * dist,
      profile,
    };

    set({ losResult: result, analyzing: false });
  },

  // 地形剖面 - 尝试使用 CesiumJS 地形 API，回退到模拟
  getTerrainProfile: async (request) => {
    set({ analyzing: true, terrainProfile: null });

    const profile: TerrainProfilePoint[] = [];
    let totalDist = 0;

    // Pre-compute distances
    const distances: number[] = [];
    for (let i = 0; i < request.points.length; i++) {
      if (i > 0) {
        const prev = request.points[i - 1];
        const d = Math.sqrt(
          Math.pow(request.points[i].lng - prev.lng, 2) +
          Math.pow(request.points[i].lat - prev.lat, 2)
        ) * 111000;
        totalDist += d;
      }
      distances.push(totalDist);
    }

    // Try CesiumJS real terrain sampling
    const viewer = (window as any).__cesiumViewer as Cesium.Viewer | undefined;
    let sampled = false;
    if (viewer?.terrainProvider) {
      try {
        const positions = request.points.map((p) =>
          Cesium.Cartographic.fromDegrees(p.lng, p.lat)
        );
        const result = await (Cesium as any).sampleTerrainMostDetailed(
          viewer.terrainProvider,
          positions,
        );
        for (let i = 0; i < request.points.length; i++) {
          const p = request.points[i];
          profile.push({
            distance: distances[i],
            lng: p.lng,
            lat: p.lat,
            altitude: result[i]?.height ?? 0,
          });
        }
        sampled = true;
      } catch (err) {
        console.warn('[mapDataStore] Cesium terrain sampling failed, using mock:', err);
      }
    }

    // Fallback to mock if Cesium didn't work
    if (!sampled) {
      await new Promise((r) => setTimeout(r, 600));
      for (let i = 0; i < request.points.length; i++) {
        const p = request.points[i];
        profile.push({
          distance: distances[i],
          lng: p.lng,
          lat: p.lat,
          altitude: 100 + Math.sin(distances[i] / 5000) * 300 + Math.random() * 80,
        });
      }
    }

    set({ terrainProfile: profile, analyzing: false });
  },

  // 覆盖范围分析
  computeCoverage: async (request) => {
    set({ analyzing: true, coverageResult: null });
    await new Promise((r) => setTimeout(r, 1000));

    const coveragePercent = 60 + Math.random() * 35;
    const result: CoverageAnalysisResult = {
      visiblePoints: [], // 简化，实际由引擎返回
      coveragePercent,
      bounds: {
        south: request.center.lat - 0.05,
        west: request.center.lng - 0.05,
        north: request.center.lat + 0.05,
        east: request.center.lng + 0.05,
      },
    };

    set({ coverageResult: result, analyzing: false });
  },

  clearAnalysisResults: () =>
    set({ losResult: null, terrainProfile: null, coverageResult: null }),

  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),
}));

// ============ 辅助函数 ============

function updateNodeInTree(
  tree: LayerTreeNode[],
  key: string,
  updates: Partial<LayerTreeNode>
): LayerTreeNode[] {
  return tree.map((node) => {
    if (node.key === key) {
      return { ...node, ...updates };
    }
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, key, updates) };
    }
    return node;
  });
}
