// ============================================================
// User Module - Auth API
// 认证与用户管理 REST API（含 mock 降级）
// ============================================================

import type {
  User,
  UserGroup,
  LoginCredentials,
  LoginResult,
  CreateUserForm,
  UpdateUserForm,
  RolePermission,
} from '../types';

const API_BASE = import.meta.env.VITE_DATA_API_URL || 'http://localhost:8080/api/v1';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'; // default to mock

// ============ Mock Data ============

const MOCK_USERS: User[] = [
  {
    id: 'u-001',
    username: 'admin',
    displayName: '系统管理员',
    email: 'admin@truesim.local',
    role: 'admin',
    groupId: 'g-001',
    status: 'active',
    department: '系统管理部',
    lastLoginAt: new Date().toISOString(),
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-04-28T10:00:00Z',
    createdBy: 'system',
  },
  {
    id: 'u-002',
    username: 'operator1',
    displayName: '张伟',
    email: 'zhangwei@truesim.local',
    role: 'operator',
    groupId: 'g-002',
    status: 'active',
    department: '作战指挥中心',
    phone: '13800001001',
    lastLoginAt: '2025-04-27T14:30:00Z',
    createdAt: '2025-02-15T00:00:00Z',
    updatedAt: '2025-04-27T14:30:00Z',
    createdBy: 'u-001',
  },
  {
    id: 'u-003',
    username: 'operator2',
    displayName: '李强',
    email: 'liqiang@truesim.local',
    role: 'operator',
    groupId: 'g-002',
    status: 'active',
    department: '作战指挥中心',
    phone: '13800001002',
    lastLoginAt: '2025-04-26T09:15:00Z',
    createdAt: '2025-02-15T00:00:00Z',
    updatedAt: '2025-04-26T09:15:00Z',
    createdBy: 'u-001',
  },
  {
    id: 'u-004',
    username: 'analyst1',
    displayName: '王芳',
    email: 'wangfang@truesim.local',
    role: 'analyst',
    groupId: 'g-003',
    status: 'active',
    department: '数据分析室',
    phone: '13800001003',
    lastLoginAt: '2025-04-28T08:00:00Z',
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-04-28T08:00:00Z',
    createdBy: 'u-001',
  },
  {
    id: 'u-005',
    username: 'viewer1',
    displayName: '赵敏',
    email: 'zhaomin@truesim.local',
    role: 'viewer',
    groupId: 'g-004',
    status: 'active',
    department: '观摩团',
    lastLoginAt: '2025-04-25T16:00:00Z',
    createdAt: '2025-03-10T00:00:00Z',
    updatedAt: '2025-04-25T16:00:00Z',
    createdBy: 'u-001',
  },
  {
    id: 'u-006',
    username: 'operator3',
    displayName: '刘洋',
    email: 'liuyang@truesim.local',
    role: 'operator',
    groupId: 'g-002',
    status: 'disabled',
    department: '作战指挥中心',
    lastLoginAt: '2025-04-10T11:00:00Z',
    createdAt: '2025-02-20T00:00:00Z',
    updatedAt: '2025-04-20T00:00:00Z',
    createdBy: 'u-001',
  },
];

