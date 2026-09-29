import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'

import { useSimStore } from '../../store/simStore'
import { useTrackSettingsStore } from '../../store/trackSettingsStore'
import { getScenarioText } from '../../api/client'
import { parseScenarioRoutes, ParsedRoute } from '../../utils/scenarioRouteParser'

const ROUTE_COLOR = Cesium.Color.fromCssColorString('#ffd54f')

export default function RouteLayer({ viewer }: { viewer: Cesium.Viewer | null }) {
  const scenarioId = useSimStore((s) => s.scenarioId)
  const showRoutes = useTrackSettingsStore((s) => s.showRoutes)
  const [routes, setRoutes] = useState<ParsedRoute[]>([])
  const entitiesRef = useRef<Cesium.Entity[]>([])

  // Fetch and parse the scenario's standalone named routes whenever the scenario changes.
  useEffect(() => {
    if (!scenarioId) {
      setRoutes([])
      return
    }
    let cancelled = false
    getScenarioText(scenarioId)
      .then((text) => {
        if (cancelled) return
        setRoutes(parseScenarioRoutes(text))
      })
      .catch((err) => {
        console.warn('[RouteLayer] failed to load scenario routes:', err)
        if (!cancelled) setRoutes([])
      })
    return () => {
      cancelled = true
    }
  }, [scenarioId])

  // Render parsed routes as polylines + labels
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return
    const dataSource = viewer.entities

    // Clear previous route entities
    for (const entity of entitiesRef.current) {
      dataSource.remove(entity)
    }
    entitiesRef.current = []

    if (!showRoutes) return

    for (const route of routes) {
      if (route.waypoints.length < 2) continue
      const positions = route.waypoints.map((wp) =>
        Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
      )

      const polylineEntity = new Cesium.Entity({
        id: `route_${route.name}`,
        polyline: {
          positions,
          width: 2,
          material: new Cesium.PolylineDashMaterialProperty({
            color: ROUTE_COLOR,
            dashLength: 16,
          }),
          clampToGround: false,
        } as any,
      })
      dataSource.add(polylineEntity)
      entitiesRef.current.push(polylineEntity)

      const labelEntity = new Cesium.Entity({
        id: `route_label_${route.name}`,
        position: positions[0],
        label: {
          text: route.name,
          font: '12px sans-serif',
          fillColor: ROUTE_COLOR,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        } as any,
      })
      dataSource.add(labelEntity)
      entitiesRef.current.push(labelEntity)
    }
  }, [viewer, routes, showRoutes])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (!viewer || viewer.isDestroyed()) return
      for (const entity of entitiesRef.current) {
        viewer.entities.remove(entity)
      }
      entitiesRef.current = []
    }
  }, [viewer])

  return null
}
