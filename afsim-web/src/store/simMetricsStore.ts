/**
 * simMetricsStore - 仿真运行期实时指标累加器
 *
 * 数据中间平台（InfluxDB/timeseries 服务）离线或未部署时，评估报告无法从
 * `replayApi.getSimulationStats` 获取统计。本 store 直接消费 WebSocket 事件流，
 * 在浏览器端实时累加每个平台的速度/高度/航程极值、武器发射/命中数与交战记录，
 * 作为评估报告的"真实数据"来源（与数据平台路径互为补充/降级）。
 *
 * 注意：mover_update 为高频事件，订阅方应通过 getState() 按需读取（刷新/定时），
 * 不要直接响应式订阅本 store，以免高频重渲染。
 */
import { create } from 'zustand';

export interface PlatformMetric {
  index: number;
  name: string;
  side: string;
  maxSpeed: number; // m/s
  minAltitude: number; // m
  maxAltitude: number; // m
  totalDistance: number; // m
  shotsFired: number;
  kills: number;
  lastLat: number | null;
  lastLon: number | null;
  sampleCount: number; // 收到的 mover 采样数（用于判断 min/max 是否有效）
  isWeapon: boolean; // 武器/弹药平台（开火后追加，统计时排除）
  status: 'active' | 'damaged' | 'destroyed';
}

export interface MetricEngagement {
  id: string;
  time: number;
  attacker_index: number;
  target_index: number;
  weapon_name: string;
  result: 'pending' | 'hit' | 'miss';
}

interface SimMetricsState {
  platforms: Map<number, PlatformMetric>;
  engagements: MetricEngagement[];
  /** weapon_platform_index -> engagement id（用于命中/脱靶时回填结果） */
  pendingByWeapon: Map<number, string>;
  frameCount: number;
  startTime: number | null;
  lastTime: number;

  ensurePlatform: (index: number, name?: string, side?: string) => void;
  recordMover: (
    index: number,
    lat?: number,
    lon?: number,
    alt?: number,
    velN?: number,
    velE?: number,
    velD?: number,
  ) => void;
  recordFired: (
    weaponIndex: number,
    firingIndex: number,
    targetIndex: number,
    weaponName: string,
    time: number,
  ) => void;
  resolveEngagement: (weaponIndex: number, result: 'hit' | 'miss', time: number) => void;
  setStatus: (index: number, status: 'active' | 'damaged' | 'destroyed') => void;
  recordFrame: (simTime: number) => void;
  reset: () => void;
}

const EARTH_RADIUS_M = 6371000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function blankMetric(index: number, name = '', side = ''): PlatformMetric {
  return {
    index,
    name,
    side,
    maxSpeed: 0,
    minAltitude: Infinity,
    maxAltitude: -Infinity,
    totalDistance: 0,
    shotsFired: 0,
    kills: 0,
    lastLat: null,
    lastLon: null,
    sampleCount: 0,
    isWeapon: false,
    status: 'active',
  };
}

let engagementCounter = 0;

export const useSimMetricsStore = create<SimMetricsState>((set) => ({
  platforms: new Map(),
  engagements: [],
  pendingByWeapon: new Map(),
  frameCount: 0,
  startTime: null,
  lastTime: 0,

  ensurePlatform: (index, name, side) =>
    set((state) => {
      const existing = state.platforms.get(index);
      if (existing) {
        // 回填更完整的标识信息
        if ((name && name !== existing.name) || (side && side !== existing.side)) {
          const next = new Map(state.platforms);
          next.set(index, { ...existing, name: name || existing.name, side: side || existing.side });
          return { platforms: next };
        }
        return state;
      }
      const next = new Map(state.platforms);
      next.set(index, blankMetric(index, name, side));
      return { platforms: next };
    }),

  recordMover: (index, lat, lon, alt, velN, velE, velD) =>
    set((state) => {
      const prev = state.platforms.get(index) ?? blankMetric(index);
      const m: PlatformMetric = { ...prev };

      if (velN !== undefined || velE !== undefined || velD !== undefined) {
        const vn = velN ?? 0;
        const ve = velE ?? 0;
        const vd = velD ?? 0;
        const speed = Math.sqrt(vn * vn + ve * ve + vd * vd);
        if (speed > m.maxSpeed) m.maxSpeed = speed;
      }
      if (alt !== undefined) {
        if (alt < m.minAltitude) m.minAltitude = alt;
        if (alt > m.maxAltitude) m.maxAltitude = alt;
      }
      if (lat !== undefined && lon !== undefined) {
        if (m.lastLat !== null && m.lastLon !== null) {
          const d = haversineMeters(m.lastLat, m.lastLon, lat, lon);
          // 过滤明显异常的跳变（瞬移），避免污染航程
          if (d < 100000) m.totalDistance += d;
        }
        m.lastLat = lat;
        m.lastLon = lon;
      }
      m.sampleCount += 1;

      const next = new Map(state.platforms);
      next.set(index, m);
      return { platforms: next };
    }),

  recordFired: (weaponIndex, firingIndex, targetIndex, weaponName, time) =>
    set((state) => {
      const platforms = new Map(state.platforms);
      // 发射方计数
      const firer = platforms.get(firingIndex) ?? blankMetric(firingIndex);
      platforms.set(firingIndex, { ...firer, shotsFired: firer.shotsFired + 1 });
      // 武器平台标记为弹药（统计时排除）
      const weaponMetric = platforms.get(weaponIndex) ?? blankMetric(weaponIndex);
      platforms.set(weaponIndex, { ...weaponMetric, isWeapon: true });

      const id = `eng-${engagementCounter++}`;
      const engagements = [
        ...state.engagements,
        {
          id,
          time,
          attacker_index: firingIndex,
          target_index: targetIndex,
          weapon_name: weaponName,
          result: 'pending' as const,
        },
      ];
      const pendingByWeapon = new Map(state.pendingByWeapon);
      pendingByWeapon.set(weaponIndex, id);
      return { platforms, engagements, pendingByWeapon };
    }),

  resolveEngagement: (weaponIndex, result, time) =>
    set((state) => {
      const id = state.pendingByWeapon.get(weaponIndex);
      if (!id) return state;
      const engagements = state.engagements.map((e) =>
        e.id === id ? { ...e, result, time } : e,
      );
      const pendingByWeapon = new Map(state.pendingByWeapon);
      pendingByWeapon.delete(weaponIndex);

      let platforms = state.platforms;
      if (result === 'hit') {
        const eng = state.engagements.find((e) => e.id === id);
        if (eng) {
          const attacker = state.platforms.get(eng.attacker_index);
          if (attacker) {
            platforms = new Map(state.platforms);
            platforms.set(eng.attacker_index, { ...attacker, kills: attacker.kills + 1 });
          }
        }
      }
      return { engagements, pendingByWeapon, platforms };
    }),

  setStatus: (index, status) =>
    set((state) => {
      const existing = state.platforms.get(index);
      if (!existing || existing.status === status) return state;
      // 不要把已击毁降级
      if (existing.status === 'destroyed' && status === 'damaged') return state;
      const next = new Map(state.platforms);
      next.set(index, { ...existing, status });
      return { platforms: next };
    }),

  recordFrame: (simTime) =>
    set((state) => ({
      frameCount: state.frameCount + 1,
      startTime: state.startTime ?? simTime,
      lastTime: simTime,
    })),

  reset: () =>
    set({
      platforms: new Map(),
      engagements: [],
      pendingByWeapon: new Map(),
      frameCount: 0,
      startTime: null,
      lastTime: 0,
    }),
}));
