import { create } from 'zustand';
import type {
  DataItem,
  DataStats,
  ActivityLog,
  VersionRecord,
  LifecycleEvent,
  ImportJob,
  QualityReport,
} from '../types';
import { dataCenterApi } from '../api/dataCenterApi';

// 默认走 mock；设置 VITE_USE_MOCK=false 后从 data-platform 拉取真实数据
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// ============ Mock Data ============

const mockActivities: ActivityLog[] = [
  {
    id: 'act-001',
    userId: 'u-001',
    userName: '张伟',
    action: '创建',
    targetType: '想定',
    targetName: '东海防御演练 v3.2',
    timestamp: '2026-04-28T09:15:00Z',
  },
  {
    id: 'act-002',
    userId: 'u-002',
    userName: '李娜',
    action: '发布',
    targetType: '装备',
    targetName: '歼-20隐身战斗机',
    timestamp: '2026-04-28T08:42:00Z',
  },
  {
    id: 'act-003',
    userId: 'u-003',
    userName: '王强',
    action: '仿真运行',
    targetType: '仿真',
    targetName: '红蓝对抗-2026春季',
    timestamp: '2026-04-28T07:30:00Z',
  },
  {
    id: 'act-004',
    userId: 'u-001',
    userName: '张伟',
    action: '修改',
    targetType: '想定',
    targetName: '台海应急想定 v1.8',
    timestamp: '2026-04-27T16:20:00Z',
  },
  {
    id: 'act-005',
    userId: 'u-004',
    userName: '赵敏',
    action: '归档',
    targetType: '回放',
    targetName: '2026-Q1联合作战复盘',
    timestamp: '2026-04-27T14:55:00Z',
  },
  {
    id: 'act-006',
    userId: 'u-002',
    userName: '李娜',
    action: '导入',
    targetType: '装备',
    targetName: '055型驱逐舰参数包',
    timestamp: '2026-04-27T11:10:00Z',
  },
  {
    id: 'act-007',
    userId: 'u-005',
    userName: '陈刚',
    action: '审核通过',
    targetType: '想定',
    targetName: '南海巡逻想定 v2.1',
    timestamp: '2026-04-26T17:40:00Z',
  },
  {
    id: 'act-008',
    userId: 'u-003',
    userName: '王强',
    action: '创建',
    targetType: '仿真',
    targetName: '防空火力测试-批次3',
    timestamp: '2026-04-26T10:25:00Z',
  },
];

