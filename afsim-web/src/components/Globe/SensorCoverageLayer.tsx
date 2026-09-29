import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'

import { usePlatformStore } from '../../store/platformStore'
import { useCoverageStore, HeatmapCell } from '../../store/coverageStore'

// ─── sensor range inference ────────────────────────────────────────────────

function inferSensorRange(sensorType: string): number {
  const t = sensorType.toUpperCase()
  if (t.includes('LONG') || t.includes('EARLY_WARNING') || t.includes('AEW')) return 350_000
  if (t.includes('STANDARD_SAM') || t.includes('MEDIUM') || t.includes('RADAR')) return 150_000
  if (t.includes('SHORT_SAM') || t.includes('SHORT') || t.includes('SHORAD')) return 50_000
  if (t.includes('IR') || t.includes('EOIR') || t.includes('LADAR')) return 30_000
  if (t.includes('GEOMETRIC') || t.includes('GEO')) return 200_000
  return 100_000
}

function sideColor(side: string, alpha: number): Cesium.Color {
  if (side === 'blue') return new Cesium.Color(0.1, 0.5, 1.0, alpha)
  if (side === 'red') return new Cesium.Color(1.0, 0.2, 0.2, alpha)
  return new Cesium.Color(0.6, 0.6, 0.6, alpha)
}

// ─── heatmap colour (green → yellow → red) ───────────────────────────────

function heatColor(count: number, maxCount: number, opacity: number): Cesium.Color {
  const ratio = maxCount > 0 ? Math.min(count / maxCount, 1.0) : 0
  // Green (0) → Yellow (0.5) → Red (1.0)
  let r: number, g: number
  if (ratio < 0.5) {
    r = ratio * 2
    g = 1.0
  } else {
    r = 1.0
    g = 1.0 - (ratio - 0.5) * 2
  }
  const alpha = (0.25 + ratio * 0.45) * opacity
  return new Cesium.Color(r, g, 0.0, alpha)
}

// ─── component ────────────────────────────────────────────────────────────

export default function SensorCoverageLayer({ viewer }: { viewer: Cesium.Viewer | null }) {
  const platforms = usePlatformStore((s) => s.platforms)
  const showCoverageCircles = useCoverageStore((s) => s.showCoverageCircles)
  const showHeatmap = useCoverageStore((s) => s.showHeatmap)
  const heatmapOpacity = useCoverageStore((s) => s.heatmapOpacity)
  const detectionGrid = useCoverageStore((s) => s.detectionGrid)

  const circleEntitiesRef = useRef<Cesium.Entity[]>([])
  const heatmapEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map())

  // ── coverage circles: rebuild when platforms or toggle changes ──────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return

    for (const e of circleEntitiesRef.current) viewer.entities.remove(e)
    circleEntitiesRef.current = []

    if (!showCoverageCircles) return

    for (const plat of Object.values(platforms)) {
      for (const [sName, sensor] of Object.entries(plat.sensors)) {
        if (!sensor.isOn) continue
        const range = inferSensorRange(sensor.type)
        const fill = sideColor(plat.side, 0.08)
        const outline = sideColor(plat.side, 0.5)

        const e = new Cesium.Entity({
          id: `coverage_circle_${plat.index}_${sName}`,
          position: Cesium.Cartesian3.fromDegrees(plat.lon, plat.lat, plat.alt),
          ellipse: {
            semiMajorAxis: range,
            semiMinorAxis: range,
            material: new Cesium.ColorMaterialProperty(fill),
            outline: true,
            outlineColor: outline,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.NONE,
          } as any,
        })
        viewer.entities.add(e)
        circleEntitiesRef.current.push(e)

        // label showing sensor name + range
        const labelE = new Cesium.Entity({
          id: `coverage_label_${plat.index}_${sName}`,
          position: Cesium.Cartesian3.fromDegrees(plat.lon, plat.lat + range / 111_000, plat.alt),
          label: {
            text: `${plat.name}\n${sName} (${Math.round(range / 1000)}km)`,
            font: '11px sans-serif',
            fillColor: sideColor(plat.side, 0.9),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.5),
            backgroundPadding: new Cesium.Cartesian2(4, 3),
          } as any,
        })
        viewer.entities.add(labelE)
        circleEntitiesRef.current.push(labelE)
      }
    }
  }, [viewer, platforms, showCoverageCircles])

  // ── heatmap: diff-update on grid changes ──────────────────────────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return

    if (!showHeatmap) {
      for (const e of heatmapEntitiesRef.current.values()) viewer.entities.remove(e)
      heatmapEntitiesRef.current.clear()
      return
    }

    const cells = Object.entries(detectionGrid) as [string, HeatmapCell][]
    const maxCount = cells.reduce((m, [, c]) => Math.max(m, c.count), 1)
    const HALF = 0.5 / 2  // half cell in degrees

    // Remove stale entities not in grid anymore
    for (const key of heatmapEntitiesRef.current.keys()) {
      if (!detectionGrid[key]) {
        const e = heatmapEntitiesRef.current.get(key)!
        viewer.entities.remove(e)
        heatmapEntitiesRef.current.delete(key)
      }
    }

    for (const [key, cell] of cells) {
      const color = heatColor(cell.count, maxCount, heatmapOpacity)
      const existing = heatmapEntitiesRef.current.get(key)
      if (existing) {
        // Update colour in place
        const rect = existing.rectangle
        if (rect) {
          rect.material = new Cesium.ColorMaterialProperty(color) as any
        }
        continue
      }

      const e = new Cesium.Entity({
        id: `heatmap_cell_${key}`,
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            cell.lon - HALF,
            cell.lat - HALF,
            cell.lon + HALF,
            cell.lat + HALF,
          ),
          material: new Cesium.ColorMaterialProperty(color),
          height: 0,
          outline: false,
        } as any,
      })
      viewer.entities.add(e)
      heatmapEntitiesRef.current.set(key, e)
    }
  }, [viewer, detectionGrid, showHeatmap, heatmapOpacity])

  // ── cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (!viewer || viewer.isDestroyed()) return
      for (const e of circleEntitiesRef.current) viewer.entities.remove(e)
      for (const e of heatmapEntitiesRef.current.values()) viewer.entities.remove(e)
      circleEntitiesRef.current = []
      heatmapEntitiesRef.current.clear()
    }
  }, [viewer])

  return null
}
