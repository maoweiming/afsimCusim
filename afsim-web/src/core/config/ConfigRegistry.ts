/**
 * 全局配置注册表
 * 统一的配置驱动模式，替代分散的配置定义
 * 扩展装备模块的 FieldConfig 模式到所有业务领域
 */

import type { ValidationResult, ValidationError } from '../types/common';

// ============ 字段配置 (扩展自 equipment FieldConfig) ============

export interface FieldConfig {
  key: string;           // 数据字段名（支持点号嵌套: 'rcs.frontal'）
  label: string;         // 中文显示标签
  type: 'number' | 'text' | 'select' | 'textarea' | 'boolean' | 'date' | 'json';
  unit?: string;         // 单位后缀
  group: string;         // 分组名
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  colspan?: number;
  tooltip?: string;
  defaultValue?: unknown;
  readonly?: boolean;
  hidden?: boolean;
  validate?: (value: unknown) => string | null;  // 返回错误消息或 null
}

// ============ 配置描述符 ============

export interface ConfigDescriptor<T = any> {
  id: string;                    // 唯一标识: 'equipment.aircraft', 'environment.weather'
  name: string;                  // 显示名称
  version: string;               // 配置版本
  schema: FieldConfig[];         // 字段定义
  defaults: T;                   // 默认值
  groups?: FieldGroup[];         // 字段分组元数据
  validator?: (data: T) => ValidationResult;
}

export interface FieldGroup {
  key: string;
  label: string;
  icon?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  order?: number;
}

// ============ 配置注册表 ============

class ConfigRegistry {
  private configs = new Map<string, ConfigDescriptor>();
  private listeners = new Set<() => void>();

  /** 注册一个配置描述符 */
  register<T>(descriptor: ConfigDescriptor<T>): void {
    if (this.configs.has(descriptor.id)) {
      console.warn(`[ConfigRegistry] Overwriting existing config: ${descriptor.id}`);
    }
    this.configs.set(descriptor.id, descriptor as ConfigDescriptor);
    this.notify();
  }

  /** 注销一个配置 */
  unregister(id: string): void {
    this.configs.delete(id);
    this.notify();
  }

  /** 获取配置描述符 */
  get<T>(id: string): ConfigDescriptor<T> | undefined {
    return this.configs.get(id) as ConfigDescriptor<T> | undefined;
  }

  /** 获取配置描述符（不存在则抛出异常） */
  getRequired<T>(id: string): ConfigDescriptor<T> {
    const desc = this.configs.get(id);
    if (!desc) throw new Error(`[ConfigRegistry] Config not found: ${id}`);
    return desc as ConfigDescriptor<T>;
  }

  /** 创建默认数据实例 */
  createDefault<T>(id: string): T {
    const desc = this.getRequired<T>(id);
    return JSON.parse(JSON.stringify(desc.defaults));
  }

