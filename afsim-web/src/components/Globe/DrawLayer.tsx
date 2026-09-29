import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { positionFromDegrees } from '../../utils/cesiumUtils';

// ============ Draw Event Interface ============

export interface DrawEvent {
  id: string;
  type: 'line' | 'polyline' | 'point' | 'icon' | 'ellipse' | 'text';
  positions: Array<{ lat: number; lon: number; alt?: number }>;
  color?: string;
  width?: number;
  fillColor?: string;
  fillOpacity?: number;
  text?: string;
  iconUrl?: string;
  semiMajor?: number;
  semiMinor?: number;
  duration?: number;
  timestamp?: number;
}

// ============ Helper: Parse CSS color ============

function parseColor(colorStr?: string, alpha?: number): Cesium.Color {
  if (!colorStr) {
    const c = Cesium.Color.WHITE.clone();
    if (alpha !== undefined) c.alpha = alpha;
    return c;
  }
  const c = Cesium.Color.fromCssColorString(colorStr);
  if (alpha !== undefined) c.alpha = alpha;
  return c;
}

// ============ Component ============

interface DrawLayerProps {
  viewer: Cesium.Viewer;
  drawEvents: DrawEvent[];
  eraseIds?: string[];
}

export default function DrawLayer({ viewer, drawEvents, eraseIds }: DrawLayerProps) {
  const entitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevEventsRef = useRef<DrawEvent[]>([]);

  useEffect(() => {
    if (!viewer) return;

    const dataSource = viewer.entities;
    const currentIds = new Set<string>();

    for (const evt of drawEvents) {
      currentIds.add(evt.id);

      const existing = entitiesRef.current.get(evt.id);

      if (existing) {
        // Entity already exists - update if needed
        // For simplicity, remove and re-create on change
        dataSource.remove(existing);
        entitiesRef.current.delete(evt.id);
      }

      // Create new entity from draw event
      const entity = createDrawEntity(evt);
      if (entity) {
        dataSource.add(entity);
        entitiesRef.current.set(evt.id, entity);
      }

      // Set up duration-based auto-removal
      if (evt.duration && evt.duration > 0 && !timersRef.current.has(evt.id)) {
        const timer = setTimeout(() => {
          const ent = entitiesRef.current.get(evt.id);
          if (ent) {
            dataSource.remove(ent);
            entitiesRef.current.delete(evt.id);
          }
          timersRef.current.delete(evt.id);
        }, evt.duration * 1000);
        timersRef.current.set(evt.id, timer);
      }
    }

    // Remove entities no longer in drawEvents
    for (const [id, entity] of entitiesRef.current) {
      if (!currentIds.has(id)) {
        dataSource.remove(entity);
        entitiesRef.current.delete(id);
        const timer = timersRef.current.get(id);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(id);
        }
      }
    }

    prevEventsRef.current = drawEvents;
  }, [viewer, drawEvents]);

  // Handle explicit erase by ID
  useEffect(() => {
    if (!viewer || !eraseIds || eraseIds.length === 0) return;

    const dataSource = viewer.entities;
    for (const id of eraseIds) {
      const entity = entitiesRef.current.get(id);
      if (entity) {
        dataSource.remove(entity);
        entitiesRef.current.delete(id);
      }
      const timer = timersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }
  }, [viewer, eraseIds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return null;
}

// ============ Entity Factory ============

function createDrawEntity(evt: DrawEvent): Cesium.Entity | null {
  if (!evt.positions || evt.positions.length === 0) return null;

  const positions = evt.positions.map((p) =>
    positionFromDegrees(p.lon, p.lat, p.alt ?? 0)
  );

  const color = parseColor(evt.color);
  const width = evt.width ?? 2;

  switch (evt.type) {
    case 'line':
    case 'polyline': {
      if (positions.length < 2) return null;
      const entity = new Cesium.Entity({
        id: evt.id,
        polyline: {
          positions,
          width,
          material: color,
          clampToGround: false,
        } as any,
      });
      return entity;
    }

    case 'point': {
      const pos = positions[0];
      const entity = new Cesium.Entity({
        id: evt.id,
        position: pos,
        point: {
          pixelSize: width * 3,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        } as any,
      });
      return entity;
    }

    case 'icon': {
      if (!evt.iconUrl) return null;
      const pos = positions[0];
      const entity = new Cesium.Entity({
        id: evt.id,
        position: pos,
        billboard: {
          image: evt.iconUrl,
          scale: 1.0,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        } as any,
      });
      return entity;
    }

    case 'ellipse': {
      const pos = positions[0];
      const semiMajor = evt.semiMajor ?? 1000;
      const semiMinor = evt.semiMinor ?? semiMajor;
      const fillColor = parseColor(evt.fillColor ?? evt.color, evt.fillOpacity ?? 0.3);
      const entity = new Cesium.Entity({
        id: evt.id,
        position: pos,
        ellipse: {
          semiMajorAxis: semiMajor,
          semiMinorAxis: semiMinor,
          material: fillColor,
          outline: true,
          outlineColor: color,
          outlineWidth: 1,
        } as any,
      });
      return entity;
    }

    case 'text': {
      if (!evt.text) return null;
      const pos = positions[0];
      const entity = new Cesium.Entity({
        id: evt.id,
        position: pos,
        label: {
          text: evt.text,
          font: '14px sans-serif',
          fillColor: color,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        } as any,
      });
      return entity;
    }

    default:
      return null;
  }
}
