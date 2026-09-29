// ============================================================
// Equipment Module - Type Definitions
//
// AFSIM-native: AfsimEquipment is the sole data model.
// No custom business types — all data comes from AFSIM.
// ============================================================

export type { AfsimEquipment } from './afsim/types';
export { createEmptyEquipment, createEmptyPlatform } from './afsim/types';

// ============ 查询参数 ============

export interface EquipmentQueryParams {
  keyword?: string;
  sortBy?: 'name' | 'parentType' | 'spatialDomain';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// ============ API 响应 ============

import type { AfsimEquipment } from './afsim/types';

export interface EquipmentListResponse {
  data: AfsimEquipment[];
  total: number;
  page: number;
  pageSize: number;
}
