/**
 * LayerManager - 图层渲染器编排
 * 管理渲染器注册、引擎绑定、图层增删改查
 */
import type { MapEngine } from '../map-engine/MapEngine';
import type { LayerRenderer, LayerHandle } from './renderers/LayerRenderer';
import type { LayerDefinition, UnifiedLayerType } from './types';

export class LayerManager {
  private static instance: LayerManager | null = null;

  private renderers: Map<string, LayerRenderer> = new Map();
  private handles: Map<string, LayerHandle> = new Map(); // layerId → handle
  private rendererMap: Map<string, LayerRenderer> = new Map(); // layerId → renderer
  private engine: MapEngine | null = null;
  private listeners: Set<() => void> = new Set();

  static getInstance(): LayerManager {
    if (!LayerManager.instance) {
      LayerManager.instance = new LayerManager();
    }
    return LayerManager.instance;
  }

  private constructor() {}

  // ============ 渲染器管理 ============

  registerRenderer(renderer: LayerRenderer): void {
    for (const type of renderer.supportedTypes) {
      this.renderers.set(type, renderer);
    }
    if (this.engine) {
      renderer.initialize(this.engine);
    }
  }

  unregisterRenderer(renderer: LayerRenderer): void {
    for (const type of renderer.supportedTypes) {
      this.renderers.delete(type);
    }
    renderer.destroy();
  }

  // ============ 引擎绑定 ============

  setEngine(engine: MapEngine | null): void {
    this.engine = engine;
    for (const renderer of this.renderers.values()) {
      renderer.onEngineChange(engine);
    }
  }

  getEngine(): MapEngine | null {
    return this.engine;
  }

  // ============ 图层操作 ============

  addLayer(layer: LayerDefinition): LayerHandle | null {
    const renderer = this.findRenderer(layer.type, layer.renderingMode);
    if (!renderer) {
      console.warn(`[LayerManager] No renderer for type "${layer.type}" mode "${layer.renderingMode}"`);
      return null;
    }

    // 如果已有同 ID 图层，先移除
    if (this.handles.has(layer.id)) {
      this.removeLayer(layer.id);
    }

    const handle = renderer.addLayer(layer);
    this.handles.set(layer.id, handle);
    this.rendererMap.set(layer.id, renderer);
    this.emit();
    return handle;
  }

  removeLayer(layerId: string): boolean {
    const handle = this.handles.get(layerId);
    const renderer = this.rendererMap.get(layerId);
    if (!handle || !renderer) return false;

    renderer.removeLayer(handle);
    this.handles.delete(layerId);
    this.rendererMap.delete(layerId);
    this.emit();
    return true;
  }

  updateLayer(layerId: string, changes: Partial<LayerDefinition>): boolean {
    const handle = this.handles.get(layerId);
    const renderer = this.rendererMap.get(layerId);
    if (!handle || !renderer) return false;

    renderer.updateLayer(handle, changes);
    this.emit();
    return true;
  }

  setVisibility(layerId: string, visible: boolean): boolean {
    const handle = this.handles.get(layerId);
    const renderer = this.rendererMap.get(layerId);
    if (!handle || !renderer) return false;

    renderer.setVisibility(handle, visible);
    return true;
  }

  setOpacity(layerId: string, opacity: number): boolean {
    const handle = this.handles.get(layerId);
    const renderer = this.rendererMap.get(layerId);
    if (!handle || !renderer) return false;

    renderer.setOpacity(handle, opacity);
    return true;
  }

  hasLayer(layerId: string): boolean {
    return this.handles.has(layerId);
  }

  // ============ 查询 ============

  private findRenderer(type: UnifiedLayerType, mode: string): LayerRenderer | null {
    // 优先按类型精确匹配
    const exact = this.renderers.get(type);
    if (exact && exact.renderingMode === mode) return exact;

    // 按模式回退
    for (const renderer of this.renderers.values()) {
      if (renderer.supportedTypes.includes(type) && renderer.renderingMode === mode) {
        return renderer;
      }
    }

    return null;
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys());
  }

  // ============ 订阅 ============

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  // ============ 销毁 ============

  destroy(): void {
    for (const renderer of this.renderers.values()) {
      renderer.destroy();
    }
    this.renderers.clear();
    this.handles.clear();
    this.rendererMap.clear();
    this.engine = null;
    this.listeners.clear();
  }

  static resetInstance(): void {
    if (LayerManager.instance) {
      LayerManager.instance.destroy();
      LayerManager.instance = null;
    }
  }
}
