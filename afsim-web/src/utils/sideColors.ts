import * as Cesium from 'cesium';

const SIDE_COLORS: Record<string, Cesium.Color> = {
  blue: Cesium.Color.fromBytes(0, 120, 215, 255),    // Blue force
  red: Cesium.Color.fromBytes(215, 40, 40, 255),      // Red force
  neutral: Cesium.Color.fromBytes(160, 160, 160, 255), // Neutral/gray
  green: Cesium.Color.fromBytes(40, 180, 60, 255),    // Ally/green
  unknown: Cesium.Color.fromBytes(200, 200, 60, 255),  // Unknown/yellow
};

export function getSideColor(side: string): Cesium.Color {
  const normalized = side.toLowerCase().trim();
  return SIDE_COLORS[normalized] ?? Cesium.Color.WHITE;
}

export function getSideColorWithOpacity(side: string, opacity: number): Cesium.Color {
  const base = getSideColor(side);
  return new Cesium.Color(base.red, base.green, base.blue, opacity);
}

const LABEL_COLORS: Record<string, Cesium.Color> = {
  blue: Cesium.Color.fromCssColorString('#70f3ff'), // 蔚蓝，提高蓝方标签可读性
};

/** Label-specific color: blue side uses a brighter cyan-blue; other sides fall back to getSideColor. */
export function getLabelColor(side: string): Cesium.Color {
  const normalized = side.toLowerCase().trim();
  return LABEL_COLORS[normalized] ?? getSideColor(side);
}

export function getSideCssColor(side: string): string {
  const map: Record<string, string> = {
    blue: '#0078D7',
    red: '#D72828',
    neutral: '#A0A0A0',
    green: '#28B43C',
    unknown: '#C8C83C',
  };
  const normalized = side.toLowerCase().trim();
  return map[normalized] ?? '#FFFFFF';
}

/** Determine opacity based on damage factor (0 = pristine, 1 = destroyed). */
export function damageOpacity(damageFactor: number): number {
  // Fully healthy = 1.0 opacity, destroyed = 0.25 opacity
  return Math.max(0.25, 1.0 - damageFactor * 0.75);
}
