import { useState, useRef, useEffect } from 'react'
import * as Cesium from 'cesium'

import { usePlatformStore, PlatformInfo } from '../../store/platformStore'
import { useSimStore } from '../../store/simStore'
import { getSideColor, getSideCssColor, getLabelColor } from '../../utils/sideColors'
import { useTrackSettingsStore } from '../../store/trackSettingsStore'
import { resolvePlatformIcon } from '../../modules/equipment/iconRegistry'

// Status color mapping for trail rendering
const STATUS_COLORS: Record<string, Cesium.Color> = {
  default: Cesium.Color.fromCssColorString('#52c41a'),
  detecting: Cesium.Color.fromCssColorString('#faad14'),
  tracking: Cesium.Color.fromCssColorString('#fa8c16'),
  engaging: Cesium.Color.fromCssColorString('#ff4d4f'),
}

function getStatusColor(platform: PlatformInfo): Cesium.Color {
  if (platform.damageFactor >= 1) return STATUS_COLORS.engaging
  if (platform.damageFactor > 0.5) return STATUS_COLORS.tracking
  if (platform.damageFactor > 0) return STATUS_COLORS.detecting
  return STATUS_COLORS.default
}

export default function PlatformLayer({ viewer }: { viewer: Cesium.Viewer | null }) {
  const platforms = usePlatformStore((s) => s.platforms)
  const [revision, setRevision] = useState(0)
  const entitiesRef = useRef<Map<number, Cesium.Entity>>(new Map())
  const trailEntitiesRef = useRef<Map<number, Cesium.Entity>>(new Map())
  const trailPositionsRef = useRef<Map<number, Cesium.Cartesian3[]>>(new Map())
  const lastUpdateRef = useRef<number>(0)
  const autoFlownRef = useRef(false)
  const autoFlyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track display settings from shared store
  const showTrackLines = useTrackSettingsStore((s) => s.showTrackLines)
  const trackLength = useTrackSettingsStore((s) => s.trackLength)
  const colorMode = useTrackSettingsStore((s) => s.colorMode)
  const showLabels = useTrackSettingsStore((s) => s.showLabels)
  // Reset auto-fly whenever a new simulation is started (simulationId changes)
  const simulationId = useSimStore((s) => s.simulationId)

  useEffect(() => {
    autoFlownRef.current = false
    if (autoFlyTimerRef.current) {
      clearTimeout(autoFlyTimerRef.current)
      autoFlyTimerRef.current = null
    }
  }, [simulationId])

  // Auto-fly to platforms the first time they appear after a simulation starts.
  // Debounce 800ms so AFSIM's burst of platform_added events all arrive before
  // we compute the bounding sphere, giving a view that covers all platforms.
  useEffect(() => {
    if (autoFlownRef.current) return
    if (!viewer || viewer.isDestroyed()) return
    const platformList = Object.values(platforms)
    if (platformList.length === 0) return

    // Don't restart the timer on every mover_update (fires every 500ms).
    // Once the 800ms countdown is running, leave it alone.
    if (autoFlyTimerRef.current !== null) return

    autoFlyTimerRef.current = setTimeout(() => {
      if (autoFlownRef.current) return
      if (!viewer || viewer.isDestroyed()) return
      autoFlownRef.current = true
      autoFlyTimerRef.current = null

      const current = Object.values(usePlatformStore.getState().platforms)
      if (current.length === 0) return
      const positions = current.map((p) =>
        Cesium.Cartesian3.fromDegrees(p.lon, p.lat, Math.max(p.alt, 0))
      )
      const sphere = Cesium.BoundingSphere.fromPoints(positions)
      // Clamp to 300–500 km altitude for a readable theater-level top-down view
      const spread = Math.max(sphere.radius, 200_000)
      const altitude = Math.min(Math.max(spread * 1.2, 300_000), 500_000)
      const carto = Cesium.Cartographic.fromCartesian(sphere.center)
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, altitude),
        orientation: {
          heading: 0,                      // north up
          pitch: -Cesium.Math.PI_OVER_TWO, // straight down
          roll: 0,
        },
        duration: 2.0,
      })
    }, 800)
    // No cleanup return here: clearing on each re-render would reset the
    // debounce on every mover_update. The simulationId effect handles
    // cancellation when a new simulation starts.
  }, [platforms, viewer])

  // Re-render when track settings change
  useEffect(() => {
    setRevision((r) => r + 1)
  }, [showTrackLines, trackLength, colorMode, showLabels])

  useEffect(() => {
    const now = Date.now()
    if (now - lastUpdateRef.current > 50) {
      lastUpdateRef.current = now
      setRevision((r) => r + 1)
    } else {
      const timer = setTimeout(() => setRevision((r) => r + 1), 50)
      return () => clearTimeout(timer)
    }
  }, [platforms])

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return

    const dataSource = viewer.entities
    const currentIds = new Set<number>()

    for (const [idxStr, platform] of Object.entries(platforms)) {
      const idx = Number(idxStr)
      currentIds.add(idx)

      let entity = entitiesRef.current.get(idx)
      // After a Viewer recreation the ref holds entities from the old (destroyed)
      // viewer — they are no longer in the new viewer's EntityCollection.
      // Treat them as absent so they get re-added to the current viewer.
      if (entity && !dataSource.contains(entity)) {
        entitiesRef.current.delete(idx)
        entity = undefined
      }
      const position = Cesium.Cartesian3.fromDegrees(platform.lon, platform.lat, platform.alt)

      // Update trail positions
      if (showTrackLines) {
        const trail = trailPositionsRef.current.get(idx) ?? []
        trail.push(position)
        // Limit trail length: keep positions within the trackLength window
        // Approximate: keep last N positions (assuming ~2 Hz update rate)
        const maxPositions = Math.max(10, trackLength * 2)
        if (trail.length > maxPositions) {
          trail.splice(0, trail.length - maxPositions)
        }
        trailPositionsRef.current.set(idx, trail)
      }

      if (entity) {
        entity.position = new Cesium.CallbackProperty(() => {
          const p = usePlatformStore.getState().platforms[idx]
          if (!p) return position
          return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
        }, false) as any

        // Update label visibility and color
        if (entity.label) {
          entity.label.show = showLabels as any
          entity.label.fillColor = getLabelColor(platform.side) as any
        }
      } else {
        const color = getSideColor(platform.side)
        entity = new Cesium.Entity({
          id: `platform_${idx}`,
          name: platform.name,
          position: new Cesium.CallbackProperty(() => {
            const p = usePlatformStore.getState().platforms[idx]
            if (!p) return position
            return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
          }, false) as any,
          billboard: {
            image: createPlatformIcon(platform.typeId, platform.side, platform.broken),
            width: 40,
            height: 40,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            scaleByDistance: new Cesium.NearFarScalar(1e3, 1.2, 1e6, 0.4),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          } as any,
          label: showLabels ? {
            text: platform.name,
            font: '13px sans-serif',
            fillColor: getLabelColor(platform.side),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            show: true,
          } as any : undefined,
          description: createDescription(platform),
        })

        dataSource.add(entity)
        entitiesRef.current.set(idx, entity)
      }

      // Manage trail polyline entity
      if (showTrackLines) {
        const trail = trailPositionsRef.current.get(idx) ?? []
        if (trail.length >= 2) {
          let trailEntity = trailEntitiesRef.current.get(idx)
          const trailColor = colorMode === 'side'
            ? getSideColor(platform.side).withAlpha(0.6)
            : getStatusColor(platform).withAlpha(0.6)

          // Discard stale trail entity from a destroyed viewer.
          if (trailEntity && !dataSource.contains(trailEntity)) {
            trailEntitiesRef.current.delete(idx)
            trailEntity = undefined
          }
          if (trailEntity) {
            // Update existing trail
            ;(trailEntity as any).polyline = {
              positions: trail,
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.15,
                color: trailColor,
              }),
              clampToGround: false,
            }
          } else {
            trailEntity = new Cesium.Entity({
              id: `trail_${idx}`,
              polyline: {
                positions: trail,
                width: 2,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.15,
                  color: trailColor,
                }),
                clampToGround: false,
              } as any,
            })
            dataSource.add(trailEntity)
            trailEntitiesRef.current.set(idx, trailEntity)
          }
        }
      }
    }

    // Clean up removed platforms
    for (const [idx, entity] of entitiesRef.current) {
      if (!currentIds.has(idx)) {
        dataSource.remove(entity)
        entitiesRef.current.delete(idx)
        trailPositionsRef.current.delete(idx)
        const trailEntity = trailEntitiesRef.current.get(idx)
        if (trailEntity) {
          dataSource.remove(trailEntity)
          trailEntitiesRef.current.delete(idx)
        }
      }
    }

    // Remove trail entities when track lines are disabled
    if (!showTrackLines) {
      for (const [idx, trailEntity] of trailEntitiesRef.current) {
        dataSource.remove(trailEntity)
        trailEntitiesRef.current.delete(idx)
      }
    }
  }, [viewer, revision, showTrackLines, trackLength, colorMode, showLabels])

  return null
}

