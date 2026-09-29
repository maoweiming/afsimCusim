/**
 * 想定编辑模块 - Zustand 状态管理
 * 包含场景列表、编辑器状态、协同状态
 */

import { create } from 'zustand';
import { message } from 'antd';
import type {
  Scenario,
  ScenarioBranch,
  ScenarioStatus,
  PlatformInstance,
  RouteDefinition,
  ZoneDefinition,
  EquipmentItem,
  Collaborator,
  EditorTool,
  ScenarioComment,
  ChatMessage,
  FormationDefinition,
  MissionDefinition,
} from '../types';
import * as api from '../api/scenarioApi';

// 想定中可容纳的平台数量上限（可调，满足"规模上限超过100个、可调"的要求）
const MAX_PLATFORMS = 500;

// ============ 列表状态 ============

interface ScenarioListState {
  scenarios: Scenario[];
  loading: boolean;
  error: string | null;
  viewMode: 'card' | 'table';
  statusFilter: ScenarioStatus | 'all';
  tagFilter: string;
  searchText: string;

  // 操作
  fetchScenarios: () => Promise<void>;
  createScenario: (
    data: Pick<Scenario, 'name' | 'description' | 'tags' | 'classification'> & { templateId?: string }
  ) => Promise<Scenario>;
  deleteScenario: (id: string) => Promise<boolean>;
  updateScenarioStatus: (id: string, status: ScenarioStatus) => Promise<boolean>;
  setViewMode: (mode: 'card' | 'table') => void;
  setStatusFilter: (status: ScenarioStatus | 'all') => void;
  setTagFilter: (tag: string) => void;
  setSearchText: (text: string) => void;

  // 计算属性
  getFilteredScenarios: () => Scenario[];
}

