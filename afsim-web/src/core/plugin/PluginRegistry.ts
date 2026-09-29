/**
 * PluginRegistry - 插件注册表单例
 * 管理插件生命周期：注册 → 初始化 → 激活 → 停用 → 销毁
 * 支持按角色自动加载/卸载插件
 */
import type {
  Plugin,
  PluginManifest,
  PluginPhase,
  PluginContext,
  PluginStorage,
  PluginContribution,
  PluginRegistrationOptions,
  PluginInfo,
  UserRole,
} from './types';
import { PluginPhase as Phase } from './types';

export class PluginRegistry {
  private static instance: PluginRegistry | null = null;

  private plugins: Map<string, Plugin> = new Map();
  private contexts: Map<string, PluginContext> = new Map();
  private options: Map<string, PluginRegistrationOptions> = new Map();
  private currentRole: UserRole = 'admin';
  private listeners: Set<() => void> = new Set();
  private version: number = 0;

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  private constructor() {}

  // ============ 注册 ============

  register(plugin: Plugin, opts?: PluginRegistrationOptions): void {
    const id = plugin.manifest.id;
    if (this.plugins.has(id)) {
      console.warn(`[PluginRegistry] Plugin "${id}" already registered, skipping`);
      return;
    }
    this.plugins.set(id, plugin);
    this.options.set(id, opts ?? {});

    if (opts?.autoInit) {
      this.initPlugin(id);
    }
    if (opts?.autoActivate && opts?.autoInit) {
      this.activatePlugin(id);
    }
    this.emit();
  }

  unregister(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    if (plugin.phase === Phase.Active) {
      this.deactivatePlugin(id);
    }
    if (plugin.phase === Phase.Initialized) {
      plugin.destroy();
    }
    this.plugins.delete(id);
    this.contexts.delete(id);
    this.options.delete(id);
    this.emit();
  }

  // ============ 生命周期 ============

  async initPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin || plugin.phase !== Phase.Registered) return;

    const context: PluginContext = {
      role: this.currentRole,
      storage: this.createStorage(id),
    };
    this.contexts.set(id, context);
    await plugin.init(context);
    this.emit();
  }

  activatePlugin(id: string): PluginContribution | null {
    const plugin = this.plugins.get(id);
    if (!plugin || plugin.phase !== Phase.Initialized) return null;

    // 检查角色权限
    const opts = this.options.get(id);
    const allowedRoles = opts?.roleOverride ?? plugin.manifest.allowedRoles;
    if (!allowedRoles.includes(this.currentRole)) {
      return null;
    }

    const contribution = plugin.activate();
    // 缓存 contribution 到插件实例
    (plugin as any)._activeContribution = contribution;
    this.emit();
    return contribution;
  }

  deactivatePlugin(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin || plugin.phase !== Phase.Active) return;
    plugin.deactivate();
    delete (plugin as any)._activeContribution;
    this.emit();
  }

  // ============ 角色管理 ============

  async setRole(role: UserRole): Promise<void> {
    this.currentRole = role;

    // 先停用当前角色不允许的插件
    for (const [id, plugin] of this.plugins) {
      if (plugin.phase === Phase.Active) {
        const opts = this.options.get(id);
        const allowedRoles = opts?.roleOverride ?? plugin.manifest.allowedRoles;
        if (!allowedRoles.includes(role)) {
          this.deactivatePlugin(id);
        } else if (plugin.onRoleChange) {
          plugin.onRoleChange(role);
        }
      }
    }

    // 初始化并激活新角色的插件
    await this.loadPluginsForRole(role);
    this.emit();
  }

  async loadPluginsForRole(role: UserRole): Promise<void> {
    for (const [id, plugin] of this.plugins) {
      const opts = this.options.get(id);
      const allowedRoles = opts?.roleOverride ?? plugin.manifest.allowedRoles;

      if (!allowedRoles.includes(role)) continue;

      // 自动初始化
      if (plugin.phase === Phase.Registered) {
        await this.initPlugin(id);
      }

      // 自动激活
      if (plugin.phase === Phase.Initialized) {
        this.activatePlugin(id);
      }
    }
  }

  // ============ 查询 ============

  getActiveContributions(): PluginContribution {
    const result: PluginContribution = {
      routes: [],
      navItems: [],
      sidebarPanels: [],
      layers: [],
      dataSources: [],
      eventSubscriptions: [],
    };

    for (const [, plugin] of this.plugins) {
      if (plugin.phase !== Phase.Active) continue;

      // 重新激活以获取 contribution（缓存在 plugin 内部）
      // 实际插件应缓存自己的 contribution
      const contrib = (plugin as any)._activeContribution as PluginContribution | undefined;
      if (!contrib) continue;

      if (contrib.routes) result.routes!.push(...contrib.routes);
      if (contrib.navItems) result.navItems!.push(...contrib.navItems);
      if (contrib.sidebarPanels) result.sidebarPanels!.push(...contrib.sidebarPanels);
      if (contrib.layers) result.layers!.push(...contrib.layers);
      if (contrib.dataSources) result.dataSources!.push(...contrib.dataSources);
      if (contrib.eventSubscriptions) result.eventSubscriptions!.push(...contrib.eventSubscriptions);
    }

    // 排序
    result.navItems!.sort((a, b) => a.order - b.order);
    result.sidebarPanels!.sort((a, b) => a.order - b.order);

    return result;
  }

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  getPluginInfo(id: string): PluginInfo | undefined {
    const plugin = this.plugins.get(id);
    if (!plugin) return undefined;
    return {
      id,
      manifest: plugin.manifest,
      phase: plugin.phase,
    };
  }

  getAllPlugins(): PluginInfo[] {
    return Array.from(this.plugins.entries()).map(([id, plugin]) => ({
      id,
      manifest: plugin.manifest,
      phase: plugin.phase,
    }));
  }

  getCurrentRole(): UserRole {
    return this.currentRole;
  }

  // ============ 订阅 ============

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getVersion(): number {
    return this.version;
  }

  private emit(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  // ============ 存储 ============

  private createStorage(pluginId: string): PluginStorage {
    const prefix = `plugin:${pluginId}:`;
    return {
      get<T>(key: string): T | undefined {
        try {
          const raw = localStorage.getItem(prefix + key);
          return raw ? JSON.parse(raw) : undefined;
        } catch {
          return undefined;
        }
      },
      set<T>(key: string, value: T): void {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      },
      remove(key: string): void {
        localStorage.removeItem(prefix + key);
      },
      clear(): void {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(prefix)) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      },
    };
  }

  // ============ 重置（测试用） ============

  static resetInstance(): void {
    if (PluginRegistry.instance) {
      const reg = PluginRegistry.instance;
      for (const [id] of reg.plugins) {
        reg.unregister(id);
      }
      PluginRegistry.instance = null;
    }
  }
}
