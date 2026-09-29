/**
 * Platform Icon Registry
 *
 * Generates SVG-based military-style icons for situation display.
 * Icons are generated as data URLs and cached for performance.
 *
 * Shape conventions (NATO-inspired):
 *   aircraft  → chevron/arrow (pointy front)
 *   ship      → diamond (elongated)
 *   vehicle   → rectangle
 *   missile   → triangle (pointing up)
 *   sensor    → circle with crosshair
 *   submarine → submarine hull shape
 *   unknown   → circle
 *
 * Side colors:
 *   blue    → #0078d7
 *   red     → #d72828
 *   neutral → #8899aa
 *   green   → #28b43c
 */

const SIDE_COLORS: Record<string, string> = {
  blue: '#0078d7',
  red: '#d72828',
  neutral: '#8899aa',
  green: '#28b43c',
};

const ICON_SIZE = 32;

// Cache for generated icon data URLs
const iconCache = new Map<string, string>();

function getSideColor(side: string): string {
  return SIDE_COLORS[side] || SIDE_COLORS.neutral;
}

/**
 * Generate an SVG data URL for a platform icon.
 */
function generateSvgIcon(category: string, side: string, label?: string): string {
  const color = getSideColor(side);
  const half = ICON_SIZE / 2;
  const r = ICON_SIZE * 0.4;

  let shape = '';
  let textY = half + 1;

  switch (category) {
    case 'aircraft': {
      // Chevron/arrow pointing up
      const w = r * 0.9;
      const h = r * 1.1;
      shape = `<polygon points="${half},${half - h} ${half + w},${half + h * 0.3} ${half},${half + h * 0.1} ${half - w},${half + h * 0.3}" />`;
      textY = half + h * 0.6;
      break;
    }
    case 'ship': {
      // Diamond (elongated horizontally)
      const w = r * 1.1;
      const h = r * 0.7;
      shape = `<polygon points="${half},${half - h} ${half + w},${half} ${half},${half + h} ${half - w},${half}" />`;
      break;
    }
    case 'submarine': {
      // Submarine hull shape (elongated diamond, thinner)
      const w = r * 1.0;
      const h = r * 0.5;
      shape = `<polygon points="${half - w * 0.3},${half - h} ${half + w},${half} ${half - w * 0.3},${half + h} ${half - w},${half}" />`;
      break;
    }
    case 'vehicle': {
      // Rectangle
      const w = r * 0.9;
      const h = r * 0.7;
      shape = `<rect x="${half - w}" y="${half - h}" width="${w * 2}" height="${h * 2}" rx="2" />`;
      break;
    }
    case 'missile': {
      // Triangle pointing up
      const w = r * 0.8;
      const h = r * 1.0;
      shape = `<polygon points="${half},${half - h} ${half + w},${half + h * 0.5} ${half - w},${half + h * 0.5}" />`;
      textY = half + h * 0.8;
      break;
    }
    case 'sensor': {
      // Circle with crosshair
      shape = `<circle cx="${half}" cy="${half}" r="${r * 0.8}" fill="none" stroke="${color}" stroke-width="2" />
        <line x1="${half}" y1="${half - r}" x2="${half}" y2="${half + r}" stroke="${color}" stroke-width="1" />
        <line x1="${half - r}" y1="${half}" x2="${half + r}" y2="${half}" stroke="${color}" stroke-width="1" />
        <circle cx="${half}" cy="${half}" r="${r * 0.3}" />`;
      break;
    }
    default: {
      // Circle (unknown)
      shape = `<circle cx="${half}" cy="${half}" r="${r * 0.8}" />`;
      break;
    }
  }

  // Short label: use first 3 chars of icon identifier if provided
  const text = label ? label.substring(0, 3).toUpperCase() : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
    <g fill="${color}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round">
      ${shape}
    </g>
    ${text ? `<text x="${half}" y="${textY}" text-anchor="middle" fill="#fff" font-size="7" font-family="monospace" font-weight="bold">${text}</text>` : ''}
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Resolve a platform icon data URL.
 *
 * @param icon - Platform icon identifier (e.g. "F-35", "DDG-51")
 * @param category - Equipment category (aircraft, ship, vehicle, etc.)
 * @param side - Side affiliation (blue, red, neutral, green)
 * @returns SVG data URL for use in map rendering
 */
export function resolvePlatformIcon(
  icon: string | undefined,
  category: string,
  side: string,
): string {
  const cacheKey = `${category}:${side}:${icon || ''}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const url = generateSvgIcon(category, side, icon);
  iconCache.set(cacheKey, url);
  return url;
}

/**
 * Clear the icon cache (useful when theme changes).
 */
export function clearIconCache(): void {
  iconCache.clear();
}