export const useScenarioListStore = create<ScenarioListState>((set, get) => ({
  scenarios: [],
  loading: false,
  error: null,
  viewMode: 'card',
  statusFilter: 'all',
  tagFilter: '',
  searchText: '',

  fetchScenarios: async () => {
    set({ loading: true, error: null });
    try {
      const scenarios = await api.fetchScenarioList();
      set({ scenarios, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createScenario: async (data) => {
    set({ loading: true, error: null });
    try {
      const scenario = await api.createScenario(data);
      set((state) => ({
        scenarios: [scenario, ...state.scenarios],
        loading: false,
      }));
      return scenario;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  deleteScenario: async (id) => {
    try {
      await api.deleteScenario(id);
      set((state) => ({
        scenarios: state.scenarios.filter((s) => s.id !== id),
      }));
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },

  updateScenarioStatus: async (id, status) => {
    try {
      const updated = await api.updateScenarioStatus(id, status);
      set((state) => ({
        scenarios: state.scenarios.map((s) => (s.id === id ? updated : s)),
      }));
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setTagFilter: (tagFilter) => set({ tagFilter }),
  setSearchText: (searchText) => set({ searchText }),

  getFilteredScenarios: () => {
    const { scenarios, statusFilter, tagFilter, searchText } = get();
    let filtered = scenarios;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    if (tagFilter) {
      filtered = filtered.filter((s) =>
        s.tags.some((t) => t.includes(tagFilter))
      );
    }

    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(lower) ||
          s.description.toLowerCase().includes(lower)
      );
    }

    return filtered;
  },
}));

// ============ 编辑器状态 ============

interface ScenarioEditorState {
  // 当前编辑的想定
  currentScenario: Scenario | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  dirty: boolean; // 有未保存的修改

  // 当前分支
  currentBranch: ScenarioBranch | null;
  branches: ScenarioBranch[];

  // 编辑器工具
  activeTool: EditorTool;

  // 选中的实体
  selectedPlatformId: string | null;
  selectedRouteId: string | null;
  selectedZoneId: string | null;
  selectedFormationId: string | null;
  selectedMissionId: string | null;

  // 装备库
  equipment: EquipmentItem[];
  equipmentLoading: boolean;

  // 地图拾取位置
  pendingPosition: { lng: number; lat: number } | null;

  // 撤销/重做历史（记录编辑前的想定快照）
  history: { past: Scenario[]; future: Scenario[] };

  // 侧边面板
  rightPanelTab: 'entities' | 'properties' | 'environment' | 'carriers' | 'formations' | 'missions' | 'collab' | 'comments' | 'chat' | 'validate';

  // 操作
  loadScenario: (id: string) => Promise<void>;
  /** 离开编辑器时清除当前想定，避免 Zustand 单例在下次进入时渲染脏数据 */
  clearScenario: () => void;
  saveScenario: () => Promise<void>;
  updateScenarioField: (field: string, value: any) => void;

  // 平台操作
  addPlatform: (platform: PlatformInstance) => void;
  updatePlatform: (id: string, updates: Partial<PlatformInstance>) => void;
  removePlatform: (id: string) => void;
  selectPlatform: (id: string | null) => void;

  // 路线操作
  addRoute: (route: RouteDefinition) => void;
  updateRoute: (id: string, updates: Partial<RouteDefinition>) => void;
  removeRoute: (id: string) => void;
  selectRoute: (id: string | null) => void;

  // 区域操作
  addZone: (zone: ZoneDefinition) => void;
  updateZone: (id: string, updates: Partial<ZoneDefinition>) => void;
  removeZone: (id: string) => void;
  selectZone: (id: string | null) => void;

  // 编队操作
  addFormation: (formation: FormationDefinition) => void;
  updateFormation: (id: string, updates: Partial<FormationDefinition>) => void;
  removeFormation: (id: string) => void;
  selectFormation: (id: string | null) => void;

  // 任务操作
  addMission: (mission: MissionDefinition) => void;
  updateMission: (id: string, updates: Partial<MissionDefinition>) => void;
  removeMission: (id: string) => void;
  selectMission: (id: string | null) => void;

  // 航母操作
  loadAircraftToCarrier: (carrierId: string, aircraftId: string) => void;
  launchAircraft: (aircraftId: string, launchPosition?: { lng: number; lat: number }) => void;
  recoverAircraft: (aircraftId: string, carrierId: string) => void;

  // 撤销/重做
  undo: () => void;
  redo: () => void;

  // 工具
  setActiveTool: (tool: EditorTool) => void;
  setRightPanelTab: (tab: 'entities' | 'properties' | 'environment' | 'carriers' | 'formations' | 'missions' | 'collab' | 'comments' | 'chat' | 'validate') => void;
  setPendingPosition: (pos: { lng: number; lat: number } | null) => void;

  // 分支
  loadBranches: () => Promise<void>;
  switchBranch: (branchId: string) => void;
  createBranch: (name: string) => Promise<void>;

  // 装备库
  loadEquipment: () => Promise<void>;
}

const MAX_HISTORY = 50;

/**
 * 编辑动作产生新的 currentScenario 时，把编辑前的版本计入撤销栈并清空重做栈。
 * 仅当 partial 中确实带来了新的 currentScenario 引用时才记录，避免 undo/redo 自身或
 * loadScenario 等场景被重复记录。
 */
function withHistory(
  state: ScenarioEditorState,
  partial: Partial<ScenarioEditorState> & { currentScenario?: Scenario | null }
): Partial<ScenarioEditorState> {
  if (
    !state.currentScenario ||
    !partial.currentScenario ||
    partial.currentScenario === state.currentScenario
  ) {
    return partial;
  }
  return {
    ...partial,
    history: {
      past: [...state.history.past, state.currentScenario].slice(-MAX_HISTORY),
      future: [],
    },
  };
}

export const useScenarioEditorStore = create<ScenarioEditorState>((set, get) => ({
  currentScenario: null,
  loading: false,
  saving: false,
  error: null,
  dirty: false,

  currentBranch: null,
  branches: [],

  activeTool: 'select',

  selectedPlatformId: null,
  selectedRouteId: null,
  selectedZoneId: null,
  selectedFormationId: null,
  selectedMissionId: null,

  equipment: [],
  equipmentLoading: false,

  pendingPosition: null,

  history: { past: [], future: [] },

  rightPanelTab: 'properties',

  loadScenario: async (id) => {
    set({ loading: true, error: null });
    try {
      const scenario = await api.fetchScenario(id);
      const branches = await api.fetchBranches(id);
      const mainBranch = branches.find((b) => b.name === 'main') || branches[0] || null;
      set({
        currentScenario: scenario,
        branches,
        currentBranch: mainBranch,
        loading: false,
        dirty: false,
        history: { past: [], future: [] },
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  clearScenario: () => set({ currentScenario: null, loading: false, dirty: false, error: null }),

  saveScenario: async () => {
    const { currentScenario } = get();
    if (!currentScenario) return;
    set({ saving: true, error: null });
    try {
      const updated = await api.updateScenario(currentScenario.id, currentScenario);
      set({ currentScenario: updated, saving: false, dirty: false });
    } catch (e) {
      set({ error: (e as Error).message, saving: false });
    }
  },

  updateScenarioField: (field, value) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: { ...state.currentScenario, [field]: value },
        dirty: true,
      });
    });
  },

  // 平台操作
  addPlatform: (platform) => {
    set((state) => {
      if (!state.currentScenario) return state;
      if (state.currentScenario.platforms.length >= MAX_PLATFORMS) {
        message.warning(`想定平台数量已达上限（${MAX_PLATFORMS} 个），无法继续添加`);
        return state;
      }
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          platforms: [...state.currentScenario.platforms, platform],
        },
        dirty: true,
      });
    });
  },

  updatePlatform: (id, updates) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          platforms: state.currentScenario.platforms.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        },
        dirty: true,
      });
    });
  },

  removePlatform: (id) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          platforms: state.currentScenario.platforms.filter((p) => p.id !== id),
        },
        dirty: true,
        selectedPlatformId: state.selectedPlatformId === id ? null : state.selectedPlatformId,
      });
    });
  },

  selectPlatform: (id) => set({ selectedPlatformId: id, selectedRouteId: null, selectedZoneId: null, selectedFormationId: null, selectedMissionId: null }),

  // 路线操作
  addRoute: (route) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          routes: [...state.currentScenario.routes, route],
        },
        dirty: true,
      });
    });
  },

  updateRoute: (id, updates) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          routes: state.currentScenario.routes.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        },
        dirty: true,
      });
    });
  },

  removeRoute: (id) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          routes: state.currentScenario.routes.filter((r) => r.id !== id),
        },
        dirty: true,
        selectedRouteId: state.selectedRouteId === id ? null : state.selectedRouteId,
      });
    });
  },

  selectRoute: (id) => set({ selectedRouteId: id, selectedPlatformId: null, selectedZoneId: null, selectedFormationId: null, selectedMissionId: null }),

  // 区域操作
  addZone: (zone) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          zones: [...state.currentScenario.zones, zone],
        },
        dirty: true,
      });
    });
  },

  updateZone: (id, updates) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          zones: state.currentScenario.zones.map((z) =>
            z.id === id ? { ...z, ...updates } : z
          ),
        },
        dirty: true,
      });
    });
  },

  removeZone: (id) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          zones: state.currentScenario.zones.filter((z) => z.id !== id),
        },
        dirty: true,
        selectedZoneId: state.selectedZoneId === id ? null : state.selectedZoneId,
      });
    });
  },

  selectZone: (id) => set({ selectedZoneId: id, selectedPlatformId: null, selectedRouteId: null, selectedFormationId: null, selectedMissionId: null }),

  // 编队操作
  addFormation: (formation) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          formations: [...state.currentScenario.formations, formation],
        },
        dirty: true,
      });
    });
  },

  updateFormation: (id, updates) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          formations: state.currentScenario.formations.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        },
        dirty: true,
      });
    });
  },

  removeFormation: (id) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          formations: state.currentScenario.formations.filter((f) => f.id !== id),
        },
        dirty: true,
        selectedFormationId: state.selectedFormationId === id ? null : state.selectedFormationId,
      });
    });
  },

  selectFormation: (id) => set({ selectedFormationId: id, selectedPlatformId: null, selectedRouteId: null, selectedZoneId: null, selectedMissionId: null }),

  // 任务操作
  addMission: (mission) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          missions: [...state.currentScenario.missions, mission],
        },
        dirty: true,
      });
    });
  },

  updateMission: (id, updates) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          missions: state.currentScenario.missions.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        },
        dirty: true,
      });
    });
  },

  removeMission: (id) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          missions: state.currentScenario.missions.filter((m) => m.id !== id),
        },
        dirty: true,
        selectedMissionId: state.selectedMissionId === id ? null : state.selectedMissionId,
      });
    });
  },

  selectMission: (id) => set({ selectedMissionId: id, selectedPlatformId: null, selectedRouteId: null, selectedZoneId: null, selectedFormationId: null }),

  // 航母操作
  loadAircraftToCarrier: (carrierId, aircraftId) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          platforms: state.currentScenario.platforms.map((p) =>
            p.id === aircraftId ? { ...p, carrierId } : p
          ),
        },
        dirty: true,
      });
    });
  },

  launchAircraft: (aircraftId, launchPosition) => {
    set((state) => {
      if (!state.currentScenario) return state;
      const aircraft = state.currentScenario.platforms.find((p) => p.id === aircraftId);
      if (!aircraft) return state;
      const carrier = aircraft.carrierId
        ? state.currentScenario.platforms.find((p) => p.id === aircraft.carrierId)
        : null;
      const pos = launchPosition ?? carrier?.initialPosition ?? aircraft.initialPosition;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          platforms: state.currentScenario.platforms.map((p) =>
            p.id === aircraftId
              ? {
                  ...p,
                  carrierId: undefined,
                  initialPosition: { lng: pos.lng + 0.01, lat: pos.lat + 0.005 },
                  initialAltitude: 0,
                  initialSpeed: carrier?.initialSpeed ?? 0,
                  creationTime: 0,
                }
              : p
          ),
        },
        dirty: true,
      });
    });
  },

  recoverAircraft: (aircraftId, carrierId) => {
    set((state) => {
      if (!state.currentScenario) return state;
      return withHistory(state, {
        currentScenario: {
          ...state.currentScenario,
          platforms: state.currentScenario.platforms.map((p) =>
            p.id === aircraftId ? { ...p, carrierId } : p
          ),
        },
        dirty: true,
      });
    });
  },

  undo: () => {
    set((state) => {
      const { past, future } = state.history;
      if (past.length === 0 || !state.currentScenario) return state;
      const previous = past[past.length - 1];
      return {
        currentScenario: previous,
        history: { past: past.slice(0, -1), future: [state.currentScenario, ...future] },
        dirty: true,
      };
    });
  },

  redo: () => {
    set((state) => {
      const { past, future } = state.history;
      if (future.length === 0 || !state.currentScenario) return state;
      const next = future[0];
      return {
        currentScenario: next,
        history: { past: [...past, state.currentScenario], future: future.slice(1) },
        dirty: true,
      };
    });
  },

  setActiveTool: (activeTool) => set({ activeTool }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
  setPendingPosition: (pendingPosition) => set({ pendingPosition }),

  // 分支
  loadBranches: async () => {
    const { currentScenario } = get();
    if (!currentScenario) return;
    try {
      const branches = await api.fetchBranches(currentScenario.id);
      set({ branches });
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
  },

  switchBranch: (branchId) => {
    const { branches } = get();
    const branch = branches.find((b) => b.id === branchId);
    if (branch) {
      set({ currentBranch: branch });
    }
  },

  createBranch: async (name) => {
    const { currentScenario, currentBranch } = get();
    if (!currentScenario) return;
    try {
      const newBranch = await api.createBranch(
        currentScenario.id,
        name,
        currentBranch?.id
      );
      set((state) => ({
        branches: [...state.branches, newBranch],
        currentBranch: newBranch,
      }));
    } catch (e) {
      console.error('Failed to create branch:', e);
    }
  },

  // 装备库
  loadEquipment: async () => {
    set({ equipmentLoading: true });
    try {
      const equipment = await api.fetchEquipmentList();
      set({ equipment, equipmentLoading: false });
    } catch (e) {
      set({ equipmentLoading: false });
      console.error('Failed to load equipment:', e);
    }
  },
}));

