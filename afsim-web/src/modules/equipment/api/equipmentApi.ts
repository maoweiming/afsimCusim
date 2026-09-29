// ============================================================
// Equipment Module - API Client
// AFSIM-native: AfsimEquipment is the sole data model
// ============================================================

import type { EquipmentListResponse, EquipmentQueryParams } from '../types';
import type { AfsimEquipment } from '../afsim/types';
import { SEED_AFSIM_CONFIGS } from '../data/seedAfsimConfigs';

// ============ Additional Types ============

export interface VersionRecord {
  version: number;
  author: string;
  message: string;
  createdAt: string;
  changes: number;
}

export interface VersionDiff {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface LockInfo {
  lockedBy: string;
  lockedAt: string;
  expiresAt: string;
}

// ============ Configuration ============

const API_BASE =
  (import.meta as any).env?.VITE_DATA_API_URL || 'http://localhost:8080/api/v1';
const USE_MOCK =
  (import.meta as any).env?.VITE_USE_MOCK === 'true' || !(import.meta as any).env?.VITE_DATA_API_URL;

// ============ Mock Data ============

const MOCK_LIST: AfsimEquipment[] = Object.values(SEED_AFSIM_CONFIGS) as AfsimEquipment[];
// SEED_AFSIM_CONFIGS is keyed by short slugs (e.g. "cvn-78"), but every
// lookup/update/delete in this module indexes by the equipment's `name`
// field (e.g. "CVN-78_Gerald_R_Ford") — re-key by `.name` so they match.
const MOCK_CONFIGS: Record<string, AfsimEquipment> = Object.fromEntries(
  MOCK_LIST.map((eq) => [eq.name, eq]),
);

// ============ Mock helpers ============

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockList(params?: EquipmentQueryParams): EquipmentListResponse {
  let data = [...MOCK_LIST];

  if (params?.keyword) {
    const kw = params.keyword.toLowerCase();
    data = data.filter(
      (e) =>
        e.name.toLowerCase().includes(kw) ||
        (e.parentType && e.parentType.toLowerCase().includes(kw)),
    );
  }

  if (params?.sortBy) {
    const key = params.sortBy;
    const order = params.sortOrder === 'desc' ? -1 : 1;
    data.sort((a, b) => {
      if (key === 'spatialDomain') {
        const aVal = a.platform.spatialDomain || '';
        const bVal = b.platform.spatialDomain || '';
        return order * aVal.localeCompare(bVal);
      }
      const aVal = a[key] ?? '';
      const bVal = b[key] ?? '';
      return order * String(aVal).localeCompare(String(bVal));
    });
  }

  const total = data.length;
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const start = (page - 1) * pageSize;
  const paged = data.slice(start, start + pageSize);

  return { data: paged, total, page, pageSize };
}

function mockGetDetail(name: string): AfsimEquipment | null {
  return MOCK_CONFIGS[name] ?? null;
}

// ============ API Client ============

export const equipmentApi = {
  /** 获取装备列表（AfsimEquipment[]） */
  async list(params?: EquipmentQueryParams): Promise<EquipmentListResponse> {
    if (USE_MOCK) {
      await delay(300);
      return mockList(params);
    }

    try {
      const qs = params
        ? new URLSearchParams(
            Object.entries(params)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([k, v]) => [k, String(v)])
          ).toString()
        : '';
      const url = `${API_BASE}/equipment${qs ? `?${qs}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      console.warn('Equipment API unavailable, using mock data:', e);
      return mockList(params);
    }
  },

  /** 获取装备详情（AfsimEquipment） */
  async get(name: string): Promise<AfsimEquipment | null> {
    if (USE_MOCK) {
      await delay(200);
      return mockGetDetail(name);
    }

    try {
      const response = await fetch(`${API_BASE}/equipment/${encodeURIComponent(name)}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (e) {
      console.warn('Equipment API unavailable, using mock data:', e);
      return mockGetDetail(name);
    }
  },

  /** 创建装备 */
  async create(equipment: AfsimEquipment): Promise<AfsimEquipment> {
    if (USE_MOCK) {
      await delay(400);
      MOCK_CONFIGS[equipment.name] = equipment;
      MOCK_LIST.push(equipment);
      return equipment;
    }

    try {
      const response = await fetch(`${API_BASE}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equipment),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      console.warn('Equipment API unavailable, using mock data:', e);
      throw e;
    }
  },