const mockDataItems: DataItem[] = [
  // 装备
  {
    id: 'eq-001',
    name: '歼-20隐身战斗机',
    type: 'equipment',
    version: '3.1.0',
    status: 'published',
    createdBy: '李娜',
    createdAt: '2025-12-10T08:00:00Z',
    updatedAt: '2026-04-28T08:42:00Z',
    size: 2450000,
    tags: ['空军', '五代机', '隐身'],
  },
  {
    id: 'eq-002',
    name: '055型驱逐舰',
    type: 'equipment',
    version: '2.4.0',
    status: 'published',
    createdBy: '李娜',
    createdAt: '2025-11-05T10:00:00Z',
    updatedAt: '2026-04-27T11:10:00Z',
    size: 3200000,
    tags: ['海军', '驱逐舰', '万吨级'],
  },
  {
    id: 'eq-003',
    name: '东风-26弹道导弹',
    type: 'equipment',
    version: '1.8.0',
    status: 'published',
    createdBy: '王强',
    createdAt: '2026-01-20T14:00:00Z',
    updatedAt: '2026-03-15T09:30:00Z',
    size: 1800000,
    tags: ['火箭军', '弹道导弹', '中远程'],
  },
  {
    id: 'eq-004',
    name: '空警-500预警机',
    type: 'equipment',
    version: '2.0.0',
    status: 'review',
    createdBy: '张伟',
    createdAt: '2026-02-18T11:00:00Z',
    updatedAt: '2026-04-20T15:00:00Z',
    size: 2100000,
    tags: ['空军', '预警机', '雷达'],
  },
  {
    id: 'eq-005',
    name: '99A主战坦克',
    type: 'equipment',
    version: '4.2.0',
    status: 'published',
    createdBy: '陈刚',
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2026-02-28T16:00:00Z',
    size: 1500000,
    tags: ['陆军', '坦克', '主战'],
  },
  {
    id: 'eq-006',
    name: '鹰击-21反舰导弹',
    type: 'equipment',
    version: '1.2.0',
    status: 'draft',
    createdBy: '赵敏',
    createdAt: '2026-04-01T13:00:00Z',
    updatedAt: '2026-04-25T10:00:00Z',
    size: 980000,
    tags: ['海军', '反舰导弹', '高超音速'],
  },
  // 想定
  {
    id: 'sc-001',
    name: '东海防御演练 v3.2',
    type: 'scenario',
    version: '3.2.0',
    status: 'published',
    createdBy: '张伟',
    createdAt: '2025-10-15T08:00:00Z',
    updatedAt: '2026-04-28T09:15:00Z',
    size: 8500000,
    tags: ['东海', '防御', '联合'],
  },
  {
    id: 'sc-002',
    name: '台海应急想定 v1.8',
    type: 'scenario',
    version: '1.8.0',
    status: 'review',
    createdBy: '张伟',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-04-27T16:20:00Z',
    size: 12000000,
    tags: ['台海', '应急', '两栖'],
  },
  {
    id: 'sc-003',
    name: '南海巡逻想定 v2.1',
    type: 'scenario',
    version: '2.1.0',
    status: 'published',
    createdBy: '李娜',
    createdAt: '2025-08-20T14:00:00Z',
    updatedAt: '2026-04-26T17:40:00Z',
    size: 6200000,
    tags: ['南海', '巡逻', '常态化'],
  },
  {
    id: 'sc-004',
    name: '高原山地作战想定',
    type: 'scenario',
    version: '1.0.0',
    status: 'draft',
    createdBy: '陈刚',
    createdAt: '2026-04-15T09:00:00Z',
    updatedAt: '2026-04-22T11:00:00Z',
    size: 4800000,
    tags: ['高原', '山地', '陆军'],
  },
  // 仿真
  {
    id: 'sim-001',
    name: '红蓝对抗-2026春季',
    type: 'simulation',
    version: '1.0.0',
    status: 'published',
    createdBy: '王强',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-04-28T07:30:00Z',
    size: 45000000,
    tags: ['对抗', '红蓝', '季度'],
  },
  {
    id: 'sim-002',
    name: '防空火力测试-批次3',
    type: 'simulation',
    version: '1.0.0',
    status: 'draft',
    createdBy: '王强',
    createdAt: '2026-04-26T10:25:00Z',
    updatedAt: '2026-04-26T10:25:00Z',
    size: 18000000,
    tags: ['防空', '火力', '测试'],
  },
  {
    id: 'sim-003',
    name: '联合反潜演习仿真',
    type: 'simulation',
    version: '2.1.0',
    status: 'published',
    createdBy: '赵敏',
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: '2026-04-10T14:00:00Z',
    size: 32000000,
    tags: ['反潜', '联合', '海军'],
  },
  // 回放
  {
    id: 'rp-001',
    name: '2026-Q1联合作战复盘',
    type: 'replay',
    version: '1.0.0',
    status: 'archived',
    createdBy: '赵敏',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-04-27T14:55:00Z',
    size: 120000000,
    tags: ['复盘', '季度', '联合'],
  },
  {
    id: 'rp-002',
    name: '东海防御演练回放-0425',
    type: 'replay',
    version: '1.0.0',
    status: 'published',
    createdBy: '张伟',
    createdAt: '2026-04-25T18:00:00Z',
    updatedAt: '2026-04-25T18:00:00Z',
    size: 85000000,
    tags: ['回放', '东海', '防御'],
  },
];