const MOCK_GROUPS: UserGroup[] = [
  { id: 'g-001', name: '系统管理组', description: '负责系统配置和用户管理', defaultRole: 'admin', memberCount: 1, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 'g-002', name: '作战指挥组', description: '负责仿真运行和想定编辑', defaultRole: 'operator', memberCount: 3, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-02-15T00:00:00Z' },
  { id: 'g-003', name: '数据分析组', description: '负责仿真数据分析和报告', defaultRole: 'analyst', memberCount: 1, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z' },
  { id: 'g-004', name: '观摩组', description: '只读访问权限', defaultRole: 'viewer', memberCount: 1, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-03-10T00:00:00Z' },
];

// Mock password store (username -> password)
const MOCK_PASSWORDS: Record<string, string> = {
  admin: 'admin123',
  operator1: 'op123',
  operator2: 'op123',
  analyst1: 'an123',
  viewer1: 'vi123',
  operator3: 'op123',
};

let mockTokenCounter = 1000;

// ============ Helper ============

async function tryFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============ Auth API ============

export const authApi = {
  /** 登录 */
  async login(creds: LoginCredentials): Promise<LoginResult> {
    if (!USE_MOCK) {
      try {
        return await tryFetch<LoginResult>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(creds),
        });
      } catch { /* fallback */ }
    }

    // Mock login
    const user = MOCK_USERS.find((u) => u.username === creds.username);
    if (!user) return { success: false, message: '用户不存在' };
    if (user.status === 'disabled') return { success: false, message: '账号已禁用' };
    if (user.status === 'locked') return { success: false, message: '账号已锁定' };

    const expectedPwd = MOCK_PASSWORDS[creds.username];
    if (expectedPwd && creds.password !== expectedPwd) {
      return { success: false, message: '密码错误' };
    }

    // Accept any password if not in mock password store
    const token = `mock-token-${++mockTokenCounter}-${Date.now()}`;
    user.lastLoginAt = new Date().toISOString();
    return { success: true, token, user: { ...user } };
  },

  /** 登出 */
  async logout(): Promise<void> {
    if (!USE_MOCK) {
      try { await tryFetch('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    }
    // Mock: nothing to do
  },

  /** 获取当前用户信息 */
  async getCurrentUser(token: string): Promise<User | null> {
    if (!USE_MOCK) {
      try {
        return await tryFetch<User>('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* fallback */ }
    }

    // Mock: extract user from token (token format: mock-token-{id}-{timestamp})
    const parts = token.split('-');
    if (parts[0] === 'mock' && parts[1] === 'token') {
      const idNum = parseInt(parts[2], 10);
      const idx = idNum - 1001;
      if (idx >= 0 && idx < MOCK_USERS.length) return { ...MOCK_USERS[idx] };
    }
    return null;
  },

  /** 获取用户列表 */
  async listUsers(): Promise<User[]> {
    if (!USE_MOCK) {
      try { return await tryFetch<User[]>('/users'); } catch { /* fallback */ }
    }
    return MOCK_USERS.map((u) => ({ ...u }));
  },

  /** 获取单个用户 */
  async getUser(id: string): Promise<User | null> {
    if (!USE_MOCK) {
      try { return await tryFetch<User>(`/users/${id}`); } catch { /* fallback */ }
    }
    const user = MOCK_USERS.find((u) => u.id === id);
    return user ? { ...user } : null;
  },

  /** 创建用户 */
  async createUser(form: CreateUserForm): Promise<User> {
    if (!USE_MOCK) {
      try {
        return await tryFetch<User>('/users', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      } catch { /* fallback */ }
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: `u-${String(MOCK_USERS.length + 1).padStart(3, '0')}`,
      username: form.username,
      displayName: form.displayName,
      email: form.email,
      role: form.role,
      groupId: form.groupId || null,
      status: 'active',
      phone: form.phone,
      department: form.department,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: 'current-user',
    };
    MOCK_USERS.push(newUser);
    MOCK_PASSWORDS[form.username] = form.password;
    return { ...newUser };
  },

  /** 更新用户 */
  async updateUser(id: string, form: UpdateUserForm): Promise<User> {
    if (!USE_MOCK) {
      try {
        return await tryFetch<User>(`/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } catch { /* fallback */ }
    }

    const idx = MOCK_USERS.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('User not found');
    Object.assign(MOCK_USERS[idx], form, { updatedAt: new Date().toISOString() });
    return { ...MOCK_USERS[idx] };
  },

  /** 删除用户 */
  async deleteUser(id: string): Promise<void> {
    if (!USE_MOCK) {
      try { await tryFetch(`/users/${id}`, { method: 'DELETE' }); } catch { /* fallback */ }
    }
    const idx = MOCK_USERS.findIndex((u) => u.id === id);
    if (idx !== -1) MOCK_USERS.splice(idx, 1);
  },

  /** 重置密码 */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    if (!USE_MOCK) {
      try {
        await tryFetch(`/users/${id}/password`, {
          method: 'PUT',
          body: JSON.stringify({ password: newPassword }),
        });
      } catch { /* fallback */ }
    }
    const user = MOCK_USERS.find((u) => u.id === id);
    if (user) MOCK_PASSWORDS[user.username] = newPassword;
  },

  // ============ 用户组 ============

  /** 获取用户组列表 */
  async listGroups(): Promise<UserGroup[]> {
    if (!USE_MOCK) {
      try { return await tryFetch<UserGroup[]>('/user-groups'); } catch { /* fallback */ }
    }
    return MOCK_GROUPS.map((g) => ({ ...g }));
  },

  /** 创建用户组 */
  async createGroup(group: Omit<UserGroup, 'id' | 'memberCount' | 'createdAt' | 'updatedAt'>): Promise<UserGroup> {
    if (!USE_MOCK) {
      try {
        return await tryFetch<UserGroup>('/user-groups', {
          method: 'POST',
          body: JSON.stringify(group),
        });
      } catch { /* fallback */ }
    }

    const now = new Date().toISOString();
    const newGroup: UserGroup = {
      id: `g-${String(MOCK_GROUPS.length + 1).padStart(3, '0')}`,
      ...group,
      memberCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    MOCK_GROUPS.push(newGroup);
    return { ...newGroup };
  },

  /** 更新用户组 */
  async updateGroup(id: string, updates: Partial<UserGroup>): Promise<UserGroup> {
    if (!USE_MOCK) {
      try {
        return await tryFetch<UserGroup>(`/user-groups/${id}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
      } catch { /* fallback */ }
    }

    const idx = MOCK_GROUPS.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error('Group not found');
    Object.assign(MOCK_GROUPS[idx], updates, { updatedAt: new Date().toISOString() });
    return { ...MOCK_GROUPS[idx] };
  },

  /** 删除用户组 */
  async deleteGroup(id: string): Promise<void> {
    if (!USE_MOCK) {
      try { await tryFetch(`/user-groups/${id}`, { method: 'DELETE' }); } catch { /* fallback */ }
    }
    const idx = MOCK_GROUPS.findIndex((g) => g.id === id);
    if (idx !== -1) MOCK_GROUPS.splice(idx, 1);
  },

  // ============ 权限 ============

  /** 获取角色权限配置 */
  async getPermissions(): Promise<RolePermission[]> {
    if (!USE_MOCK) {
      try { return await tryFetch<RolePermission[]>('/permissions'); } catch { /* fallback */ }
    }
    const { DEFAULT_PERMISSIONS } = await import('../types');
    return DEFAULT_PERMISSIONS.map((p) => ({ ...p }));
  },
};
