/**
 * LayerConfigSerializer - 图层配置序列化/持久化
 * 保存到 localStorage，支持导入/导出 JSON
 */
import type { SerializedLayerConfig, LayerDefinition, LayerTreeNode } from './types';

const STORAGE_KEY = 'truesim:layer-config';
const CURRENT_VERSION = 1;

export const LayerConfigSerializer = {
  save(config: {
    presetId: string;
    customLayers: LayerDefinition[];
    treeOverrides: Record<string, { visible?: boolean; opacity?: number; zIndex?: number }>;
  }): void {
    const serialized: SerializedLayerConfig = {
      version: CURRENT_VERSION,
      presetId: config.presetId,
      customLayers: config.customLayers,
      treeOverrides: config.treeOverrides,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (e) {
      console.error('[LayerConfigSerializer] Failed to save:', e);
    }
  },

  load(): SerializedLayerConfig | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const config = JSON.parse(raw) as SerializedLayerConfig;
      if (config.version !== CURRENT_VERSION) {
        console.warn('[LayerConfigSerializer] Version mismatch, discarding saved config');
        return null;
      }
      return config;
    } catch (e) {
      console.error('[LayerConfigSerializer] Failed to load:', e);
      return null;
    }
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  exportJSON(config: {
    presetId: string;
    customLayers: LayerDefinition[];
    treeOverrides: Record<string, { visible?: boolean; opacity?: number; zIndex?: number }>;
  }): string {
    const serialized: SerializedLayerConfig = {
      version: CURRENT_VERSION,
      presetId: config.presetId,
      customLayers: config.customLayers,
      treeOverrides: config.treeOverrides,
      savedAt: new Date().toISOString(),
    };
    return JSON.stringify(serialized, null, 2);
  },

  importJSON(json: string): SerializedLayerConfig | null {
    try {
      const config = JSON.parse(json) as SerializedLayerConfig;
      if (!config.version || !config.presetId) {
        console.error('[LayerConfigSerializer] Invalid config format');
        return null;
      }
      return config;
    } catch (e) {
      console.error('[LayerConfigSerializer] Failed to parse JSON:', e);
      return null;
    }
  },
};
