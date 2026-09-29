import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { usePlatformStore } from '../../store/platformStore';

// ============ Sensor type → color mapping ============

const SENSOR_COLORS: Record<string, string> = {
  radar: '#4fc3f7',
  ir: '#ef5350',
  eo: '#81c784',
  sonar: '#00bcd4',
  ew: '#ffb74d',
};

function getSensorColor(sensorType: string): Cesium.Color {
  const cssColor = SENSOR_COLORS[sensorType.toLowerCase()] ?? '#aaaaaa';
  return Cesium.Color.fromCssColorString(cssColor);
}

function getSensorColorWithAlpha(sensorType: string, alpha: number): Cesium.Color {
  const c = getSensorColor(sensorType);
  return new Cesium.Color(c.red, c.green, c.blue, alpha);
}

// ============ Extended sensor info (future-proof) ============

interface ExtendedSensorInfo {
  name: string;
  type: string;
  isOn: boolean;
  fovAzimuth?: number;   // degrees
  fovElevation?: number; // degrees
  steerAzimuth?: number; // degrees
  steerElevation?: number; // degrees
  beamLength?: number;   // meters
  detections?: number[];
}

// ============ Component ============

interface BeamVisualizationProps {
  viewer: Cesium.Viewer;
  beamLength?: number;  // default beam length in meters (default: 10000)
  showOutline?: boolean;
}

export default function BeamVisualization({
  viewer,
  beamLength = 10000,
  showOutline = false,
}: BeamVisualizationProps) {
  const platforms = usePlatformStore((s) => s.platforms);
  const beamEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());

  useEffect(() => {
    if (!viewer) return;

    const dataSource = viewer.entities;
    const beamEntities = beamEntitiesRef.current;
    const activeKeys = new Set<string>();

    for (const [idxStr, platform] of Object.entries(platforms)) {
      const idx = Number(idxStr);

      for (const [sensorName, sensorBase] of Object.entries(platform.sensors)) {
        if (!sensorBase.isOn) continue;

        const sensor = sensorBase as ExtendedSensorInfo;
        const key = `${idx}_${sensorName}`;
        activeKeys.add(key);

        // Sensor parameters with defaults
        const fovAzimuth = sensor.fovAzimuth ?? 30;   // default 30 degrees
        const fovElevation = sensor.fovElevation ?? 30;
        const len = sensor.beamLength ?? beamLength;

        // Half-angles in radians
        const halfAzRad = Cesium.Math.toRadians(fovAzimuth / 2);
        const halfElRad = Cesium.Math.toRadians(fovElevation / 2);

        // Bottom radius: average of azimuth and elevation cones
        const radiusFromAz = len * Math.tan(halfAzRad);
        const radiusFromEl = len * Math.tan(halfElRad);
        const bottomRadius = (radiusFromAz + radiusFromEl) / 2;

        // Beam direction: sensor steer or platform heading
        const steerAz = sensor.steerAzimuth ?? platform.heading ?? 0;
        const steerEl = sensor.steerElevation ?? 0;

        // Build orientation quaternion from heading/pitch
        const headingRad = Cesium.Math.toRadians(steerAz);
        const pitchRad = Cesium.Math.toRadians(-steerEl);
        const hpr = new Cesium.HeadingPitchRoll(headingRad, pitchRad, 0);

        // Position: platform location
        const position = Cesium.Cartesian3.fromDegrees(
          platform.lon,
          platform.lat,
          platform.alt
        );

        const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

        // Cone color by sensor type
        const material = new Cesium.ColorMaterialProperty(
          getSensorColorWithAlpha(sensor.type, 0.15)
        );

        const existing = beamEntities.get(key);

        if (existing) {
          // Update existing entity via CallbackProperty references
          // Positions and orientation are already dynamic via CallbackProperty
        } else {
          const entity = dataSource.add({
            id: `beam-${key}`,
            position: new Cesium.CallbackProperty(() => {
              const p = usePlatformStore.getState().platforms[idx];
              if (!p) return position;
              return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt);
            }, false) as any,
            orientation: new Cesium.CallbackProperty(() => {
              const p = usePlatformStore.getState().platforms[idx];
              if (!p) return orientation;
              const s = p.sensors[sensorName] as ExtendedSensorInfo | undefined;
              const az = s?.steerAzimuth ?? p.heading ?? 0;
              const el = s?.steerElevation ?? 0;
              const h = Cesium.Math.toRadians(az);
              const pi = Cesium.Math.toRadians(-el);
              const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt);
              return Cesium.Transforms.headingPitchRollQuaternion(
                pos,
                new Cesium.HeadingPitchRoll(h, pi, 0)
              );
            }, false) as any,
            cylinder: {
              topRadius: 0,
              bottomRadius: new Cesium.CallbackProperty(() => {
                const p = usePlatformStore.getState().platforms[idx];
                if (!p) return bottomRadius;
                const s = p.sensors[sensorName] as ExtendedSensorInfo | undefined;
                const fovA = s?.fovAzimuth ?? 30;
                const fovE = s?.fovElevation ?? 30;
                const l = s?.beamLength ?? beamLength;
                const rA = l * Math.tan(Cesium.Math.toRadians(fovA / 2));
                const rE = l * Math.tan(Cesium.Math.toRadians(fovE / 2));
                return (rA + rE) / 2;
              }, false),
              length: new Cesium.CallbackProperty(() => {
                const p = usePlatformStore.getState().platforms[idx];
                if (!p) return len;
                const s = p.sensors[sensorName] as ExtendedSensorInfo | undefined;
                return s?.beamLength ?? beamLength;
              }, false),
              material: new Cesium.ColorMaterialProperty(
                new Cesium.CallbackProperty(() => {
                  const p = usePlatformStore.getState().platforms[idx];
                  const sType = p?.sensors[sensorName]?.type ?? sensor.type;
                  return getSensorColorWithAlpha(sType, 0.15);
                }, false)
              ),
              outline: showOutline,
              outlineColor: new Cesium.CallbackProperty(() => {
                const p = usePlatformStore.getState().platforms[idx];
                const sType = p?.sensors[sensorName]?.type ?? sensor.type;
                return getSensorColorWithAlpha(sType, 0.5);
              }, false),
              numberOfVerticalLines: 8,
              slices: 24,
            } as any,
          });

          beamEntities.set(key, entity);
        }
      }
    }

    // Remove beams for sensors no longer active
    beamEntities.forEach((entity, key) => {
      if (!activeKeys.has(key)) {
        dataSource.remove(entity);
        beamEntities.delete(key);
      }
    });
  }, [platforms, viewer, beamLength, showOutline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!viewer) return;
      const dataSource = viewer.entities;
      beamEntitiesRef.current.forEach((entity) => {
        dataSource.remove(entity);
      });
      beamEntitiesRef.current.clear();
    };
  }, [viewer]);

  return null;
}