  /** 验证数据 */
  validate<T>(id: string, data: T): ValidationResult {
    const desc = this.getRequired<T>(id);
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 基于 schema 的必填字段验证
    for (const field of desc.schema) {
      if (field.hidden || field.readonly) continue;
      const value = getNestedValue(data as Record<string, unknown>, field.key);

      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: field.key, message: `${field.label} 不能为空`, code: 'required' });
        continue;
      }

      if (value === undefined || value === null) continue;

      // 类型验证
      if (field.type === 'number' && typeof value === 'number') {
        if (field.min !== undefined && value < field.min) {
          errors.push({ field: field.key, message: `${field.label} 不能小于 ${field.min}`, code: 'min' });
        }
        if (field.max !== undefined && value > field.max) {
          errors.push({ field: field.key, message: `${field.label} 不能大于 ${field.max}`, code: 'max' });
        }
      }

      // 自定义验证
      if (field.validate) {
        const msg = field.validate(value);
        if (msg) warnings.push({ field: field.key, message: msg, code: 'custom' });
      }
    }

    // 自定义验证器
    if (desc.validator) {
      const result = desc.validator(data);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /** 列出所有已注册配置 */
  list(): ConfigDescriptor[] {
    return Array.from(this.configs.values());
  }

  /** 按前缀列出 (如 'equipment.' 返回所有装备配置) */
  listByPrefix(prefix: string): ConfigDescriptor[] {
    return this.list().filter((d) => d.id.startsWith(prefix));
  }

  /** 检查配置是否存在 */
  has(id: string): boolean {
    return this.configs.has(id);
  }

  /** 订阅变更 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

// ============ 单例 ============

export const configRegistry = new ConfigRegistry();

// ============ 工具函数 ============

/** 通过点号路径获取嵌套值 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj);
}

/** 通过点号路径设置嵌套值 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce<Record<string, unknown>>((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key] as Record<string, unknown>;
  }, obj);
  target[last] = value;
}

// ============ 预注册配置 ============

/** 注册环境数据配置 */
function registerEnvironmentConfigs(): void {
  configRegistry.register({
    id: 'environment.weather',
    name: '气象数据',
    version: '1.0.0',
    schema: [
      { key: 'stationId', label: '站点编号', type: 'text', group: 'basic', required: true },
      { key: 'wind.speed', label: '风速', type: 'number', unit: 'm/s', group: 'wind', min: 0 },
      { key: 'wind.direction', label: '风向', type: 'number', unit: '°', group: 'wind', min: 0, max: 360 },
      { key: 'wind.gust', label: '阵风', type: 'number', unit: 'm/s', group: 'wind', min: 0 },
      { key: 'temperature.air', label: '气温', type: 'number', unit: '°C', group: 'temperature' },
      { key: 'temperature.dewPoint', label: '露点', type: 'number', unit: '°C', group: 'temperature' },
      { key: 'pressure.sea_level', label: '海平面气压', type: 'number', unit: 'hPa', group: 'pressure', min: 800, max: 1100 },
      { key: 'visibility', label: '能见度', type: 'number', unit: 'm', group: 'basic', min: 0 },
      { key: 'humidity', label: '湿度', type: 'number', unit: '%', group: 'basic', min: 0, max: 100 },
      { key: 'weatherCode', label: '天气代码', type: 'text', group: 'basic' },
    ],
    defaults: {
      stationId: '',
      position: { lng: 0, lat: 0 },
      timestamp: 0,
      wind: { speed: 0, direction: 0, unit: 'm/s' },
      temperature: { air: 0, unit: 'C' },
      pressure: { sea_level: 1013.25, unit: 'hPa' },
      visibility: 10000,
      precipitation: { type: 'none' },
      cloudCover: { total: 0, layers: [] },
      humidity: 50,
    },
    groups: [
      { key: 'basic', label: '基本信息', order: 0 },
      { key: 'wind', label: '风场', order: 1 },
      { key: 'temperature', label: '温度', order: 2 },
      { key: 'pressure', label: '气压', order: 3 },
    ],
  });

  configRegistry.register({
    id: 'environment.sea_state',
    name: '海情数据',
    version: '1.0.0',
    schema: [
      { key: 'wave.significantHeight', label: '有效浪高', type: 'number', unit: 'm', group: 'wave', min: 0 },
      { key: 'wave.direction', label: '浪向', type: 'number', unit: '°', group: 'wave', min: 0, max: 360 },
      { key: 'wave.period', label: '周期', type: 'number', unit: 's', group: 'wave', min: 0 },
      { key: 'swell.height', label: '涌浪高', type: 'number', unit: 'm', group: 'swell', min: 0 },
      { key: 'current.speed', label: '流速', type: 'number', unit: 'kn', group: 'current', min: 0 },
      { key: 'current.direction', label: '流向', type: 'number', unit: '°', group: 'current', min: 0, max: 360 },
      { key: 'seaSurfaceTemperature', label: '海温', type: 'number', unit: '°C', group: 'basic' },
      { key: 'seaState', label: '海况等级', type: 'number', group: 'basic', min: 0, max: 9 },
    ],
    defaults: {
      position: { lng: 0, lat: 0 },
      timestamp: 0,
      wave: { significantHeight: 0, direction: 0, period: 0, unit: 'm' },
      swell: { height: 0, direction: 0, period: 0 },
      current: { speed: 0, direction: 0, unit: 'knots' },
      seaSurfaceTemperature: 15,
      seaState: 0,
    },
    groups: [
      { key: 'basic', label: '基本信息', order: 0 },
      { key: 'wave', label: '浪涌', order: 1 },
      { key: 'swell', label: '涌浪', order: 2 },
      { key: 'current', label: '海流', order: 3 },
    ],
  });

  configRegistry.register({
    id: 'environment.tide',
    name: '潮汐数据',
    version: '1.0.0',
    schema: [
      { key: 'stationId', label: '站点编号', type: 'text', group: 'basic', required: true },
      { key: 'stationName', label: '站点名称', type: 'text', group: 'basic' },
      { key: 'level', label: '潮高', type: 'number', unit: 'm', group: 'basic' },
      { key: 'trend', label: '趋势', type: 'select', group: 'basic', options: [
        { value: 'rising', label: '涨潮' }, { value: 'falling', label: '落潮' },
        { value: 'high', label: '高潮' }, { value: 'low', label: '低潮' },
        { value: 'slack', label: '平潮' },
      ]},
      { key: 'datum', label: '基准面', type: 'select', group: 'basic', options: [
        { value: 'MLLW', label: '最低低潮面' }, { value: 'MSL', label: '平均海面' },
        { value: 'LAT', label: '最低天文潮' },
      ]},
    ],
    defaults: {
      stationId: '',
      stationName: '',
      position: { lng: 0, lat: 0 },
      timestamp: 0,
      level: 0,
      trend: 'slack',
      predictions: [],
      datum: 'MSL',
    },
  });
}

/** 注册实体状态配置 */
function registerEntityConfigs(): void {
  configRegistry.register({
    id: 'entity.platform_status',
    name: '平台状态',
    version: '1.0.0',
    schema: [
      { key: 'mission.type', label: '任务类型', type: 'select', group: 'mission', options: [
        { value: 'patrol', label: '巡逻' }, { value: 'strike', label: '打击' },
        { value: 'escort', label: '护航' }, { value: 'recon', label: '侦察' },
        { value: 'cargo', label: '运输' }, { value: 'cap', label: '战斗空中巡逻' },
        { value: 'cas', label: '近距空中支援' },
      ]},
      { key: 'mission.status', label: '任务状态', type: 'select', group: 'mission', options: [
        { value: 'en_route', label: '前往中' }, { value: 'on_station', label: '在位' },
        { value: 'engaging', label: '交战中' }, { value: 'rtb', label: '返航' },
        { value: 'completed', label: '完成' }, { value: 'aborted', label: '中止' },
      ]},
      { key: 'mission.progress', label: '任务进度', type: 'number', unit: '%', group: 'mission', min: 0, max: 100 },
      { key: 'combat.engagementState', label: '交战状态', type: 'select', group: 'combat', options: [
        { value: 'safe', label: '安全' }, { value: 'caution', label: '警惕' },
        { value: 'weapons_free', label: '自由开火' }, { value: 'engaged', label: '交战中' },
      ]},
      { key: 'operational.readiness', label: '就绪等级', type: 'select', group: 'operational', options: [
        { value: 'full', label: '完全就绪' }, { value: 'degraded', label: '降级' },
        { value: 'limited', label: '有限' }, { value: 'incapable', label: '丧失' },
      ]},
      { key: 'operational.maintenanceState', label: '维护状态', type: 'select', group: 'operational', options: [
        { value: 'operational', label: '可用' }, { value: 'minor_fault', label: '轻微故障' },
        { value: 'major_fault', label: '严重故障' }, { value: 'non_mission_capable', label: '不可用' },
      ]},
      { key: 'operational.sortieCount', label: '出动架次', type: 'number', group: 'operational', min: 0 },
    ],
    defaults: {},
    groups: [
      { key: 'mission', label: '任务状态', order: 0 },
      { key: 'combat', label: '作战状态', order: 1 },
      { key: 'operational', label: '运维状态', order: 2 },
    ],
  });
}

/** 注册事件类型配置 */
function registerEventConfigs(): void {
  configRegistry.register({
    id: 'event.categories',
    name: '事件分类',
    version: '1.0.0',
    schema: [
      { key: 'category', label: '事件分类', type: 'select', group: 'basic', options: [
        { value: 'simulation', label: '仿真' }, { value: 'platform', label: '平台' },
        { value: 'weapon', label: '武器' }, { value: 'sensor', label: '传感器' },
        { value: 'track', label: '航迹' }, { value: 'communication', label: '通信' },
        { value: 'system', label: '系统' }, { value: 'environment', label: '环境' },
        { value: 'ai', label: 'AI' },
      ]},
      { key: 'severity', label: '严重级别', type: 'select', group: 'basic', options: [
        { value: 'debug', label: '调试' }, { value: 'info', label: '信息' },
        { value: 'warning', label: '警告' }, { value: 'error', label: '错误' },
        { value: 'critical', label: '严重' },
      ]},
    ],
    defaults: { category: 'system', severity: 'info' },
  });
}

// 初始化预注册
registerEnvironmentConfigs();
registerEntityConfigs();
registerEventConfigs();
