import * as Cesium from 'cesium';

/** Create a Cartesian3 position from degrees. */
export function positionFromDegrees(lon: number, lat: number, alt: number = 0): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(lon, lat, alt);
}

/** Convert a Cartesian3 position back to lat/lon/alt in degrees. */
export function cartesianToDegrees(cartesian: Cesium.Cartesian3): {
  lat: number;
  lon: number;
  alt: number;
} {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  return {
    lat: Cesium.Math.toDegrees(cartographic.latitude),
    lon: Cesium.Math.toDegrees(cartographic.longitude),
    alt: cartographic.height,
  };
}

/** Compute heading from velocity components (NED). */
export function headingFromVelocity(vel_n: number, vel_e: number): number {
  // Heading is angle from north, clockwise
  return Math.atan2(vel_e, vel_n);
}

/** Compute speed from NED velocity components. */
export function speedFromVelocity(vel_n: number, vel_e: number, vel_d: number): number {
  return Math.sqrt(vel_n * vel_n + vel_e * vel_e + vel_d * vel_d);
}

/** Format simulation time (seconds since epoch) to a readable string. */
export function formatSimTime(simTime: number): string {
  if (simTime === 0) return '00:00:00';
  const totalSeconds = Math.floor(simTime);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Format sim time to a full date-time string (if sim time represents a date). */
export function formatSimDateTime(simTime: number): string {
  if (simTime === 0) return '--';
  // AFSIM sim_time is often seconds from a reference; display as HH:MM:SS offset
  return formatSimTime(simTime);
}

/** Default camera position for initial globe view. */
export const DEFAULT_CAMERA = {
  lon: 0,
  lat: 30,
  alt: 20000000, // ~20,000 km altitude for full globe view
};

/** Fly the camera to a specific platform location. */
export function flyToPosition(
  viewer: Cesium.Viewer,
  lon: number,
  lat: number,
  alt: number,
): void {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt + 50000),
    duration: 1.5,
  });
}