const mockVersions: VersionRecord[] = [
  {
    id: 'ver-001',
    dataItemId: 'sc-001',
    version: '3.2.0',
    author: '张伟',
    message: '更新蓝方航母编队配置，增加预警机巡逻路线',
    createdAt: '2026-04-28T09:15:00Z',
    changes: [
      { field: 'platforms', oldValue: '18个平台', newValue: '22个平台' },
      { field: 'routes', oldValue: '12条路线', newValue: '15条路线' },
    ],
    size: 8500000,
  },
  {
    id: 'ver-002',
    dataItemId: 'sc-001',
    version: '3.1.0',
    author: '张伟',
    message: '调整红方岸基导弹部署位置',
    createdAt: '2026-04-15T14:30:00Z',
    changes: [
      { field: 'platforms[5].position', oldValue: '122.5E, 30.2N', newValue: '122.8E, 30.0N' },
    ],
    size: 8200000,
  },
  {
    id: 'ver-003',
    dataItemId: 'sc-001',
    version: '3.0.0',
    author: '李娜',
    message: '重大更新：引入新装备型号，重构威胁区域',
    createdAt: '2026-03-20T10:00:00Z',
    changes: [
      { field: 'equipment', oldValue: '歼-16/苏-30', newValue: '歼-20/歼-16' },
      { field: 'zones', oldValue: '3个区域', newValue: '6个区域' },
      { field: 'terrain', oldValue: '默认地形', newValue: '高精度东海地形' },
    ],
    size: 7800000,
  },
  {
    id: 'ver-004',
    dataItemId: 'sc-001',
    version: '2.5.0',
    author: '张伟',
    message: '增加电子对抗场景',
    createdAt: '2026-02-10T16:00:00Z',
    changes: [
      { field: 'sensors', oldValue: '基础传感器', newValue: '增加ECM/ECCM' },
    ],
    size: 6500000,
  },
  {
    id: 'ver-005',
    dataItemId: 'sc-001',
    version: '2.0.0',
    author: '王强',
    message: '重构想定结构，分离红蓝双方配置',
    createdAt: '2026-01-05T09:00:00Z',
    changes: [
      { field: 'structure', oldValue: '单一配置', newValue: '红蓝分离配置' },
    ],
    size: 5200000,
  },
];

const mockLifecycleEvents: LifecycleEvent[] = [
  {
    id: 'lc-001',
    dataItemId: 'sc-001',
    fromStatus: null,
    toStatus: 'draft',
    operator: 'u-001',
    operatorName: '张伟',
    comment: '创建东海防御演练想定',
    timestamp: '2025-10-15T08:00:00Z',
  },
  {
    id: 'lc-002',
    dataItemId: 'sc-001',
    fromStatus: 'draft',
    toStatus: 'review',
    operator: 'u-001',
    operatorName: '张伟',
    comment: '提交审核，v2.0版本',
    timestamp: '2026-01-10T10:00:00Z',
  },
  {
    id: 'lc-003',
    dataItemId: 'sc-001',
    fromStatus: 'review',
    toStatus: 'published',
    operator: 'u-005',
    operatorName: '陈刚',
    comment: '审核通过，符合战术规范',
    timestamp: '2026-01-15T14:00:00Z',
  },
  {
    id: 'lc-004',
    dataItemId: 'sc-001',
    fromStatus: 'published',
    toStatus: 'review',
    operator: 'u-001',
    operatorName: '张伟',
    comment: '提交v3.2重大更新审核',
    timestamp: '2026-04-27T16:00:00Z',
  },
  {
    id: 'lc-005',
    dataItemId: 'sc-001',
    fromStatus: 'review',
    toStatus: 'published',
    operator: 'u-005',
    operatorName: '陈刚',
    comment: 'v3.2审核通过',
    timestamp: '2026-04-28T09:00:00Z',
  },
];

const mockQualityReport: QualityReport = {
  totalItems: mockDataItems.length,
  completeItems: 10,
  incompleteItems: 3,
  duplicateItems: 1,
  outdatedItems: 2,
  score: 78,
  issues: [
    {
      id: 'qi-001',
      severity: 'high',
      description: '3个装备缺少传感器参数定义',
      affectedItems: 3,
    },
    {
      id: 'qi-002',
      severity: 'medium',
      description: '2个想定超过90天未更新',
      affectedItems: 2,
    },
    {
      id: 'qi-003',
      severity: 'low',
      description: '1个想定名称存在重复',
      affectedItems: 1,
    },
  ],
};

// ============ 统计计算 ============

function computeStats(items: DataItem[], recentActivity: ActivityLog[]): DataStats {
  return {
    totalEquipment: items.filter((i) => i.type === 'equipment').length,
    totalScenarios: items.filter((i) => i.type === 'scenario').length,
    totalSimulations: items.filter((i) => i.type === 'simulation').length,
    totalReplays: items.filter((i) => i.type === 'replay').length,
    storageUsed: items.reduce((sum, i) => sum + (i.size ?? 0), 0),
    recentActivity,
  };
}

