// ============================================================
// User Module - Type Definitions
// 用户管理、分组、角色权限
// ============================================================

// ============ 角色 ============

export type SystemRole = 'admin' | 'operator' | 'analyst' | 'viewer';

export const SYSTEM_ROLES: SystemRole[] = ['admin', 'operator', 'analyst', 'viewer'];

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  admin: '管理员',
  operator: '操作员',
  analyst: '分析师',
  viewer: '观察员',
};

export const SYSTEM_ROLE_COLORS: Record<SystemRole, string> = {
  admin: 'red',
  operator: 'blue',
  analyst: 'green',
  viewer: 'default',
};

export interface RolePermission {
  role: SystemRole;
  label: string;
  description: string;
  modules: string[];       // 可访问的模块 ID
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canManageSystem: boolean;
}

export const DEFAULT_PERMISSIONS: RolePermission[] = [
  {
    role: 'admin',
    label: '管理员',
    description: '系统全部权限，可管理用户和配置',
    modules: ['equipment', 'simulation', 'scenario', 'analysis', 'admin-setting'],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageUsers: true,
    canManageSystem: true,
  },
  {
    role: 'operator',
    label: '操作员',
    description: '仿真运行和装备管理操作权限',
    modules: ['equipment', 'simulation', 'scenario'],
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false,
    canManageSystem: false,
  },
  {
    role: 'analyst',
    label: '分析师',
    description: '数据分析和想定查看权限',
    modules: ['simulation', 'scenario', 'analysis', 'admin-setting'],
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canManageSystem: false,
  },
  {
    role: 'viewer',
    label: '观察员',
    description: '只读权限，仅可查看仿真运行',
    modules: ['simulation'],
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canManageSystem: false,
  },
];

// ============ 用户 ============

export type UserStatus = 'active' | 'disabled' | 'locked';

export const USER_STATUSES: UserStatus[] = ['active', 'disabled', 'locked'];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: '正常',
  disabled: '已禁用',
  locked: '已锁定',
};

export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  active: 'green',
  disabled: 'default',
  locked: 'red',
};

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: SystemRole;
  groupId: string | null;
  status: UserStatus;
  avatar?: string;
  phone?: string;
  department?: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ============ 用户组 ============

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  defaultRole: SystemRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============ 登录 ============

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

// ============ 创建/编辑用户表单 ============

export interface CreateUserForm {
  username: string;
  displayName: string;
  email: string;
  password: string;
  role: SystemRole;
  groupId?: string;
  phone?: string;
  department?: string;
}

export interface UpdateUserForm {
  displayName?: string;
  email?: string;
  role?: SystemRole;
  groupId?: string;
  status?: UserStatus;
  phone?: string;
  department?: string;
}
