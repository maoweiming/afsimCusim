// ============================================================
// Data Center Module - Data API
// 数据列表 REST API（对接 data-platform data-gateway，含 mock 降级）
//
// 后端端点（data-platform/services/data-gateway）:
//   GET /api/v1/equipment?status=&search=&page_size=  -> { equipment: [...], total }
//   GET /api/v1/scenarios?status=&search=&page_size=   -> { scenarios: [...], total }
// 装备/想定模型被映射为前端统一的 DataItem。
// 仿真(simulation)/回放(replay) 暂无对应列表端点，真实模式下为空。
// ============================================================

import type { DataItem } from '../types';

const API_BASE = import.meta.env.VITE_DATA_API_URL || '/api/v1';

export interface DataItemFilters {
  type?: DataItem['type'] | 'all';
  status?: DataItem['status'] | 'all';
  search?: string;
}

// ============ 后端 DTO（pb JSON）============

interface EquipmentDTO {
  id: string;
  name: string;
  category?: string;
  version?: number; // 装备版本为整数
  status?: string;
  tags?: string[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

interface ScenarioDTO {
  id: string;
  name: string;
  category?: string;
  version?: string; // 想定版本为字符串
  status?: string;
  tags?: string[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

interface ListEquipmentResponse {
  equipment?: EquipmentDTO[];
  total?: number;
}

interface ListScenarioResponse {
  scenarios?: ScenarioDTO[];
  total?: number;
}

// ============ 辅助 ============

const VALID_STATUS: ReadonlyArray<DataItem['status']> = ['draft', 'review', 'published', 'archived'];

function normalizeStatus(status?: string): DataItem['status'] {
  return VALID_STATUS.includes(status as DataItem['status'])
    ? (status as DataItem['status'])
    : 'draft';
}

function buildQuery(filters: DataItemFilters): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  params.set('page_size', '500'); // 列表数据量小，一次拉全，过滤在前端进行
  const q = params.toString();
  return q ? `?${q}` : '';
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${path}`);
  return res.json();
}

function mapEquipment(e: EquipmentDTO): DataItem {
  return {
    id: e.id,
    name: e.name,
    type: 'equipment',
    version: e.version != null ? String(e.version) : '1',
    status: normalizeStatus(e.status),
    createdBy: e.created_by ?? '',
    createdAt: e.created_at ?? '',
    updatedAt: e.updated_at ?? e.created_at ?? '',
    tags: e.tags ?? [],
  };
}

function mapScenario(s: ScenarioDTO): DataItem {
  return {
    id: s.id,
    name: s.name,
    type: 'scenario',
    version: s.version || '1.0.0',
    status: normalizeStatus(s.status),
    createdBy: s.created_by ?? '',
    createdAt: s.created_at ?? '',
    updatedAt: s.updated_at ?? s.created_at ?? '',
    tags: s.tags ?? [],
  };
}

// ============ API ============

export const dataCenterApi = {
  /**
   * 从 data-platform 拉取数据条目并映射为 DataItem[]。
   * 按 type 决定调用哪些后端端点；status/search 透传给后端过滤。
   * 任一端点失败即抛出，由调用方决定降级策略。
   */
  async fetchDataItems(filters: DataItemFilters = {}): Promise<DataItem[]> {
    const query = buildQuery(filters);
    const wantEquipment = !filters.type || filters.type === 'all' || filters.type === 'equipment';
    const wantScenario = !filters.type || filters.type === 'all' || filters.type === 'scenario';

    const tasks: Promise<DataItem[]>[] = [];
    if (wantEquipment) {
      tasks.push(
        getJSON<ListEquipmentResponse>(`/equipment${query}`).then((r) =>
          (r.equipment ?? []).map(mapEquipment)
        )
      );
    }
    if (wantScenario) {
      tasks.push(
        getJSON<ListScenarioResponse>(`/scenarios${query}`).then((r) =>
          (r.scenarios ?? []).map(mapScenario)
        )
      );
    }

    const results = await Promise.all(tasks);
    return results.flat();
  },
};
