/**
 * DualMapView - Split screen with 2D and 3D maps
 * Supports synchronized view between engines
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { MapView } from './MapView';
import type { MapEngine, MapEngineType, MapOptions, MapEntity, LngLat } from '../../core/map-engine/MapEngine';

interface DualMapViewProps {
  options?: MapOptions;
  entities?: MapEntity[];
  syncView?: boolean;
  style?: React.CSSProperties;
}

export function DualMapView({
  options,
  entities = [],
  syncView = true,
  style,
}: DualMapViewProps) {
  const leftEngineRef = useRef<MapEngine | null>(null);
  const rightEngineRef = useRef<MapEngine | null>(null);
  const syncingRef = useRef(false);

  const handleLeftReady = useCallback((engine: MapEngine) => {
    leftEngineRef.current = engine;
  }, []);

  const handleRightReady = useCallback((engine: MapEngine) => {
    rightEngineRef.current = engine;
  }, []);

  // Sync view between engines
  useEffect(() => {
    if (!syncView) return;

    const leftEngine = leftEngineRef.current;
    const rightEngine = rightEngineRef.current;
    if (!leftEngine || !rightEngine) return;

    const leftCleanup = leftEngine.onViewChange((event) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      rightEngine.setView(event.center, event.zoom);
      syncingRef.current = false;
    });

    const rightCleanup = rightEngine.onViewChange((event) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      leftEngine.setView(event.center, event.zoom);
      syncingRef.current = false;
    });

    return () => {
      leftCleanup();
      rightCleanup();
    };
  }, [syncView, leftEngineRef.current, rightEngineRef.current]);

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      ...style,
    }}>
      <div style={{ flex: 1, borderRight: '1px solid #30363d' }}>
        <MapView
          engineType="cesium"
          options={options}
          entities={entities}
          onEngineReady={handleLeftReady}
          showEngineSelector={false}
        />
      </div>
      <div style={{ flex: 1 }}>
        <MapView
          engineType="leaflet"
          options={options}
          entities={entities}
          onEngineReady={handleRightReady}
          showEngineSelector={false}
        />
      </div>
    </div>
  );
}
