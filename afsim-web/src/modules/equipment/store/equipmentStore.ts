// ============================================================
// Equipment Module - Zustand Store
// AFSIM-native: AfsimEquipment is the sole data model
// ============================================================

import { create } from 'zustand';
import type { EquipmentQueryParams } from '../types';
import { createEmptyEquipment, type AfsimEquipment } from '../afsim/types';
import { equipmentApi } from '../api/equipmentApi';
import type { VersionRecord, VersionDiff, LockInfo } from '../api/equipmentApi';

// ============ State Types ============

interface EquipmentState {
  // 列表数据（AfsimEquipment[]）
  equipmentList: AfsimEquipment[];
  total: number;
  page: number;
  pageSize: number;

  // 当前选中装备
  selectedEquipment: AfsimEquipment | null;

  // 查询参数
  queryParams: EquipmentQueryParams;

  // UI 状态
  loading: boolean;
  detailLoading: boolean;
  saving: boolean;
  error: string | null;

  // 编辑器状态
  editorVisible: boolean;
  editingEquipment: AfsimEquipment | null;
  draftEquipment: AfsimEquipment | null;

  // 版本控制
  versionHistory: VersionRecord[];
  versionLoading: boolean;

  // 锁定
  lockInfo: LockInfo | null;
  lockLoading: boolean;
  lockedEquipmentMap: Record<string, LockInfo>;

  // 导入/导出
  importing: boolean;
  exporting: boolean;

  // 操作方法
  fetchList: () => Promise<void>;
  fetchDetail: (name: string) => Promise<void>;

  setKeyword: (keyword: string) => void;
  setSortBy: (sortBy: 'name' | 'parentType' | 'spatialDomain', sortOrder?: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  resetQuery: () => void;

  selectEquipment: (equipment: AfsimEquipment | null) => void;

  openEditor: (equipment?: AfsimEquipment) => void;
  closeEditor: () => void;
  updateDraft: (draft: Partial<AfsimEquipment>) => void;
  saveEquipment: (equipment: AfsimEquipment) => Promise<void>;
  deleteEquipment: (name: string) => Promise<void>;

  // 版本控制
  fetchVersionHistory: (name: string) => Promise<void>;
  compareVersions: (name: string, v1: number, v2: number) => Promise<VersionDiff[]>;

  // 锁定
  lockEquipment: (name: string) => Promise<void>;
  unlockEquipment: (name: string) => Promise<void>;
  getLockStatuses: (names: string[]) => Promise<void>;

  // 版本回滚
  rollbackVersion: (name: string, version: number) => Promise<void>;

  // 导入/导出
  importEquipment: (items: AfsimEquipment[]) => Promise<void>;
  exportEquipment: (names: string[]) => Promise<void>;
}

const DEFAULT_QUERY: EquipmentQueryParams = {
  keyword: '',
  sortBy: 'name',
  sortOrder: 'asc',
  page: 1,
  pageSize: 10,
};

// ============ Store ============

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  // 初始状态
  equipmentList: [],
  total: 0,
  page: 1,
  pageSize: 10,
  selectedEquipment: null,
  queryParams: { ...DEFAULT_QUERY },
  loading: false,
  detailLoading: false,
  saving: false,
  error: null,
  editorVisible: false,
  editingEquipment: null,
  draftEquipment: null,
  versionHistory: [],
  versionLoading: false,
  lockInfo: null,
  lockLoading: false,
  lockedEquipmentMap: {},
  importing: false,
  exporting: false,

