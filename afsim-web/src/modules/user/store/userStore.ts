// ============================================================
// User Module - Zustand Store
// 用户认证与管理状态中心
// ============================================================

import { create } from 'zustand';
import type {
  User,
  UserGroup,
  LoginCredentials,
  CreateUserForm,
  UpdateUserForm,
  RolePermission,
  SystemRole,
} from '../types';
import { authApi } from '../api/authApi';

// ============ Auth Store ============

interface AuthState {
  token: string | null;
  currentUser: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  login: (creds: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('truesim:auth:token'),
  currentUser: null,
  isAuthenticated: false,
  loading: !!localStorage.getItem('truesim:auth:token'), // true if token exists, so RequireAuth waits
  error: null,

  login: async (creds) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.login(creds);
      if (result.success && result.token && result.user) {
        localStorage.setItem('truesim:auth:token', result.token);
        // Also set the role for the plugin system
        localStorage.setItem('truesim:role', result.user.role);
        set({
          token: result.token,
          currentUser: result.user,
          isAuthenticated: true,
          loading: false,
        });
        return true;
      } else {
        set({ loading: false, error: result.message || '登录失败' });
        return false;
      }
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      return false;
    }
  },

  logout: async () => {
    const { token } = get();
    if (token) {
      try { await authApi.logout(); } catch { /* ignore */ }
    }
    localStorage.removeItem('truesim:auth:token');
    set({ token: null, currentUser: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const token = localStorage.getItem('truesim:auth:token');
    if (!token) return;

    set({ loading: true });
    try {
      const user = await authApi.getCurrentUser(token);
      if (user) {
        set({ token, currentUser: user, isAuthenticated: true, loading: false });
      } else {
        localStorage.removeItem('truesim:auth:token');
        set({ token: null, loading: false });
      }
    } catch {
      localStorage.removeItem('truesim:auth:token');
      set({ token: null, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

// ============ User Management Store ============

interface UserManagementState {
  users: User[];
  groups: UserGroup[];
  permissions: RolePermission[];
  loading: boolean;
  error: string | null;

  fetchUsers: () => Promise<void>;
  fetchGroups: () => Promise<void>;
  fetchPermissions: () => Promise<void>;
  createUser: (form: CreateUserForm) => Promise<void>;
  updateUser: (id: string, form: UpdateUserForm) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetPassword: (id: string, newPassword: string) => Promise<void>;
  createGroup: (group: Omit<UserGroup, 'id' | 'memberCount' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateGroup: (id: string, updates: Partial<UserGroup>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
}

export const useUserManagementStore = create<UserManagementState>((set, get) => ({
  users: [],
  groups: [],
  permissions: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const users = await authApi.listUsers();
      set({ users, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  fetchGroups: async () => {
    try {
      const groups = await authApi.listGroups();
      set({ groups });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchPermissions: async () => {
    try {
      const permissions = await authApi.getPermissions();
      set({ permissions });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  createUser: async (form) => {
    set({ loading: true, error: null });
    try {
      await authApi.createUser(form);
      await get().fetchUsers();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  updateUser: async (id, form) => {
    set({ loading: true, error: null });
    try {
      await authApi.updateUser(id, form);
      await get().fetchUsers();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  deleteUser: async (id) => {
    set({ loading: true, error: null });
    try {
      await authApi.deleteUser(id);
      await get().fetchUsers();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  resetPassword: async (id, newPassword) => {
    try {
      await authApi.resetPassword(id, newPassword);
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  createGroup: async (group) => {
    try {
      await authApi.createGroup(group);
      await get().fetchGroups();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  updateGroup: async (id, updates) => {
    try {
      await authApi.updateGroup(id, updates);
      await get().fetchGroups();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  deleteGroup: async (id) => {
    try {
      await authApi.deleteGroup(id);
      await get().fetchGroups();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));
