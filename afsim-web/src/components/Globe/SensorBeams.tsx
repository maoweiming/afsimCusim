import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { usePlatformStore } from '../../store/platformStore';
import { useTrackStore } from '../../store/trackStore';
import { positionFromDegrees } from '../../utils/cesiumUtils';
import { getSideColor } from '../../utils/sideColors';

interface SensorBeamsProps {
  viewer: Cesium.Viewer;
}

export function SensorBeams({ viewer }: SensorBeamsProps) {
  const tracks = useTrackStore((s) => s.tracks);
  const beamEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());

  useEffect(() => {
    const dataSource = viewer.entities;
    const beamEntities = beamEntitiesRef.current;
    const activeKeys = new Set<string>();

    tracks.forEach((track, key) => {
      activeKeys.add(key);

      const originator = usePlatformStore.getState().platforms[track.originator_index];
      const target = usePlatformStore.getState().platforms[track.target_index];

      if (!originator) return;

      const existing = beamEntities.get(key);

      if (existing) {
        // Update positions via callback (already set)
      } else {
        const sideColor = getSideColor(originator.side);
        const beamColor = sideColor.withAlpha(0.3);

        const entity = dataSource.add({
          id: `sensor-beam-${key}`,
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
              const o = usePlatformStore.getState().platforms[track.originator_index];
              const t = usePlatformStore.getState().platforms[track.target_index];
              if (!o) return [];
              const oPos = positionFromDegrees(o.lon, o.lat, o.alt);
              const tPos = t
                ? positionFromDegrees(t.lon, t.lat, t.alt)
                : positionFromDegrees(track.lon, track.lat, track.alt);
              return [oPos, tPos];
            }, false),
            width: 1,
            material: new Cesium.PolylineDashMaterialProperty({
              color: beamColor,
              dashLength: 12,
            }),
            clampToGround: false,
          },
        });

        beamEntities.set(key, entity);
      }
    });

    beamEntities.forEach((entity, key) => {
      if (!activeKeys.has(key)) {
        dataSource.remove(entity);
        beamEntities.delete(key);
      }
    });
  }, [tracks, viewer]);

  return null;
}