  // ---- 获取列表 ----
  fetchList: async () => {
    set({ loading: true, error: null });
    try {
      const { queryParams } = get();
      const res = await equipmentApi.list(queryParams);
      set({
        equipmentList: res.data,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  // ---- 获取详情 ----
  fetchDetail: async (name: string) => {
    set({ detailLoading: true, error: null });
    try {
      const equipment = await equipmentApi.get(name);
      set({ selectedEquipment: equipment, detailLoading: false });
    } catch (e) {
      set({ detailLoading: false, error: (e as Error).message });
    }
  },

  // ---- 查询参数设置 ----
  setKeyword: (keyword: string) => {
    set((state) => ({
      queryParams: { ...state.queryParams, keyword, page: 1 },
    }));
    get().fetchList();
  },

  setSortBy: (sortBy, sortOrder) => {
    set((state) => {
      const currentSort = state.queryParams.sortBy;
      const currentOrder = state.queryParams.sortOrder;
      return {
        queryParams: {
          ...state.queryParams,
          sortBy,
          sortOrder:
            sortOrder ?? (currentSort === sortBy && currentOrder === 'asc' ? 'desc' : 'asc'),
          page: 1,
        },
      };
    });
    get().fetchList();
  },

  setPage: (page: number) => {
    set((state) => ({
      queryParams: { ...state.queryParams, page },
    }));
    get().fetchList();
  },

  setPageSize: (pageSize: number) => {
    set((state) => ({
      queryParams: { ...state.queryParams, pageSize, page: 1 },
    }));
    get().fetchList();
  },

  resetQuery: () => {
    set({ queryParams: { ...DEFAULT_QUERY } });
    get().fetchList();
  },

  // ---- 选择装备 ----
  selectEquipment: (equipment) => {
    set({ selectedEquipment: equipment });
  },

  // ---- 编辑器 ----
  openEditor: (equipment) => {
    if (equipment) {
      set({
        editorVisible: true,
        editingEquipment: equipment,
        draftEquipment: JSON.parse(JSON.stringify(equipment)),
      });
    } else {
      set({
        editorVisible: true,
        editingEquipment: null,
        draftEquipment: createEmptyEquipment(),
      });
    }
  },

  closeEditor: () => {
    set({
      editorVisible: false,
      editingEquipment: null,
      draftEquipment: null,
    });
  },

  updateDraft: (draft) => {
    set((state) => ({
      draftEquipment: state.draftEquipment
        ? { ...state.draftEquipment, ...draft }
        : null,
    }));
  },

  // ---- 保存装备 ----
  saveEquipment: async (equipment: AfsimEquipment) => {
    set({ saving: true, error: null });
    try {
      let saved: AfsimEquipment;
      const existing = await equipmentApi.get(equipment.name);
      if (existing) {
        saved = await equipmentApi.update(equipment.name, equipment);
      } else {
        saved = await equipmentApi.create(equipment);
      }
      set({
        saving: false,
        editorVisible: false,
        editingEquipment: null,
        draftEquipment: null,
        selectedEquipment: saved,
      });
      get().fetchList();
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
    }
  },

  // ---- 删除装备 ----
  deleteEquipment: async (name: string) => {
    set({ loading: true, error: null });
    try {
      await equipmentApi.remove(name);
      set((state) => ({
        selectedEquipment: state.selectedEquipment?.name === name ? null : state.selectedEquipment,
      }));
      get().fetchList();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  // ---- 获取版本历史 ----
  fetchVersionHistory: async (name: string) => {
    set({ versionLoading: true, error: null });
    try {
      const history = await equipmentApi.getVersionHistory(name);
      set({ versionHistory: history, versionLoading: false });
    } catch (e) {
      set({ versionLoading: false, error: (e as Error).message });
    }
  },

  // ---- 比较版本 ----
  compareVersions: async (name: string, v1: number, v2: number) => {
    set({ versionLoading: true, error: null });
    try {
      const diffs = await equipmentApi.compareVersions(name, v1, v2);
      set({ versionLoading: false });
      return diffs;
    } catch (e) {
      set({ versionLoading: false, error: (e as Error).message });
      return [];
    }
  },

  // ---- 锁定装备 ----
  lockEquipment: async (name: string) => {
    set({ lockLoading: true, error: null });
    try {
      const info = await equipmentApi.lockEquipment(name);
      set((state) => ({
        lockInfo: info,
        lockLoading: false,
        lockedEquipmentMap: { ...state.lockedEquipmentMap, [name]: info },
      }));
    } catch (e) {
      set({ lockLoading: false, error: (e as Error).message });
    }
  },

  // ---- 解锁装备 ----
  unlockEquipment: async (name: string) => {
    set({ lockLoading: true, error: null });
    try {
      await equipmentApi.unlockEquipment(name);
      set((state) => {
        const newMap = { ...state.lockedEquipmentMap };
        delete newMap[name];
        return { lockInfo: null, lockLoading: false, lockedEquipmentMap: newMap };
      });
    } catch (e) {
      set({ lockLoading: false, error: (e as Error).message });
    }
  },

  // ---- 批量查询锁定状态 ----
  getLockStatuses: async (names: string[]) => {
    try {
      const entries = await Promise.all(
        names.map(async (name) => {
          const info = await equipmentApi.getLockStatus(name);
          return info ? ([name, info] as [string, LockInfo]) : null;
        }),
      );
      const map: Record<string, LockInfo> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }
      set({ lockedEquipmentMap: map });
    } catch {
      // silently fail
    }
  },

  // ---- 版本回滚 ----
  rollbackVersion: async (_name: string, _version: number) => {
    set({ saving: true, error: null });
    try {
      // Mock: just delay
      await new Promise((r) => setTimeout(r, 300));
      set({ saving: false });
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
    }
  },

  // ---- 批量导入装备 ----
  importEquipment: async (items: AfsimEquipment[]) => {
    set({ importing: true, error: null });
    try {
      await equipmentApi.importEquipment(items);
      set({ importing: false });
      get().fetchList();
    } catch (e) {
      set({ importing: false, error: (e as Error).message });
    }
  },

  // ---- 批量导出装备 ----
  exportEquipment: async (names: string[]) => {
    set({ exporting: true, error: null });
    try {
      const blob = await equipmentApi.exportEquipment(names);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `equipment-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      set({ exporting: false });
    } catch (e) {
      set({ exporting: false, error: (e as Error).message });
    }
  },
}));
