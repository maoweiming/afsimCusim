// ============================================================
// AFSIM .scenario route block parser
// 解析想定文件中的独立航线（顶层 `route <name> ... end_route`），
// 用于在地图上叠加显示预设航线。平台内联航线（`route` 无名称，
// 嵌套于 platform...end_platform 内）用于平台运动，不在此解析。
// ============================================================

export interface RouteWaypoint {
  lat: number;
  lon: number;
  alt: number; // meters
}

export interface ParsedRoute {
  name: string;
  waypoints: RouteWaypoint[];
}

const ALT_UNIT_TO_METERS: Record<string, number> = {
  m: 1,
  meter: 1,
  meters: 1,
  ft: 0.3048,
  feet: 0.3048,
  km: 1000,
};

const POSITION_RE = /^position\s+([\d.]+)([nsNS])\s+([\d.]+)([ewEW])(?:\s+altitude\s+([\d.]+)\s*(\w+))?/;

export function parseScenarioRoutes(text: string): ParsedRoute[] {
  const routes: ParsedRoute[] = [];
  let platformDepth = 0;
  let currentRoute: ParsedRoute | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (/^platform\b/.test(line)) {
      platformDepth++;
      continue;
    }
    if (/^end_platform\b/.test(line)) {
      platformDepth = Math.max(0, platformDepth - 1);
      continue;
    }

    if (currentRoute) {
      if (/^end_route\b/.test(line)) {
        if (currentRoute.waypoints.length > 0) routes.push(currentRoute);
        currentRoute = null;
        continue;
      }
      const match = line.match(POSITION_RE);
      if (match) {
        const [, latStr, latDir, lonStr, lonDir, altStr, altUnit] = match;
        let lat = parseFloat(latStr);
        if (latDir.toLowerCase() === 's') lat = -lat;
        let lon = parseFloat(lonStr);
        if (lonDir.toLowerCase() === 'w') lon = -lon;
        let alt = 0;
        if (altStr) {
          const unit = (altUnit ?? 'm').toLowerCase();
          alt = parseFloat(altStr) * (ALT_UNIT_TO_METERS[unit] ?? 1);
        }
        currentRoute.waypoints.push({ lat, lon, alt });
      }
      continue;
    }

    // Standalone named routes only appear at the top level (outside platform blocks)
    if (platformDepth === 0) {
      const match = line.match(/^route\s+(\S.*)$/);
      if (match) {
        let name = match[1].trim();
        if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
        currentRoute = { name, waypoints: [] };
      }
    }
  }

  return routes;
}
