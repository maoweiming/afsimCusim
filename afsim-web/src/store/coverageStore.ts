import { create } from 'zustand'

export interface HeatmapCell {
  lat: number
  lon: number
  count: number
}

// Key: `${platformIndex}_${sensorName}`
export interface SensorDetectionStat {
  platformIndex: number
  platformName: string
  sensorName: string
  sensorType: string
  count: number
}

interface CoverageState {
  showCoverageCircles: boolean
  showHeatmap: boolean
  heatmapOpacity: number
  // Grid cells keyed by "lat_lon" (quantised to CELL_SIZE degrees)
  detectionGrid: Record<string, HeatmapCell>
  // Per-sensor accumulation
  sensorStats: Record<string, SensorDetectionStat>

  setShowCoverageCircles: (v: boolean) => void
  setShowHeatmap: (v: boolean) => void
  setHeatmapOpacity: (v: number) => void
  recordDetection: (
    targetLat: number,
    targetLon: number,
    platformIndex: number,
    platformName: string,
    sensorName: string,
    sensorType: string,
  ) => void
  clearAll: () => void
}

// ~55 km per 0.5° — reasonable resolution for a theater-level demo
const CELL_SIZE = 0.5

function cellKey(lat: number, lon: number): string {
  const clat = Math.round(lat / CELL_SIZE) * CELL_SIZE
  const clon = Math.round(lon / CELL_SIZE) * CELL_SIZE
  return `${clat.toFixed(1)}_${clon.toFixed(1)}`
}

export const useCoverageStore = create<CoverageState>((set) => ({
  showCoverageCircles: true,
  showHeatmap: true,
  heatmapOpacity: 0.55,
  detectionGrid: {},
  sensorStats: {},

  setShowCoverageCircles: (v) => set({ showCoverageCircles: v }),
  setShowHeatmap: (v) => set({ showHeatmap: v }),
  setHeatmapOpacity: (v) => set({ heatmapOpacity: v }),

  recordDetection: (targetLat, targetLon, platformIndex, platformName, sensorName, sensorType) =>
    set((state) => {
      const gKey = cellKey(targetLat, targetLon)
      const clat = Math.round(targetLat / CELL_SIZE) * CELL_SIZE
      const clon = Math.round(targetLon / CELL_SIZE) * CELL_SIZE
      const prev = state.detectionGrid[gKey]

      const sKey = `${platformIndex}_${sensorName}`
      const prevStat = state.sensorStats[sKey]

      return {
        detectionGrid: {
          ...state.detectionGrid,
          [gKey]: { lat: clat, lon: clon, count: (prev?.count ?? 0) + 1 },
        },
        sensorStats: {
          ...state.sensorStats,
          [sKey]: {
            platformIndex,
            platformName,
            sensorName,
            sensorType: sensorType || prevStat?.sensorType || '',
            count: (prevStat?.count ?? 0) + 1,
          },
        },
      }
    }),

  clearAll: () => set({ detectionGrid: {}, sensorStats: {} }),
}))
