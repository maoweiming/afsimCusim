/**
 * layerStore - Zustand store for layer configuration
 * 管理图层定义、图层树、用户覆盖（可见性/透明度）
 */
import { create } from 'zustand';
import type { LayerDefinition, LayerTreeNode, LayerPreset } from '../core/layer/types';
import { LayerPresets } from '../core/layer/LayerPresets';
import { LayerConfigSerializer } from '../core/layer/LayerConfigSerializer';
import { LayerManager } from '../core/layer/LayerManager';

interface LayerState {
  // 当前预设
  presetId: string;
  // 所有图层定义
  layers: Record<string, LayerDefinition>;
  // 图层树
  tree: LayerTreeNode[];
  // 用户覆盖
  nodeOverrides: Record<string, { visible?: boolean; opacity?: number; zIndex?: number }>;
  // 自定义图层（用户添加的）
  customLayers: LayerDefinition[];

  // Actions
  loadPreset: (presetId: string) => void;
  loadForRole: (role: string) => void;
  toggleLayer: (layerId: string) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  addCustomLayer: (layer: LayerDefinition) => void;
  removeCustomLayer: (layerId: string) => void;
  saveConfig: () => void;
  loadConfig: () => void;
  resetToPreset: () => void;
}

export const useLayerStore = create<LayerState>((set, get) => ({
  presetId: 'viewer-minimal',
  layers: {},
  tree: [],
  nodeOverrides: {},
  customLayers: [],

  loadPreset: (presetId: string) => {
    const preset = LayerPresets.getById(presetId);
    if (!preset) {
      console.warn(`[layerStore] Preset "${presetId}" not found`);
      return;
    }

    const layersMap: Record<string, LayerDefinition> = {};
    for (const layer of preset.layers) {
      layersMap[layer.id] = layer;
    }

    // 合并自定义图层
    const state = get();
    for (const layer of state.customLayers) {
      layersMap[layer.id] = layer;
    }

    set({
      presetId,
      layers: layersMap,
      tree: preset.tree,
      nodeOverrides: {},
    });

    // 同步到 LayerManager
    syncToManager(layersMap, preset.tree, {});
  },

  loadForRole: (role: string) => {
    const preset = LayerPresets.forRole(role);
    // 尝试从 localStorage 恢复
    const saved = LayerConfigSerializer.load();
    if (saved && saved.presetId === preset.id) {
      // 恢复保存的配置
      const layersMap: Record<string, LayerDefinition> = {};
      for (const layer of preset.layers) {
        layersMap[layer.id] = layer;
      }
      for (const layer of saved.customLayers) {
        layersMap[layer.id] = layer;
      }
      set({
        presetId: saved.presetId,
        layers: layersMap,
        tree: preset.tree,
        nodeOverrides: saved.treeOverrides,
        customLayers: saved.customLayers,
      });
      syncToManager(layersMap, preset.tree, saved.treeOverrides);
    } else {
      get().loadPreset(preset.id);
    }
  },

  toggleLayer: (layerId: string) => {
    const state = get();
    const current = state.nodeOverrides[layerId];
    const node = findNode(state.tree, layerId);
    const currentVisible = current?.visible ?? node?.visible ?? true;

    const newOverrides = {
      ...state.nodeOverrides,
      [layerId]: { ...current, visible: !currentVisible },
    };
    set({ nodeOverrides: newOverrides });

    // 同步到 LayerManager
    LayerManager.getInstance().setVisibility(layerId, !currentVisible);
  },

  setLayerVisibility: (layerId: string, visible: boolean) => {
    const state = get();
    const newOverrides = {
      ...state.nodeOverrides,
      [layerId]: { ...state.nodeOverrides[layerId], visible },
    };
    set({ nodeOverrides: newOverrides });
    LayerManager.getInstance().setVisibility(layerId, visible);
  },

  setLayerOpacity: (layerId: string, opacity: number) => {
    const state = get();
    const newOverrides = {
      ...state.nodeOverrides,
      [layerId]: { ...state.nodeOverrides[layerId], opacity },
    };
    set({ nodeOverrides: newOverrides });
    LayerManager.getInstance().setOpacity(layerId, opacity);
  },

  addCustomLayer: (layer: LayerDefinition) => {
    const state = get();
    const newCustom = [...state.customLayers, layer];
    const newLayers = { ...state.layers, [layer.id]: layer };
    set({ customLayers: newCustom, layers: newLayers });

    // 同步到 LayerManager
    LayerManager.getInstance().addLayer(layer);
  },

  removeCustomLayer: (layerId: string) => {
    const state = get();
    const newCustom = state.customLayers.filter((l) => l.id !== layerId);
    const newLayers = { ...state.layers };
    delete newLayers[layerId];

    // 从树中移除
    const newTree = removeNodeFromTree(state.tree, layerId);

    set({ customLayers: newCustom, layers: newLayers, tree: newTree });
    LayerManager.getInstance().removeLayer(layerId);
  },

  saveConfig: () => {
    const state = get();
    LayerConfigSerializer.save({
      presetId: state.presetId,
      customLayers: state.customLayers,
      treeOverrides: state.nodeOverrides,
    });
  },

  loadConfig: () => {
    get().loadForRole(get().presetId.split('-')[0]); // 从 presetId 推断 role
  },

  resetToPreset: () => {
    const state = get();
    get().loadPreset(state.presetId);
  },
}));

// ============ 辅助函数 ============

function findNode(tree: LayerTreeNode[], layerId: string): LayerTreeNode | null {
  for (const node of tree) {
    if (node.layerId === layerId) return node;
    if (node.children) {
      const found = findNode(node.children, layerId);
      if (found) return found;
    }
  }
  return null;
}

function removeNodeFromTree(tree: LayerTreeNode[], layerId: string): LayerTreeNode[] {
  return tree
    .filter((node) => node.layerId !== layerId)
    .map((node) => ({
      ...node,
      children: node.children ? removeNodeFromTree(node.children, layerId) : undefined,
    }));
}

function syncToManager(
  layers: Record<string, LayerDefinition>,
  tree: LayerTreeNode[],
  overrides: Record<string, { visible?: boolean; opacity?: number }>,
): void {
  const manager = LayerManager.getInstance();

  for (const [id, layer] of Object.entries(layers)) {
    if (!manager.hasLayer(id)) {
      manager.addLayer(layer);
    }
    const override = overrides[id];
    if (override) {
      if (override.visible !== undefined) manager.setVisibility(id, override.visible);
      if (override.opacity !== undefined) manager.setOpacity(id, override.opacity);
    }
  }
}