// ============ 协同状态 ============

interface CollabState {
  onlineUsers: Collaborator[];
  comments: ScenarioComment[];
  chatMessages: ChatMessage[];
  lockedObjects: Map<string, { userId: string; userName: string }>;

  loadComments: (scenarioId: string) => Promise<void>;
  addComment: (comment: Omit<ScenarioComment, 'id' | 'createdAt' | 'replies'>) => Promise<void>;
  loadChat: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  lockObject: (objectId: string, userId: string, userName: string) => void;
  unlockObject: (objectId: string) => void;
  isObjectLocked: (objectId: string) => boolean;
  getLockHolder: (objectId: string) => { userId: string; userName: string } | undefined;
}

export const useCollabStore = create<CollabState>((set, get) => ({
  onlineUsers: [],
  comments: [],
  chatMessages: [],
  lockedObjects: new Map(),

  loadComments: async (scenarioId) => {
    try {
      const comments = await api.fetchComments(scenarioId);
      set({ comments });
    } catch (e) {
      console.error('Failed to load comments:', e);
    }
  },

  addComment: async (comment) => {
    try {
      const newComment = await api.addComment(comment);
      set((state) => ({
        comments: [...state.comments, newComment],
      }));
    } catch (e) {
      console.error('Failed to add comment:', e);
    }
  },

  loadChat: async () => {
    try {
      const chatMessages = await api.fetchChatMessages();
      set({ chatMessages });
    } catch (e) {
      console.error('Failed to load chat:', e);
    }
  },

  sendMessage: async (content) => {
    try {
      const msg = await api.sendChatMessage(content);
      set((state) => ({
        chatMessages: [...state.chatMessages, msg],
      }));
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  },

  lockObject: (objectId, userId, userName) => {
    set((state) => {
      const newMap = new Map(state.lockedObjects);
      newMap.set(objectId, { userId, userName });
      return { lockedObjects: newMap };
    });
  },

  unlockObject: (objectId) => {
    set((state) => {
      const newMap = new Map(state.lockedObjects);
      newMap.delete(objectId);
      return { lockedObjects: newMap };
    });
  },

  isObjectLocked: (objectId) => {
    return get().lockedObjects.has(objectId);
  },

  getLockHolder: (objectId) => {
    return get().lockedObjects.get(objectId);
  },
}));
