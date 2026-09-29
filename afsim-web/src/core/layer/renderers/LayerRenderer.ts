/**
 * 图层渲染器接口
 * direct 模式：直接操作 CesiumJS viewer (高性能)
 * engine 模式：通过 MapEngine 抽象 (支持 2D/3D 切换)
 */
import type { MapEngine } from '../../map-engine/MapEngine';
import type { LayerDefinition } from '../types';

export interface LayerHandle {
  layerId: string;
  state: unknown;
}

export interface LayerRenderer {
  readonly supportedTypes: string[];
  readonly renderingMode: 'direct' | 'engine';

  initialize(engine: MapEngine | null): void;
  addLayer(layer: LayerDefinition): LayerHandle;
  updateLayer(handle: LayerHandle, changes: Partial<LayerDefinition>): void;
  removeLayer(handle: LayerHandle): void;
  setVisibility(handle: LayerHandle, visible: boolean): void;
  setOpacity(handle: LayerHandle, opacity: number): void;
  onEngineChange(newEngine: MapEngine | null): void;
  destroy(): void;
}
