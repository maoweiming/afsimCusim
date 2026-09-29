/**
 * RoleConfigLoader - 角色配置加载器
 * 从 JSON 配置文件加载角色的插件和图层预设
 */
import type { UserRole } from './types';

export interface RoleConfig {
  role: UserRole;
  label: string;
  description: string;
  plugins: string[];          // 允许的插件 ID 列表
  defaultPreset: string;      // 默认图层预设 ID
  defaultTheme?: string;      // 默认主题 ID
  restrictions: {
    readOnly?: boolean;
    canAddLayers?: boolean;
    canModifyScenarios?: boolean;
    canControlSimulation?: boolean;
    maxEntities?: number;
  };
}

// 内置角色配置（与 src/config/roles/*.json 对应）
const builtinConfigs: Record<UserRole, RoleConfig> = {
  admin: {
    role: 'admin',
    label: '管理员',
    description: '完全访问权限，可管理所有功能模块',
    plugins: ['sim-globe', 'map-data', 'scenario', 'equipment', 'data-center', 'analysis'],
    defaultPreset: 'admin-full',
    defaultTheme: 'military-default',
    restrictions: {},
  },
  operator: {
    role: 'operator',
    label: '操作员',
    description: '仿真操作和想定管理，可控制仿真流程',
    plugins: ['sim-globe', 'scenario', 'equipment'],
    defaultPreset: 'operator-standard',
    defaultTheme: 'military-default',
    restrictions: {
      canAddLayers: true,
      canModifyScenarios: true,
      canControlSimulation: true,
    },
  },
  analyst: {
    role: 'analyst',
    label: '分析师',
    description: '数据分析和地形评估，只读访问仿真',
    plugins: ['sim-globe', 'map-data', 'analysis', 'data-center'],
    defaultPreset: 'analyst-analysis',
    defaultTheme: 'military-default',
    restrictions: {
      readOnly: true,
      canAddLayers: true,
    },
  },
  viewer: {
    role: 'viewer',
    label: '观察员',
    description: '最小化视图，仅查看仿真态势',
    plugins: ['sim-globe'],
    defaultPreset: 'viewer-minimal',
    defaultTheme: 'military-default',
    restrictions: {
      readOnly: true,
      canAddLayers: false,
      canModifyScenarios: false,
      canControlSimulation: false,
    },
  },
};

export class RoleConfigLoader {
  private static cache: Map<UserRole, RoleConfig> = new Map();

  static getConfig(role: UserRole): RoleConfig {
    if (this.cache.has(role)) {
      return this.cache.get(role)!;
    }

    const config = builtinConfigs[role];
    if (!config) {
      console.warn(`[RoleConfigLoader] Unknown role "${role}", falling back to viewer`);
      return builtinConfigs.viewer;
    }

    this.cache.set(role, config);
    return config;
  }

  static getAllConfigs(): RoleConfig[] {
    return Object.values(builtinConfigs);
  }

  static isPluginAllowed(role: UserRole, pluginId: string): boolean {
    const config = this.getConfig(role);
    return config.plugins.includes(pluginId);
  }

  static hasRestriction(role: UserRole, restriction: keyof RoleConfig['restrictions']): boolean {
    const config = this.getConfig(role);
    return !!config.restrictions[restriction];
  }

  static clearCache(): void {
    this.cache.clear();
  }
}
