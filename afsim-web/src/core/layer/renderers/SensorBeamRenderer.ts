/**
 * 传感器波束图层渲染器
 * direct 模式 - 直接操作 CesiumJS viewer 创建传感器覆盖锥/扇区
 * 使用 Entity + EllipsoidGraphics / PolygonGraphics 渲染波束范围
 */
import type { MapEngine } from '../../map-engine/MapEngine';
import type { LayerDefinition, UnifiedLayerStyle } from '../types';
import type { LayerRenderer, LayerHandle } from './LayerRenderer';

interface BeamHandleState {
  entityIds: string[];
}

export class SensorBeamRenderer implements LayerRenderer {
  readonly supportedTypes = ['sensor_beam'];
  readonly renderingMode = 'direct' as const;

  private engine: MapEngine | null = null;
  private cesiumViewer: any | null = null;
  private layers = new Map<string, BeamHandleState>();

  initialize(engine: MapEngine | null): void {
    this.destroy();
    this.engine = engine;
    if (engine) {
      this.cesiumViewer = engine.getNativeEngine();
    }
  }

  addLayer(layer: LayerDefinition): LayerHandle {
    const state: BeamHandleState = { entityIds: [] };

    if (!this.cesiumViewer) {
      this.layers.set(layer.id, state);
      return { layerId: layer.id, state };
    }

    const entities = this.cesiumViewer.entities;
    const beamData = layer.source?.data as Array<Record<string, any>> | undefined;

    if (Array.isArray(beamData)) {
      for (const beam of beamData) {
        const entityId = `${layer.id}_${beam.id ?? Math.random().toString(36).slice(2)}`;
        const position = beam.position;
        if (!position) continue;

        const cesiumPos = this.toCesiumPosition(position);
        if (!cesiumPos) continue;

        const style = layer.style;
        const alpha = style.beamAlpha ?? 0.3;

        const Cesium = (window as any).Cesium;
        if (!Cesium) continue;

        // If beam has sector parameters, render as polygon sector
        if (beam.azimuth !== undefined && beam.beamWidth !== undefined && beam.range !== undefined) {
          const sectorPositions = this.computeSectorPositions(
            position.lng,
            position.lat,
            position.alt ?? 0,
            beam.range,
            beam.azimuth,
            beam.beamWidth,
            beam.elevation ?? 0,
            beam.elevationWidth ?? 30,
          );

          if (sectorPositions.length > 0) {
            entities.add({
              id: entityId,
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights(sectorPositions),
                material: style.fillColor
                  ? Cesium.Color.fromCssColorString(style.fillColor).withAlpha(alpha)
                  : Cesium.Color.YELLOW.withAlpha(alpha),
                outline: true,
                outlineColor: style.strokeColor
                  ? Cesium.Color.fromCssColorString(style.strokeColor)
                  : Cesium.Color.YELLOW.withAlpha(0.6),
                outlineWidth: style.strokeWidth ?? 1,
              },
              show: true,
            });

            state.entityIds.push(entityId);
            continue;
          }
        }

        // Fallback: render as an ellipsoid volume
        const semiMajor = beam.semiMajor ?? beam.range ?? 50000;
        const semiMinor = beam.semiMinor ?? beam.range ?? 50000;
        const semiHeight = beam.semiHeight ?? (beam.range ? beam.range * 0.3 : 15000);

        entities.add({
          id: entityId,
          position: cesiumPos,
          ellipsoid: {
            radii: new Cesium.Cartesian3(semiMajor, semiMinor, semiHeight),
            material: style.fillColor
              ? Cesium.Color.fromCssColorString(style.fillColor).withAlpha(alpha)
              : Cesium.Color.YELLOW.withAlpha(alpha),
            outline: true,
            outlineColor: style.strokeColor
              ? Cesium.Color.fromCssColorString(style.strokeColor)
              : Cesium.Color.YELLOW.withAlpha(0.6),
            slicePartitions: 24,
            stackPartitions: 24,
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
      // Rebuild is simplest for geometry-heavy layers
      this.removeEntitiesFromViewer(state);
      state.entityIds = [];

      const rebuiltDef: LayerDefinition = {
        id: handle.layerId,
        name: '',
        type: 'sensor_beam',
        renderingMode: 'direct',
        source: changes.source,
        style: (changes.style ?? {}) as UnifiedLayerStyle,
      };
      const newState = this.addLayer(rebuiltDef);
      state.entityIds = (newState.state as BeamHandleState).entityIds;
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
      if (!entity) continue;

      if (entity.ellipsoid?.material) {
        const mat = entity.ellipsoid.material;
        if (mat.color) {
          const c = mat.color.getValue();
          if (c?.withAlpha) {
            entity.ellipsoid.material = c.withAlpha(opacity);
          }
        }
      }
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

  /**
   * Compute sector polygon positions for a sensor beam.
   * Returns [lng, lat, alt, lng, lat, alt, ...] for fromDegreesArrayHeights.
   */
  private computeSectorPositions(
    centerLng: number,
    centerLat: number,
    centerAlt: number,
    rangeMeters: number,
    azimuthDeg: number,
    beamWidthDeg: number,
    elevationDeg: number,
    elevationWidthDeg: number,
  ): number[] {
    const Cesium = (window as any).Cesium;
    if (!Cesium) return [];

    const earthRadius = 6371000;
    const angularRange = (rangeMeters / earthRadius) * (180 / Math.PI);
    const startAz = azimuthDeg - beamWidthDeg / 2;
    const endAz = azimuthDeg + beamWidthDeg / 2;
    const steps = 32;
    const positions: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const az = startAz + (endAz - startAz) * (i / steps);
      const azRad = (az * Math.PI) / 180;
      const dLat = angularRange * Math.cos(azRad);
      const dLng = (angularRange * Math.sin(azRad)) / Math.cos((centerLat * Math.PI) / 180);
      const altAtRange = centerAlt + rangeMeters * Math.tan((elevationDeg * Math.PI) / 180);
      positions.push(centerLng + dLng, centerLat + dLat, altAtRange);
    }

    // Close the sector with the center point
    positions.push(centerLng, centerLat, centerAlt);

    return positions;
  }

  private removeEntitiesFromViewer(state: BeamHandleState): void {
    if (!this.cesiumViewer) return;

    const entities = this.cesiumViewer.entities;
    for (const entityId of state.entityIds) {
      entities.removeById(entityId);
    }
  }
}