  /** 更新装备 */
  async update(name: string, updates: Partial<AfsimEquipment>): Promise<AfsimEquipment> {
    if (USE_MOCK) {
      await delay(400);
      const existing = MOCK_CONFIGS[name];
      if (!existing) throw new Error(`Equipment not found: ${name}`);
      const updated: AfsimEquipment = { ...existing, ...updates };
      MOCK_CONFIGS[name] = updated;
      const idx = MOCK_LIST.findIndex((e) => e.name === name);
      if (idx !== -1) MOCK_LIST[idx] = updated;
      return updated;
    }

    try {
      const response = await fetch(`${API_BASE}/equipment/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      console.warn('Equipment API unavailable, using mock data:', e);
      throw e;
    }
  },

  /** 删除装备 */
  async remove(name: string): Promise<void> {
    if (USE_MOCK) {
      await delay(300);
      delete MOCK_CONFIGS[name];
      const idx = MOCK_LIST.findIndex((e) => e.name === name);
      if (idx !== -1) MOCK_LIST.splice(idx, 1);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/equipment/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (e) {
      console.warn('Equipment API unavailable, using mock data:', e);
    }
  },

  /** 批量导入装备 */
  async importEquipment(items: AfsimEquipment[]): Promise<{ imported: number; names: string[] }> {
    if (USE_MOCK) {
      await delay(500);
      const newNames: string[] = [];
      for (const item of items) {
        MOCK_CONFIGS[item.name] = item;
        MOCK_LIST.push(item);
        newNames.push(item.name);
      }
      return { imported: items.length, names: newNames };
    }

    try {
      const response = await fetch(`${API_BASE}/equipment/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      console.warn('Equipment API unavailable, using mock:', e);
      throw e;
    }
  },

  /** 批量导出装备 */
  async exportEquipment(names: string[]): Promise<Blob> {
    if (USE_MOCK) {
      await delay(400);
      const configs = names.map((name) => MOCK_CONFIGS[name]).filter(Boolean);
      const json = JSON.stringify(configs, null, 2);
      return new Blob([json], { type: 'application/json' });
    }

    try {
      const response = await fetch(`${API_BASE}/equipment/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.blob();
    } catch (e) {
      console.warn('Equipment API unavailable:', e);
      throw e;
    }
  },

  /** 获取装备版本历史 */
  async getVersionHistory(_name: string): Promise<VersionRecord[]> {
    await delay(250);
    return [
      { version: 5, author: '张工程师', message: '更新传感器参数', createdAt: '2026-04-20T10:00:00Z', changes: 3 },
      { version: 4, author: '李工程师', message: '添加新型武器配置', createdAt: '2026-03-15T14:30:00Z', changes: 5 },
      { version: 3, author: '王工程师', message: '修正通信系统频率参数', createdAt: '2026-02-28T09:15:00Z', changes: 2 },
      { version: 2, author: '张工程师', message: '更新平台运动参数', createdAt: '2026-01-10T16:45:00Z', changes: 4 },
      { version: 1, author: '系统管理员', message: '初始版本创建', createdAt: '2025-12-01T08:00:00Z', changes: 0 },
    ];
  },

  /** 比较两个版本差异 */
  async compareVersions(_name: string, _v1: number, _v2: number): Promise<VersionDiff[]> {
    await delay(300);
    return [
      { field: 'platform.movers.air_mover.maximumSpeed', label: '最大速度', oldValue: '1900 knots', newValue: '1960 knots' },
      { field: 'platform.sensors.radar.template.transmitter.power', label: '雷达功率', oldValue: '2.0 MW', newValue: '2.3 MW' },
    ];
  },

  /** 查询装备锁定状态 */
  async getLockStatus(name: string): Promise<LockInfo | null> {
    await delay(100);
    const lockedNames = ['DCA', 'BLUE_STRIKER'];
    if (lockedNames.includes(name)) {
      const now = new Date();
      return {
        lockedBy: '张工程师',
        lockedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      };
    }
    return null;
  },

  /** 锁定装备 */
  async lockEquipment(_name: string): Promise<LockInfo> {
    await delay(200);
    const now = new Date();
    return {
      lockedBy: '当前用户',
      lockedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    };
  },

  /** 解锁装备 */
  async unlockEquipment(_name: string): Promise<{ success: boolean }> {
    await delay(150);
    return { success: true };
  },
};
