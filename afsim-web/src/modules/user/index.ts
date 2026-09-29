// ============================================================
// User Module - Entry Point
// ============================================================

// Components
export { UserManagement } from './components/UserManagement';

// Store
export { useAuthStore, useUserManagementStore } from './store/userStore';

// API
export { authApi } from './api/authApi';

// Types
export type {
  User,
  UserGroup,
  SystemRole,
  UserStatus,
  LoginCredentials,
  LoginResult,
  CreateUserForm,
  UpdateUserForm,
  RolePermission,
} from './types';

export {
  SYSTEM_ROLES,
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLE_COLORS,
  USER_STATUSES,
  USER_STATUS_LABELS,
  USER_STATUS_COLORS,
  DEFAULT_PERMISSIONS,
} from './types';
