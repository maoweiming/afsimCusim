/**
 * Plugin system exports
 */
export type {
  UserRole,
  PluginStorage,
  PluginContext,
  PluginRoute,
  PluginNavItem,
  PluginSidebarPanel,
  PluginLayerContribution,
  PluginDataSource,
  PluginEventSubscription,
  PluginContribution,
  PluginManifest,
  Plugin,
  PluginRegistrationOptions,
  PluginInfo,
} from './types';
export { PluginPhase } from './types';
export { PluginRegistry } from './PluginRegistry';
export { PluginProvider, usePluginRegistry, useActiveContributions, useUserRole, usePluginInfo } from './PluginContext';
export { RoleConfigLoader, type RoleConfig } from './RoleConfigLoader';
