/**
 * 航迹图层渲染器
 * direct 模式 - 直接操作 CesiumJS viewer 创建航迹线
 * 渲染 PolylineGraphics 表示运动轨迹
 */
import type { MapEngine } from '../../map-engine/MapEngine';
import type { LayerDefinition, UnifiedLayerStyle } from '../types';
import type { LayerRenderer, LayerHandle } from './LayerRenderer';

interface TrackHandleState {
  entityIds: string[];
}

export class TrackRenderer implements LayerRenderer {
  readonly supportedTypes = ['track'];
  readonly renderingMode = 'direct' as const;

  private engine: MapEngine | null = null;
  private cesiumViewer: any | null = null;
  private layers = new Map<string, TrackHandleState>();

  initialize(engine: MapEngine | null): void {
    this.destroy();
    this.engine = engine;
    if (engine) {
      this.cesiumViewer = engine.getNativeEngine();
    }
  }

  addLayer(layer: LayerDefinition): LayerHandle {
    const state: TrackHandleState = { entityIds: [] };

    if (!this.cesiumViewer) {
      this.layers.set(layer.id, state);
      return { layerId: layer.id, state };
    }

    const entities = this.cesiumViewer.entities;
    const trackData = layer.source?.data as Record<string, any> | undefined;

    if (trackData) {
      const tracks = Array.isArray(trackData) ? trackData : [trackData];

      for (const track of tracks) {
        const entityId = `${layer.id}_${track.id ?? Math.random().toString(36).slice(2)}`;
        const points = track.positions ?? track.points ?? [];

        if (points.length < 2) continue;

        const positions = points.map((p: any) => this.toCesiumPosition(p)).filter(Boolean);
        if (positions.length < 2) continue;

        const style = layer.style;
        const Cesium = (window as any).Cesium;
        if (!Cesium) continue;

        entities.add({
          id: entityId,
          polyline: new Cesium.PolylineGraphics({
            positions,
            width: style.lineWidth ?? 2,
            material: this.createLineMaterial(style),
            clampToGround: true,
          }),
          show: true,
        });

        state.entityIds.push(entityId);
      }
    }

    this.layers.set(layer.id, state);
    return { layerId: layer.id, state };
  }

  updateLayer(handle: LayerHandle, changes: Partial<LayerDefinition>): void {
    const state = this.layers.get(handle.layerId);
    if (!state || !this.cesiumViewer) return;

    const entities = this.cesiumViewer.entities;

    if (changes.style) {
      for (const entityId of state.entityIds) {
        const entity = entities.getById(entityId);
        if (!entity?.polyline) continue;

        if (changes.style.lineWidth !== undefined) {
          entity.polyline.width = changes.style.lineWidth;
        }
        if (changes.style.lineColor || changes.style.lineDash) {
          entity.polyline.material = this.createLineMaterial(changes.style as UnifiedLayerStyle);
        }
      }
    }

    if (changes.source?.data) {
      // Rebuild track entities
      this.removeEntitiesFromViewer(state);
      state.entityIds = [];

      const trackData = changes.source.data;
      const tracks = Array.isArray(trackData) ? trackData : [trackData];
      const Cesium = (window as any).Cesium;
      if (!Cesium) return;

      for (const track of tracks as Array<Record<string, any>>) {
        const entityId = `${handle.layerId}_${track.id ?? Math.random().toString(36).slice(2)}`;
        const points = track.positions ?? track.points ?? [];

        if (points.length < 2) continue;

        const positions = points.map((p: any) => this.toCesiumPosition(p)).filter(Boolean);
        if (positions.length < 2) continue;

        const style = (changes.style ?? {}) as UnifiedLayerStyle;

        entities.add({
          id: entityId,
          polyline: new Cesium.PolylineGraphics({
            positions,
            width: style.lineWidth ?? 2,
            material: this.createLineMaterial(style),
            clampToGround: true,
          }),
          show: true,
        });

        state.entityIds.push(entityId);
      }
    }
  }

  removeLayer(handle: LayerHandle): void {
    const state = this.layers.get(handle.layerId);
    if (!state) return;

    this.removeEntitiesFromViewer(state);
    this.layers.delete(handle.layerId);
  }

  setVisibility(handle: LayerHandle, visible: boolean): void {
    const state = this.layers.get(handle.layerId);
    if (!state || !this.cesiumViewer) return;

    for (const entityId of state.entityIds) {
      const entity = this.cesiumViewer.entities.getById(entityId);
      if (entity) {
        entity.show = visible;
      }
    }
  }

  setOpacity(handle: LayerHandle, opacity: number): void {
    const state = this.layers.get(handle.layerId);
    if (!state || !this.cesiumViewer) return;

    const Cesium = (window as any).Cesium;
    if (!Cesium) return;

    for (const entityId of state.entityIds) {
      const entity = this.cesiumViewer.entities.getById(entityId);
      if (entity?.polyline?.material) {
        // Cesium PolylineGlowMaterialProperty supports alpha via color
        const mat = entity.polyline.material;
        if (mat.color) {
          entity.polyline.material = this.cloneMaterialWithAlpha(mat, opacity);
        }
      }
    }
  }

  onEngineChange(newEngine: MapEngine | null): void {
    this.initialize(newEngine);
  }

  destroy(): void {
    if (this.cesiumViewer) {
      for (const [, state] of this.layers) {
        this.removeEntitiesFromViewer(state);
      }
    }
    this.layers.clear();
    this.cesiumViewer = null;
    this.engine = null;
  }

  // ── Private helpers ──

  private toCesiumPosition(pos: any): any | null {
    if (
      pos &&
      typeof pos.lng === 'number' &&
      typeof pos.lat === 'number'
    ) {
      const Cesium = (window as any).Cesium;
      if (Cesium) {
        return Cesium.Cartesian3.fromDegrees(
          pos.lng,
          pos.lat,
          pos.alt ?? 0,
        );
      }
    }
    return null;
  }

  private createLineMaterial(style: UnifiedLayerStyle): any {
    const Cesium = (window as any).Cesium;
    if (!Cesium) return undefined;

    const color = style.lineColor
      ? Cesium.Color.fromCssColorString(style.lineColor).withAlpha(1.0)
      : Cesium.Color.CYAN;

    if (style.lineDash && style.lineDash.length > 0) {
      return new Cesium.PolylineDashMaterialProperty({
        color,
        dashLength: 16,
        dashPattern: 255,
      });
    }

    if (style.lineGlow) {
      return new Cesium.PolylineGlowMaterialProperty({
        glowPower: style.lineGlowPower ?? 0.2,
        color: style.lineGlowColor
          ? Cesium.Color.fromCssColorString(style.lineGlowColor)
          : color,
      });
    }

    return color;
  }

  private removeEntitiesFromViewer(state: TrackHandleState): void {
    if (!this.cesiumViewer) return;

    const entities = this.cesiumViewer.entities;
    for (const entityId of state.entityIds) {
      entities.removeById(entityId);
    }
  }

  private cloneMaterialWithAlpha(_material: any, alpha: number): any {
    const Cesium = (window as any).Cesium;
    if (!Cesium) return _material;

    // Rebuild a simple color material with the desired alpha
    return Cesium.Color.WHITE.withAlpha(alpha);
  }
}
