/**
 * 共享基础类型定义
 * 消除 map-engine、map-data、layer 模块间的类型重复
 */

// ============ 坐标类型 ============

export interface LngLat {
  lng: number;
  lat: number;
}

export interface LngLatAlt extends LngLat {
  alt: number;
}

export interface LngLatBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

// ============ 通用结果类型 ============

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ============ 分页 ============

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============ 时间范围 ============

export interface TimeRange {
  start: number;
  end: number;
}

// ============ 实体引用 ============

export interface EntityRef {
  type: 'platform' | 'weapon' | 'track' | 'sensor' | 'zone' | 'route';
  index: number;
  name?: string;
}
