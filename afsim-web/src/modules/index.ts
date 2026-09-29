/**
 * 模块统一入口
 *
 * 数据中心模块
 */
export {
  DataDashboard,
  DataLifecycle,
  DataVersion,
  DataExport,
  useDataCenterStore,
} from './data-center';

export type {
  DataItem,
  DataStats,
  ActivityLog,
  VersionRecord,
  VersionChange,
  LifecycleEvent,
  ExportFormat,
  ExportConfig,
  ImportJob,
  QualityReport,
  QualityIssue,
} from './data-center';

/**
 * 仿真功能增强模块
 */
export {
  SensorControl,
  WeaponBrowser,
  TrackHistory,
  ReplayControl,
  CommandChainView,
  PlatformInfoPanel,
} from './simulation';

/**
 * 装备管理模块
 */
export {
  EquipmentList,
  EquipmentDetail,
  EquipmentEditor,
  useEquipmentStore,
} from './equipment';

/**
 * 想定管理模块
 */
export { ScenarioValidator } from './scenario';
