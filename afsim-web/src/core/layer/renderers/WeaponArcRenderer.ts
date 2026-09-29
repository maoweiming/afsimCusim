/**
 * 武器交战区图层渲染器
 * direct 模式 - 直接操作 CesiumJS viewer 创建武器交战区
 * 渲染扇形/多边形表示武器射程和交战区域
 */
import type { MapEngine } from '../../map-engine/MapEngine';
import type { LayerDefinition, UnifiedLayerStyle } from '../types';
import type { LayerRenderer, LayerHandle } from './LayerRenderer';

interface WeaponArcHandleState {
  entityIds: string[];
}

export class WeaponArcRenderer implements LayerRenderer {
  readonly supportedTypes = ['weapon_arc'];
  readonly renderingMode = 'direct' as const;

  private engine: MapEngine | null = null;
  private cesiumViewer: any | null = null;
  private layers = new Map<string, WeaponArcHandleState>();

  initialize(engine: MapEngine | null): void {
    this.destroy();
    this.engine = engine;
    if (engine) {
      this.cesiumViewer = engine.getNativeEngine();
    }
  }

  addLayer(layer: LayerDefinition): LayerHandle {
    const state: WeaponArcHandleState = { entityIds: [] };

    if (!this.cesiumViewer) {
      this.layers.set(layer.id, state);
      return { layerId: layer.id, state };
    }

    const entities = this.cesiumViewer.entities;
    const arcData = layer.source?.data as Array<Record<string, any>> | undefined;

    if (Array.isArray(arcData)) {
      for (const arc of arcData) {
        const entityId = `${layer.id}_${arc.id ?? Math.random().toString(36).slice(2)}`;
        const position = arc.position;
        if (!position) continue;

        const style = layer.style;
        const alpha = style.fillOpacity ?? 0.3;

        const Cesium = (window as any).Cesium;
        if (!Cesium) continue;

        // If arc has sector parameters (azimuth, arc angle, range)
        if (arc.azimuth !== undefined && arc.arcAngle !== undefined && arc.range !== undefined) {
          const sectorPositions = this.computeSectorPositions(
            position.lng,
            position.lat,
            position.alt ?? 0,
            arc.range,
            arc.azimuth,
            arc.arcAngle,
          );

          if (sectorPositions.length > 0) {
            entities.add({
              id: entityId,
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights(sectorPositions),
                material: style.fillColor
                  ? Cesium.Color.fromCssColorString(style.fillColor).withAlpha(alpha)
                  : Cesium.Color.RED.withAlpha(alpha),
                outline: true,
                outlineColor: style.strokeColor
                  ? Cesium.Color.fromCssColorString(style.strokeColor)
                  : Cesium.Color.RED.withAlpha(0.8),
                outlineWidth: style.strokeWidth ?? 2,
              },
              show: true,
            });

            state.entityIds.push(entityId);
            continue;
          }
        }

        // If arc has explicit polygon positions
        if (Array.isArray(arc.polygonPositions) && arc.polygonPositions.length >= 3) {
          const flatPositions: number[] = [];
          for (const p of arc.polygonPositions) {
            flatPositions.push(p.lng, p.lat, p.alt ?? 0);
          }

          entities.add({
            id: entityId,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights(flatPositions),
              material: style.fillColor
                ? Cesium.Color.fromCssColorString(style.fillColor).withAlpha(alpha)
                : Cesium.Color.RED.withAlpha(alpha),
              outline: true,
              outlineColor: style.strokeColor
                ? Cesium.Color.fromCssColorString(style.strokeColor)
                : Cesium.Color.RED.withAlpha(0.8),
              outlineWidth: style.strokeWidth ?? 2,
            },
            show: true,
          });

          state.entityIds.push(entityId);
          continue;
        }

        // Fallback: render a circle polygon for maximum range
        const range = arc.range ?? arc.maxRange ?? 50000;
        const circlePositions = this.computeCirclePositions(
          position.lng,
          position.lat,
          position.alt ?? 0,
          range,
        );

        entities.add({
          id: entityId,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights(circlePositions),
            material: style.fillColor
              ? Cesium.Color.fromCssColorString(style.fillColor).withAlpha(alpha)
              : Cesium.Color.RED.withAlpha(alpha),
            outline: true,
            outlineColor: style.strokeColor
              ? Cesium.Color.fromCssColorString(style.strokeColor)
              : Cesium.Color.RED.withAlpha(0.8),
            outlineWidth: style.strokeWidth ?? 2,
          },
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

    if (changes.style || changes.source?.data) {
      // Rebuild entities
      this.removeEntitiesFromViewer(state);
      state.entityIds = [];

      const rebuiltDef = {
        id: handle.layerId,
        name: '',
        type: 'weapon_arc' as const,
        renderingMode: 'direct' as const,
        source: changes.source,
        style: (changes.style ?? {}) as UnifiedLayerStyle,
      };
      const newState = this.addLayer(rebuiltDef as LayerDefinition);
      state.entityIds = (newState.state as WeaponArcHandleState).entityIds;
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
      if (!entity) continue;

      if (entity.polygon?.material) {
        const mat = entity.polygon.material;
        if (mat.color) {
          const c = mat.color.getValue();
          if (c?.withAlpha) {
            entity.polygon.material = c.withAlpha(opacity);
          }
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

  /**
   * Compute sector polygon for a weapon engagement zone.
   * Returns [lng, lat, alt, ...] for fromDegreesArrayHeights.
   */
  private computeSectorPositions(
    centerLng: number,
    centerLat: number,
    centerAlt: number,
    rangeMeters: number,
    azimuthDeg: number,
    arcAngleDeg: number,
  ): number[] {
    const earthRadius = 6371000;
    const angularRange = (rangeMeters / earthRadius) * (180 / Math.PI);
    const startAz = azimuthDeg - arcAngleDeg / 2;
    const endAz = azimuthDeg + arcAngleDeg / 2;
    const steps = 48;
    const positions: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const az = startAz + (endAz - startAz) * (i / steps);
      const azRad = (az * Math.PI) / 180;
      const dLat = angularRange * Math.cos(azRad);
      const dLng = (angularRange * Math.sin(azRad)) / Math.cos((centerLat * Math.PI) / 180);
      positions.push(centerLng + dLng, centerLat + dLat, centerAlt);
    }

    // Close sector by adding center
    positions.push(centerLng, centerLat, centerAlt);
    return positions;
  }

  /**
   * Compute circle polygon for a weapon max range.
   * Returns [lng, lat, alt, ...] for fromDegreesArrayHeights.
   */
  private computeCirclePositions(
    centerLng: number,
    centerLat: number,
    centerAlt: number,
    rangeMeters: number,
  ): number[] {
    const earthRadius = 6371000;
    const angularRange = (rangeMeters / earthRadius) * (180 / Math.PI);
    const steps = 64;
    const positions: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const az = (360 * i) / steps;
      const azRad = (az * Math.PI) / 180;
      const dLat = angularRange * Math.cos(azRad);
      const dLng = (angularRange * Math.sin(azRad)) / Math.cos((centerLat * Math.PI) / 180);
      positions.push(centerLng + dLng, centerLat + dLat, centerAlt);
    }

    return positions;
  }

  private removeEntitiesFromViewer(state: WeaponArcHandleState): void {
    if (!this.cesiumViewer) return;

    const entities = this.cesiumViewer.entities;
    for (const entityId of state.entityIds) {
      entities.removeById(entityId);
    }
  }
}