/**
 * Infer equipment category from typeId patterns (AFSIM icon identifiers).
 */
function inferCategoryFromTypeId(typeId: string): string {
  const t = typeId.toUpperCase()
  if (t.includes('F-') || t.includes('SU-') || t.includes('J-') || t.includes('B-') || t.includes('MQ-') || t.includes('UAV') || t.includes('DRONE')) return 'aircraft'
  if (t.includes('DDG') || t.includes('CG') || t.includes('FFG') || t.includes('CVN') || t.includes('LHD') || t.includes('LSD') || t.includes('AOE')) return 'ship'
  if (t.includes('SSN') || t.includes('SSK') || t.includes('SSBN') || t.includes('SUB')) return 'submarine'
  if (t.includes('M1') || t.includes('T-90') || t.includes('HMMWV') || t.includes('MRAP') || t.includes('IFV') || t.includes('APC')) return 'vehicle'
  if (t.includes('SAM') || t.includes('PATRIOT') || t.includes('S-300') || t.includes('S-400') || t.includes('NASAMS')) return 'missile'
  if (t.includes('RADAR') || t.includes('EW') || t.includes('SIGINT') || t.includes('ELINT')) return 'sensor'
  if (t.includes('C2') || t.includes('COMMAND') || t.includes('GCI')) return 'vehicle'
  return 'aircraft' // default
}

