/**
 * MapView - Generic map component using MapEngine abstraction
 * Supports runtime switching between CesiumJS 3D and Leaflet 2D
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { Select, Space, Tag, Spin } from 'antd';
import { GlobalOutlined, HeatMapOutlined } from '@ant-design/icons';
import { EngineFactory } from '../../core/map-engine/EngineFactory';
import type { MapEngine, MapEngineType, MapOptions, MapEntity, MapLayer } from '../../core/map-engine/MapEngine';

interface MapViewProps {
  engineType?: MapEngineType;
  options?: MapOptions;
  entities?: MapEntity[];
  layers?: MapLayer[];
  onEngineReady?: (engine: MapEngine) => void;
  onEntityClick?: (entity: MapEntity | undefined) => void;
  style?: React.CSSProperties;
  showEngineSelector?: boolean;
}

export function MapView({
  engineType: initialEngineType = 'leaflet',
  options,
  entities = [],
  layers = [],
  onEngineReady,
  onEntityClick,
  style,
  showEngineSelector = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const [engineType, setEngineType] = useState<MapEngineType>(initialEngineType);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize engine
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        // Destroy previous engine
        if (engineRef.current) {
          engineRef.current.destroy();
          engineRef.current = null;
        }

        const engine = EngineFactory.create(engineType);
        await engine.initialize(containerRef.current!, options);

        if (cancelled) {
          engine.destroy();
          return;
        }

        engineRef.current = engine;
        setLoading(false);
        onEngineReady?.(engine);

        // Set up click handler
        engine.onClick((event) => {
          onEntityClick?.(event.entity);
        });
      } catch (e) {
        if (!cancelled) {
          setError(`地图引擎初始化失败: ${e instanceof Error ? e.message : String(e)}`);
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [engineType, options]);

  // Sync entities
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine?.isReady()) return;

    // Clear and re-add entities
    engine.clearEntities();
    entities.forEach((entity) => engine.addEntity(entity));
  }, [entities]);

  // Sync layers
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine?.isReady()) return;

    layers.forEach((layer) => {
      const existing = engine.getLayers().find((l) => l.id === layer.id);
      if (existing) {
        engine.updateLayer(layer.id, layer);
      } else {
        engine.addLayer(layer);
      }
    });
  }, [layers]);

  const handleEngineSwitch = useCallback((type: MapEngineType) => {
    setEngineType(type);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
      {showEngineSelector && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1000,
        }}>
          <Select
            value={engineType}
            onChange={handleEngineSwitch}
            size="small"
            style={{ width: 160 }}
            options={[
              {
                value: 'cesium',
                label: (
                  <Space size={4}>
                    <GlobalOutlined />
                    <span>CesiumJS</span>
                    <Tag color="blue" style={{ fontSize: 10 }}>3D</Tag>
                  </Space>
                ),
              },
              {
                value: 'leaflet',
                label: (
                  <Space size={4}>
                    <HeatMapOutlined />
                    <span>Leaflet</span>
                    <Tag color="green" style={{ fontSize: 10 }}>2D</Tag>
                  </Space>
                ),
              },
            ]}
          />
        </div>
      )}

      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(13, 17, 23, 0.8)',
          zIndex: 999,
        }}>
          <Spin size="large" tip="加载地图引擎..." />
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(13, 17, 23, 0.9)',
          zIndex: 999,
          color: '#d72828',
          fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
