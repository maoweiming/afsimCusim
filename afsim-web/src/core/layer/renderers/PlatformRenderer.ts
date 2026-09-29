/**
 * 平台图层渲染器
 * direct 模式 - 直接操作 CesiumJS viewer 创建实体点位
 * 支持图标、颜色、标签等样式
 */
import type { MapEngine } from '../../map-engine/MapEngine';
import type { LayerDefinition, UnifiedLayerStyle } from '../types';
import type { LayerRenderer, LayerHandle } from './LayerRenderer';

interface PlatformHandleState {
  entityIds: string[];
}

export class PlatformRenderer implements LayerRenderer {
  readonly supportedTypes = ['platform'];
  readonly renderingMode = 'direct' as const;

  private engine: MapEngine | null = null;
  private cesiumViewer: any | null = null;
  private layers = new Map<string, PlatformHandleState>();

  initialize(engine: MapEngine | null): void {
    this.destroy();
    this.engine = engine;
    if (engine) {
      this.cesiumViewer = engine.getNativeEngine();
    }
  }

  addLayer(layer: LayerDefinition): LayerHandle {
    const state: PlatformHandleState = { entityIds: [] };

    if (!this.cesiumViewer) {
      this.layers.set(layer.id, state);
      return { layerId: layer.id, state };
    }

    const entities = this.cesiumViewer.entities;
    const dataSource = layer.source?.data as Array<Record<string, any>> | undefined;

    if (Array.isArray(dataSource)) {
      for (const item of dataSource) {
        const entityId = `${layer.id}_${item.id ?? item.name ?? Math.random().toString(36).slice(2)}`;
        const position = item.position;
        if (!position) continue;

        const style = layer.style;
        const cesiumPos = this.toCesiumPosition(position);
        if (!cesiumPos) continue;

        const entity = entities.add({
          id: entityId,
          position: cesiumPos,
          point: this.createPointGraphics(style),
          billboard: this.createBillboard(style),
          label: this.createLabel(style, item),
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
        if (!entity) continue;

        if (entity.point) {
          this.applyPointStyle(entity.point, changes.style);
        }
        if (entity.billboard) {
          this.applyBillboardStyle(entity.billboard, changes.style);
        }
      }
    }

    if (changes.source?.data && Array.isArray(changes.source.data)) {
      // Rebuild entities with new data
      this.removeEntitiesFromViewer(state);
      state.entityIds = [];

      for (const item of changes.source.data as Array<Record<string, any>>) {
        const entityId = `${handle.layerId}_${item.id ?? item.name ?? Math.random().toString(36).slice(2)}`;
        const position = item.position;
        if (!position) continue;

        const style = (changes.style ?? {});
        const cesiumPos = this.toCesiumPosition(position);
        if (!cesiumPos) continue;

        entities.add({
          id: entityId,
          position: cesiumPos,
          point: this.createPointGraphics(style),
          billboard: this.createBillboard(style),
          label: this.createLabel(style, item),
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

    for (const entityId of state.entityIds) {
      const entity = this.cesiumViewer.entities.getById(entityId);
      if (entity) {
        if (entity.billboard) {
          entity.billboard.color = entity.billboard.color
            ? this.cloneWithAlpha(entity.billboard.color, opacity)
            : undefined;
        }
        if (entity.label) {
          entity.label.fillColor = entity.label.fillColor
            ? this.cloneWithAlpha(entity.label.fillColor, opacity)
            : undefined;
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

  private createPointGraphics(style: UnifiedLayerStyle): any {
    const Cesium = (window as any).Cesium;
    if (!Cesium) return undefined;

    if (style.iconUrl) return undefined; // Use billboard instead

    return new Cesium.PointGraphics({
      color: style.pointColor ? Cesium.Color.fromCssColorString(style.pointColor) : Cesium.Color.WHITE,
      pixelSize: style.pointSize ?? 6,
      outlineColor: style.pointOutlineColor
        ? Cesium.Color.fromCssColorString(style.pointOutlineColor)
        : Cesium.Color.BLACK,
      outlineWidth: style.pointOutlineWidth ?? 1,
    });
  }

  private createBillboard(style: UnifiedLayerStyle): any {
    if (!style.iconUrl) return undefined;

    const Cesium = (window as any).Cesium;
    if (!Cesium) return undefined;

    return new Cesium.BillboardGraphics({
      image: style.iconUrl,
      scale: style.iconScale ?? 1.0,
      rotation: style.iconRotation ?? 0,
      alignedAxis: Cesium.Cartesian3.ZERO,
    });
  }

  private createLabel(style: UnifiedLayerStyle, data: Record<string, any>): any {
    if (!style.showLabel || !style.labelField) return undefined;

    const Cesium = (window as any).Cesium;
    if (!Cesium) return undefined;

    const text = String(data[style.labelField] ?? '');
    if (!text) return undefined;

    return new Cesium.LabelGraphics({
      text,
      font: style.labelFont ?? '14px sans-serif',
      fillColor: style.labelColor
        ? Cesium.Color.fromCssColorString(style.labelColor)
        : Cesium.Color.WHITE,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
    });
  }

  private applyPointStyle(point: any, style: UnifiedLayerStyle): void {
    const Cesium = (window as any).Cesium;
    if (!Cesium || !point) return;

    if (style.pointColor) {
      point.color = Cesium.Color.fromCssColorString(style.pointColor);
    }
    if (style.pointSize !== undefined) {
      point.pixelSize = style.pointSize;
    }
    if (style.pointOutlineColor) {
      point.outlineColor = Cesium.Color.fromCssColorString(style.pointOutlineColor);
    }
    if (style.pointOutlineWidth !== undefined) {
      point.outlineWidth = style.pointOutlineWidth;
    }
  }

  private applyBillboardStyle(billboard: any, style: UnifiedLayerStyle): void {
    if (!billboard) return;

    if (style.iconUrl) {
      billboard.image = style.iconUrl;
    }
    if (style.iconScale !== undefined) {
      billboard.scale = style.iconScale;
    }
    if (style.iconRotation !== undefined) {
      billboard.rotation = style.iconRotation;
    }
  }

  private removeEntitiesFromViewer(state: PlatformHandleState): void {
    if (!this.cesiumViewer) return;

    const entities = this.cesiumViewer.entities;
    for (const entityId of state.entityIds) {
      entities.removeById(entityId);
    }
  }

  private cloneWithAlpha(color: any, alpha: number): any {
    if (color && typeof color.withAlpha === 'function') {
      return color.withAlpha(alpha);
    }
    return color;
  }
}
