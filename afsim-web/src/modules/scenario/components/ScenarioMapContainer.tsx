/**
 * 想定编辑器地图容器
 * 封装地图引擎（Leaflet 2D / Cesium 3D），提供点击和绘图回调
 */
import { useRef, useEffect, useLayoutEffect } from 'react';
import { EngineFactory } from '../../../core/map-engine/EngineFactory';
import { useMapDataStore } from '../../map-data/store/mapDataStore';
import type { MapEngine, MapEngineType, LngLat, LngLatAlt } from '../../../core/map-engine/MapEngine';

/** 拖拽放置时随 DataTransfer 传递的 MIME 类型（装备 ID） */
export const EQUIPMENT_DRAG_MIME = 'application/x-truesim-equipment-id';

interface ScenarioMapContainerProps {
  onMapReady?: (engine: MapEngine) => void;
  onClick?: (lngLat: LngLat) => void;
  onDraw?: (positions: LngLatAlt[]) => void;
  /** 从外部（如装备卡片）拖拽放下时触发，lngLat 为落点的地理坐标 */
  onDropEquipment?: (equipmentId: string, lngLat: LngLat) => void;
  /** 地图引擎类型：'leaflet'（2D，默认）或 'cesium'（3D） */
  engineType?: MapEngineType;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function ScenarioMapContainer({
  onMapReady,
  onClick,
  onDraw,
  onDropEquipment,
  engineType = 'leaflet',
  children,
  style,
}: ScenarioMapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const setActiveEngine = useMapDataStore((s) => s.setActiveEngine);

  // 地图引擎的事件订阅只在挂载时建立一次，但 onClick/onDraw 会随父组件状态
  // （如 activeTool）变化而重新创建，因此需要用 ref 持有最新回调，避免闭包过期
  const onClickRef = useRef(onClick);
  const onDrawRef = useRef(onDraw);
  const onDropEquipmentRef = useRef(onDropEquipment);
  useLayoutEffect(() => {
    onClickRef.current = onClick;
    onDrawRef.current = onDraw;
    onDropEquipmentRef.current = onDropEquipment;
  });

  // HTML5 拖拽放置：装备卡片拖到地图容器上时，按落点屏幕坐标转换为地理坐标
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(EQUIPMENT_DRAG_MIME)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      const equipmentId = e.dataTransfer?.getData(EQUIPMENT_DRAG_MIME);
      if (!equipmentId) return;
      e.preventDefault();
      const engine = engineRef.current;
      if (!engine) return;
      const rect = container.getBoundingClientRect();
      const lngLat = engine.screenToLngLat({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (lngLat) {
        onDropEquipmentRef.current?.(equipmentId, lngLat);
      }
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const init = async () => {
      try {
        const engine = EngineFactory.create(engineType);
        await engine.initialize(containerRef.current!, {
          center: { lng: 116.4, lat: 39.9 },
          zoom: 5,
        });
        if (cancelled) {
          engine.destroy();
          return;
        }
        engineRef.current = engine;
        setActiveEngine(engine);
        onMapReady?.(engine);

        engine.onClick((event) => {
          if (event.lngLat) onClickRef.current?.(event.lngLat);
        });

        engine.onDraw?.((event) => {
          onDrawRef.current?.(event.positions);
        });
      } catch (err) {
        console.error('[ScenarioMapContainer] engine init failed:', err);
      }
    };
    init();

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      setActiveEngine(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {children}
    </div>
  );
}

export default ScenarioMapContainer;
