/**
 * 插件系统类型定义
 * 支持按角色动态加载功能模块
 */
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import type { LayerDefinition } from '../layer/types';
import type { DataSource } from '../data-platform/DataBus';

// ============ 角色类型 ============

export type UserRole = 'admin' | 'operator' | 'analyst' | 'viewer';

// ============ 插件生命周期 ============

export enum PluginPhase {
  Registered = 'registered',
  Initialized = 'initialized',
  Active = 'active',
  Inactive = 'inactive',
  Destroyed = 'destroyed',
}

// ============ 插件上下文 ============

export interface PluginStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
}

export interface PluginContext {
  role: UserRole;
  storage: PluginStorage;
}

// ============ 插件贡献 ============

export interface PluginRoute {
  path: string;
  component: LazyExoticComponent<ComponentType>;
  requiresAuth?: boolean;
  children?: PluginRoute[];
}

export interface PluginNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  order: number;
  badge?: number | string;
}

export interface PluginSidebarPanel {
  id: string;
  title: string;
  side: 'left' | 'right';
  order: number;
  component: ComponentType;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface PluginLayerContribution {
  layerDefinition: LayerDefinition;
  presetGroup?: string;
}

export interface PluginDataSource {
  source: DataSource;
  autoConnect?: boolean;
}

export interface PluginEventSubscription {
  topic: string;
  callback: (data: unknown) => void;
  priority?: number;
}

export interface PluginContribution {
  routes?: PluginRoute[];
  navItems?: PluginNavItem[];
  sidebarPanels?: PluginSidebarPanel[];
  layers?: PluginLayerContribution[];
  dataSources?: PluginDataSource[];
  eventSubscriptions?: PluginEventSubscription[];
}

// ============ 插件定义 ============

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  allowedRoles: UserRole[];
  dependencies?: string[];
  icon?: string;
}

export interface Plugin {
  readonly manifest: PluginManifest;
  readonly phase: PluginPhase;

  init(context: PluginContext): Promise<void> | void;
  activate(): PluginContribution;
  deactivate(): void;
  destroy(): void;

  onRoleChange?(newRole: UserRole): void;
}

export interface PluginRegistrationOptions {
  autoInit?: boolean;
  autoActivate?: boolean;
  roleOverride?: UserRole[];
}

export interface PluginInfo {
  id: string;
  manifest: PluginManifest;
  phase: PluginPhase;
}
