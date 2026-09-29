/**
 * 数据中心模块 - 类型定义
 */

// ============ 数据条目 ============

export interface DataItem {
  id: string;
  name: string;
  type: 'equipment' | 'scenario' | 'simulation' | 'replay';
  version: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  size?: number;
  tags: string[];
}

// ============ 数据统计 ============

export interface DataStats {
  totalEquipment: number;
  totalScenarios: number;
  totalSimulations: number;
  totalReplays: number;
  storageUsed: number;
  recentActivity: ActivityLog[];
}

// ============ 活动日志 ============

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetName: string;
  timestamp: string;
}

// ============ 版本记录 ============

export interface VersionRecord {
  id: string;
  dataItemId: string;
  version: string;
  author: string;
  message: string;
  createdAt: string;
  changes: VersionChange[];
  size: number;
}

export interface VersionChange {
  field: string;
  oldValue: string;
  newValue: string;
}

// ============ 生命周期事件 ============

export interface LifecycleEvent {
  id: string;
  dataItemId: string;
  fromStatus: DataItem['status'] | null;
  toStatus: DataItem['status'];
  operator: string;
  operatorName: string;
  comment: string;
  timestamp: string;
}

// ============ 导入导出配置 ============

export type ExportFormat = 'json' | 'csv' | 'xml' | 'excel';

export interface ExportConfig {
  format: ExportFormat;
  dataTypes: DataItem['type'][];
  includeMetadata: boolean;
  compression: boolean;
  filename?: string;
}

export interface ImportJob {
  id: string;
  filename: string;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  importedRecords: number;
  errors: string[];
  createdAt: string;
}

// ============ 数据质量报告 ============

export interface QualityReport {
  totalItems: number;
  completeItems: number;
  incompleteItems: number;
  duplicateItems: number;
  outdatedItems: number;
  score: number; // 0-100
  issues: QualityIssue[];
}

export interface QualityIssue {
  id: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedItems: number;
}
