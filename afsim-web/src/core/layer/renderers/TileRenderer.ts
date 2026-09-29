/**
 * 瓦片/影像图层渲染器
 * engine 模式 - 通过 MapEngine 抽象层添加瓦片/影像/地形图层
 * 支持 tile, wms, wmts, imagery, terrain 类型
 */
import type { MapEngine, MapLayer, LayerSource, LayerStyle } from '../../map-engine/MapEngine';
import type { LayerDefinition, UnifiedLayerStyle, LayerDataSource } from '../types';
import type { LayerRenderer, LayerHandle } from './LayerRenderer';

export class TileRenderer implements LayerRenderer {
  readonly supportedTypes = ['tile', 'wms', 'wmts', 'imagery', 'terrain'];
  readonly renderingMode = 'engine' as const;

  private engine: MapEngine | null = null;
  private layers = new Map<string, { engineLayerId: string | null }>();

  initialize(engine: MapEngine | null): void {
    this.engine = engine;
  }

  addLayer(layer: LayerDefinition): LayerHandle {
    if (!this.engine) {
      this.layers.set(layer.id, { engineLayerId: null });
      return { layerId: layer.id, state: {} };
    }

    const mapLayer = this.toMapLayer(layer);
    const engineLayerId = this.engine.addLayer(mapLayer);
    this.layers.set(layer.id, { engineLayerId });

    return { layerId: layer.id, state: { engineLayerId } };
  }

  updateLayer(handle: LayerHandle, changes: Partial<LayerDefinition>): void {
    if (!this.engine) return;

    const internalState = this.layers.get(handle.layerId);
    if (!internalState?.engineLayerId) return;

    const updates: Partial<MapLayer> = {};

    if (changes.name !== undefined) {
      updates.name = changes.name;
    }
    if (changes.source) {
      updates.source = this.toLayerSource(changes.source);
    }
    if (changes.style) {
      updates.style = this.toLayerStyle(changes.style);
    }

    if (Object.keys(updates).length > 0) {
      this.engine.updateLayer(internalState.engineLayerId, updates);
    }
  }

  removeLayer(handle: LayerHandle): void {
    if (!this.engine) return;

    const internalState = this.layers.get(handle.layerId);
    if (internalState?.engineLayerId) {
      this.engine.removeLayer(internalState.engineLayerId);
    }

    this.layers.delete(handle.layerId);
  }

  setVisibility(handle: LayerHandle, visible: boolean): void {
    if (!this.engine) return;

    const internalState = this.layers.get(handle.layerId);
    if (internalState?.engineLayerId) {
      this.engine.setLayerVisibility(internalState.engineLayerId, visible);
    }
  }

  setOpacity(handle: LayerHandle, opacity: number): void {
    if (!this.engine) return;

    const internalState = this.layers.get(handle.layerId);
    if (internalState?.engineLayerId) {
      this.engine.setLayerOpacity(internalState.engineLayerId, opacity);
    }
  }

  onEngineChange(newEngine: MapEngine | null): void {
    this.engine = newEngine;
  }

  destroy(): void {
    this.layers.clear();
    this.engine = null;
  }

  // ── Private helpers ──

  private toMapLayer(layer: LayerDefinition): MapLayer {
    return {
      id: layer.id,
      name: layer.name,
      type: this.resolveLayerType(layer.type),
      source: this.toLayerSource(layer.source),
      style: this.toLayerStyle(layer.style),
      visible: true,
      opacity: 1,
    };
  }

  /**
   * Map UnifiedLayerType to MapEngine LayerType.
   * 'imagery' and 'terrain' map directly; others are coerced.
   */
  private resolveLayerType(unifiedType: string): MapLayer['type'] {
    switch (unifiedType) {
      case 'imagery':
        return 'imagery';
      case 'terrain':
        return 'terrain';
      case 'wms':
        return 'wms';
      case 'wmts':
        return 'wmts';
      case 'tile':
      case 'geojson':
      default:
        return 'tile';
    }
  }

  private toLayerSource(source?: LayerDataSource): LayerSource {
    if (!source) return {};

    return {
      url: source.url,
      data: source.data,
      format: source.format,
      layers: source.layers,
      parameters: source.parameters,
    };
  }

  private toLayerStyle(style?: UnifiedLayerStyle): LayerStyle | undefined {
    if (!style) return undefined;

    return {
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      strokeColor: style.strokeColor,
      strokeWidth: style.strokeWidth,
      strokeDash: style.strokeDash,
      pointRadius: style.pointSize,
      pointIcon: style.iconUrl,
      labelField: style.labelField,
      labelFont: style.labelFont,
      labelSize: style.labelSize,
      labelColor: style.labelColor,
    };
  }
}
