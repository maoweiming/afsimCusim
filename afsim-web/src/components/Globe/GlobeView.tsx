import { useRef, useState } from 'react'
import { Viewer } from 'resium'
import * as Cesium from 'cesium'

import PlatformLayer from './PlatformLayer'
import RouteLayer from './RouteLayer'
import SensorCoverageLayer from './SensorCoverageLayer'

export default function GlobeView() {
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null)
  // Stable element: must not change between renders or Resium recreates the entire Viewer.
  const creditContainerRef = useRef<HTMLDivElement>(document.createElement('div'))

  const handleViewerReady = (v: Cesium.Viewer) => {
    viewerRef.current = v
    setViewer(v)

    v.scene.globe.enableLighting = false
    v.scene.fog.enabled = false

    // Load imagery from local OSM tiles (public/tiles/{z}/{x}/{y}.png).
    // OSM uses XYZ scheme: y=0 is north — use {y}, NOT {reverseY}.
    // Run scripts/download_tiles.py to populate the tile cache.
    v.imageryLayers.removeAll()
    v.imageryLayers.add(
      Cesium.ImageryLayer.fromProviderAsync(
        Promise.resolve(
          new Cesium.UrlTemplateImageryProvider({
            url: '/tiles/{z}/{x}/{y}.png',
            minimumLevel: 0,
            maximumLevel: 14,          // display up to z=14 if tiles exist
            tilingScheme: new Cesium.WebMercatorTilingScheme(),
            credit: 'Map data © OpenStreetMap contributors',
          })
        )
      )
    )

    if (v.animation) (v.animation.container as HTMLElement).style.display = 'none'
    if (v.timeline) (v.timeline.container as HTMLElement).style.display = 'none'
    if (v.fullscreenButton) (v.fullscreenButton.container as HTMLElement).style.display = 'none'
    if (v.infoBox) (v.infoBox.container as HTMLElement).style.display = 'none'
    if (v.selectionIndicator) (v.selectionIndicator.container as HTMLElement).style.display = 'none'
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Viewer
        full
        ref={(e: any) => {
          if (e?.cesiumElement) handleViewerReady(e.cesiumElement)
        }}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={true}
        sceneModePicker={false}
        navigationHelpButton={false}
        selectionIndicator={true}
        infoBox={true}
        creditContainer={creditContainerRef.current}
      >
        <PlatformLayer viewer={viewer} />
        <RouteLayer viewer={viewer} />
        <SensorCoverageLayer viewer={viewer} />
      </Viewer>
    </div>
  )
}