// ============ Store Interface ============

interface DataCenterState {
  // Data
  dataItems: DataItem[];
  stats: DataStats;
  versions: VersionRecord[];
  lifecycleEvents: LifecycleEvent[];
  importJobs: ImportJob[];
  qualityReport: QualityReport;

  // Loading state（对接 data-platform）
  loading: boolean;
  loaded: boolean;
  loadError: string | null;
  loadItems: () => Promise<void>;

  // Filters
  typeFilter: DataItem['type'] | 'all';
  statusFilter: DataItem['status'] | 'all';
  searchQuery: string;

  // Selected items
  selectedItems: string[];
  selectedItemId: string | null;

  // Actions
  setTypeFilter: (type: DataItem['type'] | 'all') => void;
  setStatusFilter: (status: DataItem['status'] | 'all') => void;
  setSearchQuery: (query: string) => void;
  selectItem: (id: string | null) => void;
  toggleItemSelection: (id: string) => void;
  selectAllItems: () => void;
  clearSelection: () => void;

  // Batch operations
  batchPublish: () => void;
  batchArchive: () => void;
  batchDelete: () => void;

  // Computed
  getFilteredItems: () => DataItem[];
  getItemVersions: (itemId: string) => VersionRecord[];
  getItemLifecycle: (itemId: string) => LifecycleEvent[];
}

export const useDataCenterStore = create<DataCenterState>((set, get) => ({
  dataItems: mockDataItems,
  stats: computeStats(mockDataItems, mockActivities),
  versions: mockVersions,
  lifecycleEvents: mockLifecycleEvents,
  importJobs: [],
  qualityReport: mockQualityReport,

  loading: false,
  loaded: false,
  loadError: null,

  loadItems: async () => {
    // mock 模式或正在加载时跳过远程拉取，保留初始 mock 数据
    if (USE_MOCK || get().loading) {
      set({ loaded: true });
      return;
    }
    set({ loading: true, loadError: null });
    try {
      const items = await dataCenterApi.fetchDataItems();
      set({
        dataItems: items,
        stats: computeStats(items, get().stats.recentActivity),
        loading: false,
        loaded: true,
        loadError: null,
      });
    } catch (err) {
      // 拉取失败：保留现有数据（mock 降级），记录错误
      set({
        loading: false,
        loaded: true,
        loadError: err instanceof Error ? err.message : '数据加载失败',
      });
    }
  },

  typeFilter: 'all',
  statusFilter: 'all',
  searchQuery: '',

  selectedItems: [],
  selectedItemId: null,

  setTypeFilter: (type) => set({ typeFilter: type }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectItem: (id) => set({ selectedItemId: id }),
  toggleItemSelection: (id) =>
    set((state) => ({
      selectedItems: state.selectedItems.includes(id)
        ? state.selectedItems.filter((i) => i !== id)
        : [...state.selectedItems, id],
    })),
  selectAllItems: () =>
    set((state) => ({
      selectedItems: state.getFilteredItems().map((i) => i.id),
    })),
  clearSelection: () => set({ selectedItems: [] }),

  batchPublish: () =>
    set((state) => ({
      dataItems: state.dataItems.map((item) =>
        state.selectedItems.includes(item.id) ? { ...item, status: 'published' } : item
      ),
      selectedItems: [],
    })),

  batchArchive: () =>
    set((state) => ({
      dataItems: state.dataItems.map((item) =>
        state.selectedItems.includes(item.id) ? { ...item, status: 'archived' } : item
      ),
      selectedItems: [],
    })),

  batchDelete: () =>
    set((state) => ({
      dataItems: state.dataItems.filter((item) => !state.selectedItems.includes(item.id)),
      selectedItems: [],
    })),

  getFilteredItems: () => {
    const { dataItems, typeFilter, statusFilter, searchQuery } = get();
    return dataItems.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  },

  getItemVersions: (itemId) => {
    return get().versions.filter((v) => v.dataItemId === itemId);
  },

  getItemLifecycle: (itemId) => {
    return get().lifecycleEvents.filter((e) => e.dataItemId === itemId);
  },
}));
