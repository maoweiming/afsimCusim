import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useTrackStore } from '../../store/trackStore';
import { usePlatformStore } from '../../store/platformStore';
import { positionFromDegrees } from '../../utils/cesiumUtils';
import { getSideColor } from '../../utils/sideColors';

interface TrackMarkersProps {
  viewer: Cesium.Viewer;
}

export function TrackMarkers({ viewer }: TrackMarkersProps) {
  const tracks = useTrackStore((s) => s.tracks);
  const markerEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());

  useEffect(() => {
    const dataSource = viewer.entities;
    const markerEntities = markerEntitiesRef.current;
    const activeKeys = new Set<string>();

    tracks.forEach((track, key) => {
      activeKeys.add(key);

      const originator = usePlatformStore.getState().platforms[track.originator_index];
      const sideColor = originator ? getSideColor(originator.side) : Cesium.Color.GRAY;

      const trackPos = positionFromDegrees(track.lon, track.lat, track.alt);

      const existing = markerEntities.get(key);

      if (existing) {
        // Update is handled by CallbackProperty on position
      } else {
        // Create a diamond-shaped track marker
        const entity = dataSource.add({
          id: `track-${key}`,
          position: new Cesium.CallbackProperty(() => {
            const t = useTrackStore.getState().tracks.get(key);
            if (!t) return trackPos;
            return positionFromDegrees(t.lon, t.lat, t.alt);
          }, false) as unknown as Cesium.PositionProperty,
          billboard: {
            image: createDiamondCanvas(sideColor),
            width: 16,
            height: 16,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 1e7, 0.3),
            color: sideColor.withAlpha(0.7),
          },
          label: {
            text: `T:${track.target_index}`,
            font: '9px monospace',
            fillColor: Cesium.Color.WHITE.withAlpha(0.6),
            outlineColor: Cesium.Color.BLACK.withAlpha(0.5),
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 1e7, 0.3),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });

        markerEntities.set(key, entity);
      }
    });

    // Remove markers for tracks no longer present
    markerEntities.forEach((entity, key) => {
      if (!activeKeys.has(key)) {
        dataSource.remove(entity);
        markerEntities.delete(key);
      }
    });
  }, [tracks, viewer]);

  return null;
}

/** Create a diamond canvas for track markers. */
function createDiamondCanvas(color: Cesium.Color): HTMLCanvasElement {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const r = Math.round(color.red * 255);
  const g = Math.round(color.green * 255);
  const b = Math.round(color.blue * 255);

  ctx.beginPath();
  ctx.moveTo(size / 2, 2);
  ctx.lineTo(size - 2, size / 2);
  ctx.lineTo(size / 2, size - 2);
  ctx.lineTo(2, size / 2);
  ctx.closePath();
  ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas;
}