// Cache for runtime icon canvases (to avoid regenerating every frame)
const runtimeIconCache = new Map<string, HTMLCanvasElement>()

function createPlatformIcon(typeId: string, side: string, broken?: boolean): HTMLCanvasElement {
  const cacheKey = `${typeId}:${side}:${broken ? '1' : '0'}`
  const cached = runtimeIconCache.get(cacheKey)
  if (cached) return cached

  const category = inferCategoryFromTypeId(typeId)
  const iconUrl = resolvePlatformIcon(typeId, category, side)

  // Render at 2x resolution (80x80) and display at 40x40 (via billboard width/height)
  // for sharper icons on high-DPI screens.
  const RENDER_SIZE = 80
  const canvas = document.createElement('canvas')
  canvas.width = RENDER_SIZE
  canvas.height = RENDER_SIZE
  const ctx = canvas.getContext('2d')!

  // Draw SVG icon via Image
  const img = new Image()
  img.src = iconUrl
  // For synchronous rendering, draw immediately (SVG data URLs load instantly)
  img.onload = () => {
    ctx.clearRect(0, 0, RENDER_SIZE, RENDER_SIZE)
    ctx.drawImage(img, 0, 0, RENDER_SIZE, RENDER_SIZE)
    if (broken) {
      ctx.strokeStyle = '#ff0000'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.moveTo(15, 15)
      ctx.lineTo(65, 65)
      ctx.moveTo(65, 15)
      ctx.lineTo(15, 65)
      ctx.stroke()
    }
  }

  // Fallback: draw colored circle if image hasn't loaded yet
  const color = getSideColor(side)
  ctx.beginPath()
  ctx.arc(40, 40, 30, 0, Math.PI * 2)
  ctx.fillStyle = broken ? '#ff0000' : color.toCssColorString()
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3
  ctx.stroke()

  runtimeIconCache.set(cacheKey, canvas)
  return canvas
}

function createDescription(platform: PlatformInfo): string {
  return `
    <div style="font-family: monospace; font-size: 12px;">
      <h3>${platform.name}</h3>
      <table>
        <tr><td>Type:</td><td>${platform.typeId}</td></tr>
        <tr><td>Side:</td><td>${platform.side}</td></tr>
        <tr><td>Position:</td><td>${(platform.lat ?? 0).toFixed(4)}°, ${(platform.lon ?? 0).toFixed(4)}°, ${(platform.alt ?? 0).toFixed(0)}m</td></tr>
        <tr><td>Damage:</td><td>${((platform.damageFactor ?? 0) * 100).toFixed(0)}%</td></tr>
        <tr><td>Status:</td><td>${platform.broken ? 'BROKEN' : platform.initialized ? 'Active' : 'Pending'}</td></tr>
      </table>
    </div>
  `
}
