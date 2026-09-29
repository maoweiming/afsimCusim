// ============================================================
// Equipment Module - Entry Point
// ============================================================

// Components
export { EquipmentList } from './components/EquipmentList';
export { EquipmentDetail } from './components/EquipmentDetail';
export { EquipmentEditor } from './components/EquipmentEditor';
export { EquipmentEditForm } from './components/EquipmentEditForm';
export { EquipmentImportExport } from './components/EquipmentImportExport';
export { EquipmentVersionHistory } from './components/EquipmentVersionHistory';
export { ExportDialog } from './components/ExportDialog';
export { ImportDialog } from './components/ImportDialog';

// Store
export { useEquipmentStore } from './store/equipmentStore';

// API
export { equipmentApi } from './api/equipmentApi';
export type { VersionRecord, VersionDiff, LockInfo } from './api/equipmentApi';

// Types
export type {
  EquipmentQueryParams,
  EquipmentListResponse,
} from './types';

export { createEmptyEquipment } from './types';

// AFSIM types (source of truth)
export type { AfsimEquipment, AfsimPlatform } from './afsim/types';
