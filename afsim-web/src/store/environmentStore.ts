/**
 * 环境数据存储
 * 管理天气、海情、潮汐、大气数据
 * 支持按位置查询、最近插值、数据源管理
 */
import { create } from 'zustand';
import type { LngLat } from '../core/types/common';
import type {
  WeatherData,
  SeaStateData,
  TideData,
  AtmosphericData,
  EnvironmentDataSource,
  EnvironmentDataType,
} from '../modules/map-data/types/environment';

// ============ Types ============

interface EnvironmentState {
  // 数据存储 (key: stationId 或 gridCellId)
  weather: Map<string, WeatherData>;
  seaState: Map<string, SeaStateData>;
  tides: Map<string, TideData>;
  atmospheric: Map<string, AtmosphericData>;

  // 数据源配置
  dataSources: EnvironmentDataSource[];

  // 最后更新时间
  lastUpdated: Record<EnvironmentDataType, number>;

  // ---- 天气 ----
  setWeather: (data: WeatherData[]) => void;
  getWeatherAt: (pos: LngLat, maxDistanceKm?: number) => WeatherData | null;
  getAllWeather: () => WeatherData[];

  // ---- 海情 ----
  setSeaState: (data: SeaStateData[]) => void;
  getSeaStateAt: (pos: LngLat, maxDistanceKm?: number) => SeaStateData | null;
  getAllSeaState: () => SeaStateData[];

  // ---- 潮汐 ----
  setTides: (data: TideData[]) => void;
  getTideAt: (pos: LngLat, maxDistanceKm?: number) => TideData | null;
  getAllTides: () => TideData[];

  // ---- 大气 ----
  setAtmospheric: (data: AtmosphericData[]) => void;
  getAtmosphericAt: (pos: LngLat, maxDistanceKm?: number) => AtmosphericData | null;

  // ---- 数据源 ----
  addDataSource: (source: EnvironmentDataSource) => void;
  removeDataSource: (id: string) => void;
  updateDataSource: (id: string, updates: Partial<EnvironmentDataSource>) => void;

  // ---- 工具 ----
  clear: () => void;
  getStats: () => {
    weatherCount: number;
    seaStateCount: number;
    tideCount: number;
    atmosphericCount: number;
    lastUpdated: Record<EnvironmentDataType, number>;
  };
}

// ============ Helpers ============

/** Haversine 距离 (km) */
function haversineKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinHalf = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(sinHalf), Math.sqrt(1 - sinHalf));
}

/** 在集合中找最近的数据 */
function findNearest<T extends { position: LngLat }>(
  data: Map<string, T>,
  pos: LngLat,
  maxDistanceKm: number,
): T | null {
  let nearest: T | null = null;
  let minDist = maxDistanceKm;

  for (const item of data.values()) {
    const dist = haversineKm(pos, item.position);
    if (dist < minDist) {
      minDist = dist;
      nearest = item;
    }
  }
  return nearest;
}

// ============ Store ============

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  weather: new Map(),
  seaState: new Map(),
  tides: new Map(),
  atmospheric: new Map(),
  dataSources: [],
  lastUpdated: { weather: 0, sea: 0, tide: 0, atmospheric: 0 },

  // ---- 天气 ----
  setWeather: (data) => {
    set((state) => {
      const weather = new Map(state.weather);
      for (const w of data) {
        weather.set(w.stationId, w);
      }
      return {
        weather,
        lastUpdated: { ...state.lastUpdated, weather: Date.now() },
      };
    });
  },

  getWeatherAt: (pos, maxDistanceKm = 200) => {
    return findNearest(get().weather, pos, maxDistanceKm);
  },

  getAllWeather: () => Array.from(get().weather.values()),

  // ---- 海情 ----
  setSeaState: (data) => {
    set((state) => {
      const seaState = new Map(state.seaState);
      for (const s of data) {
        const key = `${s.position.lat.toFixed(2)}_${s.position.lng.toFixed(2)}`;
        seaState.set(key, s);
      }
      return {
        seaState,
        lastUpdated: { ...state.lastUpdated, sea: Date.now() },
      };
    });
  },

  getSeaStateAt: (pos, maxDistanceKm = 200) => {
    return findNearest(get().seaState, pos, maxDistanceKm);
  },

  getAllSeaState: () => Array.from(get().seaState.values()),

  // ---- 潮汐 ----
  setTides: (data) => {
    set((state) => {
      const tides = new Map(state.tides);
      for (const t of data) {
        tides.set(t.stationId, t);
      }
      return {
        tides,
        lastUpdated: { ...state.lastUpdated, tide: Date.now() },
      };
    });
  },

  getTideAt: (pos, maxDistanceKm = 100) => {
    return findNearest(get().tides, pos, maxDistanceKm);
  },

  getAllTides: () => Array.from(get().tides.values()),

  // ---- 大气 ----
  setAtmospheric: (data) => {
    set((state) => {
      const atmospheric = new Map(state.atmospheric);
      for (const a of data) {
        const key = `${a.position.lat.toFixed(2)}_${a.position.lng.toFixed(2)}`;
        atmospheric.set(key, a);
      }
      return {
        atmospheric,
        lastUpdated: { ...state.lastUpdated, atmospheric: Date.now() },
      };
    });
  },

  getAtmosphericAt: (pos, maxDistanceKm = 200) => {
    return findNearest(get().atmospheric, pos, maxDistanceKm);
  },

  // ---- 数据源 ----
  addDataSource: (source) => {
    set((state) => ({ dataSources: [...state.dataSources, source] }));
  },

  removeDataSource: (id) => {
    set((state) => ({ dataSources: state.dataSources.filter((s) => s.id !== id) }));
  },

  updateDataSource: (id, updates) => {
    set((state) => ({
      dataSources: state.dataSources.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  // ---- 工具 ----
  clear: () => {
    set({
      weather: new Map(),
      seaState: new Map(),
      tides: new Map(),
      atmospheric: new Map(),
      lastUpdated: { weather: 0, sea: 0, tide: 0, atmospheric: 0 },
    });
  },

  getStats: () => {
    const s = get();
    return {
      weatherCount: s.weather.size,
      seaStateCount: s.seaState.size,
      tideCount: s.tides.size,
      atmosphericCount: s.atmospheric.size,
      lastUpdated: { ...s.lastUpdated },
    };
  },
}));
