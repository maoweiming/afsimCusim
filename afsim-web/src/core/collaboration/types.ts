/**
 * 协同作业类型定义
 * 支持大团队（15+人）的想定协同编辑
 */

import { LngLat } from '../map-engine/MapEngine';

// ============ 用户和会话 ============

export interface CollabUser {
  userId: string;
  userName: string;
  avatar?: string;
  role: CollabRole;
  color: string; // 用户颜色标识（用于光标、选择高亮）
  online: boolean;
  lastActive: Date;
}

export type CollabRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';

export interface CollabSession {
  id: string;
  scenarioId: string;
  branch: string;
  users: CollabUser[];
  createdAt: Date;
}

// ============ 光标和选择同步 ============

export interface CursorState {
  userId: string;
  position: LngLat;
  visible: boolean;
}

export interface SelectionState {
  userId: string;
  selectedIds: string[]; // 实体 ID 列表
}

// ============ 操作转换（OT）============

export type OperationType = 'insert' | 'update' | 'delete' | 'move';

export interface Operation {
  id: string;
  userId: string;
  timestamp: number;
  type: OperationType;
  path: string; // JSON path，如 "platforms[0].position"
  oldValue?: any;
  newValue?: any;
  vectorClock: Record<string, number>; // 向量时钟
}

export interface OperationAck {
  operationId: string;
  success: boolean;
  transformedOps?: Operation[]; // 服务端转换后的操作
  error?: string;
}

// ============ 锁定机制 ============

export type LockType = 'exclusive' | 'shared';

export interface ObjectLock {
  objectId: string;
  objectType: string;
  userId: string;
  userName: string;
  lockType: LockType;
  lockedAt: Date;
  expiresAt?: Date;
}

export interface LockRequest {
  objectId: string;
  objectType: string;
  lockType: LockType;
}

export interface LockResponse {
  success: boolean;
  lock?: ObjectLock;
  error?: string;
  currentHolder?: string;
}

// ============ 版本管理 ============

export interface Branch {
  id: string;
  scenarioId: string;
  name: string;
  parentBranchId?: string;
  createdBy: string;
  createdAt: Date;
  status: 'active' | 'merged' | 'abandoned';
  headCommitId?: string;
}

export interface Commit {
  id: string;
  branchId: string;
  message: string;
  author: string;
  authorName: string;
  timestamp: Date;
  changes: Change[];
  parentCommitId?: string;
}

export type ChangeType = 'add' | 'modify' | 'delete';
export type EntityType = 'platform' | 'route' | 'zone' | 'trigger' | 'terrain' | 'equipment';

export interface Change {
  type: ChangeType;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  before?: any;
  after?: any;
}

// ============ 合并请求 ============

export type MRStatus = 'open' | 'reviewing' | 'approved' | 'merged' | 'closed' | 'conflict';

export interface MergeRequest {
  id: string;
  scenarioId: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  author: string;
  authorName: string;
  status: MRStatus;
  conflicts: Conflict[];
  reviewers: Reviewer[];
  approvals: string[]; // userId 列表
  rejections: string[];
  comments: MRComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Conflict {
  entityType: string;
  entityId: string;
  entityName?: string;
  field: string;
  sourceValue: any;
  targetValue: any;
  resolution?: 'source' | 'target' | 'manual';
  resolvedBy?: string;
  resolvedValue?: any;
}

export interface Reviewer {
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  reviewedAt?: Date;
}

export interface MRComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  parentId?: string; // 回复
  resolved?: boolean;
  position?: {
    entityType: string;
    entityId: string;
    field?: string;
  };
}

// ============ 评论系统 ============

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  parentId?: string;
  position?: LngLat; // 地图上的位置
  entityType?: string;
  entityId?: string;
  resolved: boolean;
  replies?: Comment[];
}

// ============ 协同事件 ============

export type CollabEventType =
  | 'user:join'
  | 'user:leave'
  | 'cursor:move'
  | 'selection:change'
  | 'operation'
  | 'lock:acquired'
  | 'lock:released'
  | 'comment:added'
  | 'comment:resolved'
  | 'branch:created'
  | 'commit:created'
  | 'merge:requested'
  | 'merge:approved'
  | 'merge:completed';

export interface CollabEvent {
  type: CollabEventType;
  userId: string;
  timestamp: number;
  payload: any;
}

// ============ 任务分配 ============

export interface Task {
  id: string;
  scenarioId: string;
  title: string;
  description: string;
  assigneeId?: string;
  assigneeName?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: Date;
  createdAt: Date;
  createdBy: string;
  tags: string[];
}

// ============ 操作历史 ============

export interface OperationHistory {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  timestamp: Date;
  details?: any;
}
