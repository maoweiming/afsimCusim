/**
 * Leaflet 引擎适配器
 * 实现 MapEngine 接口，封装 Leaflet 2D 轻量地图功能
 */
import {
  MapEngine, MapEngineType, MapDimension,
  MapOptions, FlyOptions, LngLat, LngLatAlt, LngLatBounds,
  MapLayer, MapEntity, EntityStyle,
  MapClickEvent, MapHoverEvent, DrawEvent, ViewChangeEvent,
  LOSResult, ViewshedResult,
  ImagerySource, TerrainSource,
} from './MapEngine';

// Leaflet 类型引用（动态导入）
let L: any = null;

export class LeafletEngine implements MapEngine {
  readonly type: MapEngineType = 'leaflet';
  readonly dimension: MapDimension = '2d';

  private map: any = null;
  private container: HTMLElement | null = null;
  private entities: Map<string, any> = new Map();
  private entityData: Map<string, MapEntity> = new Map();
  private layers: Map<string, any> = new Map();
  private layerData: Map<string, MapLayer> = new Map();
  private eventCleanups: Array<() => void> = [];
  private selectedEntities: Set<string> = new Set();
  private entityLayerGroup: any = null;
  private drawControl: any = null;
  private drawCallback: ((event: DrawEvent) => void) | null = null;
  private drawMode: DrawEvent['type'] | null = null;
  private drawPoints: Array<{ lat: number; lng: number }> = [];
  private drawTempLayer: any = null;
  private drawHandlers: Array<() => void> = [];

  async initialize(container: HTMLElement, options?: MapOptions): Promise<void> {
    if (!L) {
      L = await import('leaflet');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    } else {
      // L 已缓存时 initialize() 退化为同步函数。React StrictMode 会连续调用两次
      // init()，两次 L.map(container) 背靠背执行，第二次抛出
      // "Container is already initialized"。用 setTimeout(0) 让第一次的
      // StrictMode cleanup（cancelled=true + engine.destroy()）在下一个
      // macrotask 之前完成，第二次调用才能安全运行。
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    this.container = container;

    // 保险：若前一次（被 StrictMode 取消的）init 在 cleanup 之前留下了 _leaflet_id，
    // 先把容器还原干净再创建新 map，避免 "Container is already initialized" 静默失败。
    if ((container as any)._leaflet_id) {
      container.innerHTML = '';
      delete (container as any)._leaflet_id;
    }

    const center = options?.center || { lng: 104, lat: 35 };
    const zoom = options?.zoom || 4;

    this.map = L.map(container, {
      center: [center.lat, center.lng],
      zoom,
      minZoom: options?.minZoom ?? 2,
      maxZoom: options?.maxZoom ?? 18,
      zoomControl: true,
      attributionControl: false,
    });

    const darkTile = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 20 }
    );
    darkTile.addTo(this.map);

    this.entityLayerGroup = L.layerGroup().addTo(this.map);

    // 防御容器在 init 时尚未完成 layout（高度为 0）导致瓦片错位
    requestAnimationFrame(() => { this.map?.invalidateSize(); });
  }

  destroy(): void {
    this.cancelDraw();
    this.eventCleanups.forEach(fn => fn());
    this.eventCleanups = [];
    this.entities.clear();
    this.entityData.clear();
    this.layers.clear();
    this.layerData.clear();
    this.drawCallback = null;
    if (this.map) {
      try { this.map.remove(); } catch { /* DOM may already be cleared */ }
      this.map = null;
    }
  }

  isReady(): boolean {
    return this.map !== null;
  }

  // ============ 地图操作 ============

  setView(center: LngLat, zoom: number): void {
    if (!this.map) return;
    this.map.setView([center.lat, center.lng], zoom, { animate: false });
  }

  flyTo(center: LngLat, zoom?: number, options?: FlyOptions): void {
    if (!this.map) return;
    this.map.flyTo([center.lat, center.lng], zoom ?? this.map.getZoom(), {
      duration: options?.duration ?? 1.5,
    });
  }

  fitBounds(bounds: LngLatBounds, padding = 0.1): void {
    if (!this.map) return;
    const leafletBounds = L.latLngBounds(
      [bounds.south - padding, bounds.west - padding],
      [bounds.north + padding, bounds.east + padding]
    );
    this.map.fitBounds(leafletBounds, { padding: [20, 20] });
  }

  getCenter(): LngLat {
    if (!this.map) return { lng: 0, lat: 0 };
    const center = this.map.getCenter();
    return { lng: center.lng, lat: center.lat };
  }

  getZoom(): number {
    if (!this.map) return 0;
    return this.map.getZoom();
  }

  getBounds(): LngLatBounds {
    if (!this.map) return { south: -90, west: -180, north: 90, east: 180 };
    const bounds = this.map.getBounds();
    return {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };
  }

  // ============ 底图和地形 ============

  private currentBaseLayer: any = null;

  setImagerySource(source: ImagerySource): void {
    if (!this.map) return;

    // 移除当前底图
    if (this.currentBaseLayer) {
      this.map.removeLayer(this.currentBaseLayer);
    }

    let tileUrl = '';
    const options: any = { maxZoom: 20 };

    switch (source.type) {
      case 'openstreetmap':
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        break;
      case 'tile':
        tileUrl = source.url || '';
        break;
      case 'wmts':
      case 'wms':
        // WMS/WMTS 需要更复杂的处理
        if (source.url) {
          this.currentBaseLayer = L.tileLayer.wms(source.url, {
            layers: source.layers || '',
            format: 'image/png',
            transparent: true,
            ...source.parameters,
          });
          this.currentBaseLayer.addTo(this.map);
          return;
        }
        break;
      case 'cesium-ion':
        // Cesium Ion 不直接支持 Leaflet，使用替代
        tileUrl = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
        break;
    }

    if (tileUrl) {
      this.currentBaseLayer = L.tileLayer(tileUrl, options);
      this.currentBaseLayer.addTo(this.map);
    }
  }

  setTerrainSource(_source: TerrainSource): void {
    // 2D 地图不支持地形渲染
  }

  getImagerySources(): ImagerySource[] {
    return [
      { id: 'osm', name: 'OpenStreetMap', type: 'openstreetmap', available: true },
      { id: 'dark', name: 'Dark Matter', type: 'tile', url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', available: true },
      { id: 'satellite', name: 'Satellite', type: 'tile', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', available: true },
      { id: 'terrain', name: 'Terrain', type: 'tile', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', available: true },
    ];
  }

  getTerrainSources(): TerrainSource[] {
    return []; // 2D 不支持
  }

  // ============ 图层管理 ============

  addLayer(layer: MapLayer): string {
    if (!this.map) return layer.id;

    let leafletLayer: any = null;

    switch (layer.type) {
      case 'imagery':
      case 'tile':
        if (layer.source.url) {
          leafletLayer = L.tileLayer(layer.source.url, { maxZoom: 20 });
        }
        break;
      case 'wms':
        if (layer.source.url) {
          leafletLayer = L.tileLayer.wms(layer.source.url, {
            layers: layer.source.layers || '',
            format: 'image/png',
            transparent: true,
            ...layer.source.parameters,
          });
        }
        break;
      case 'geojson':
        if (layer.source.data) {
          leafletLayer = L.geoJSON(layer.source.data, {
            style: (feature: any) => ({
              fillColor: layer.style?.fillColor || '#0078d7',
              fillOpacity: layer.style?.fillOpacity ?? 0.3,
              color: layer.style?.strokeColor || '#ffffff',
              weight: layer.style?.strokeWidth || 2,
            }),
            pointToLayer: (feature: any, latlng: any) => {
              return L.circleMarker(latlng, {
                radius: layer.style?.pointRadius || 6,
                fillColor: layer.style?.fillColor || '#0078d7',
                color: layer.style?.strokeColor || '#ffffff',
                weight: layer.style?.strokeWidth || 1,
                fillOpacity: layer.style?.fillOpacity ?? 0.8,
              });
            },
          });
        } else if (layer.source.url) {
          leafletLayer = L.geoJSON(undefined, {
            style: () => ({
              fillColor: layer.style?.fillColor || '#0078d7',
              fillOpacity: layer.style?.fillOpacity ?? 0.3,
              color: layer.style?.strokeColor || '#ffffff',
              weight: layer.style?.strokeWidth || 2,
            }),
          });
          fetch(layer.source.url)
            .then(r => r.json())
            .then(data => leafletLayer.addData(data))
            .catch(err => console.warn('[LeafletEngine] Failed to load GeoJSON layer:', err));
        }
        break;
    }

    if (leafletLayer) {
      if (layer.visible) {
        leafletLayer.addTo(this.map);
      }
      leafletLayer.setOpacity?.(layer.opacity);
      this.layers.set(layer.id, leafletLayer);
    }

    this.layerData.set(layer.id, { ...layer });
    return layer.id;
  }

  removeLayer(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer && this.map) {
      this.map.removeLayer(layer);
    }
    this.layers.delete(layerId);
    this.layerData.delete(layerId);
  }

  updateLayer(layerId: string, updates: Partial<MapLayer>): void {
    const existing = this.layerData.get(layerId);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    this.layerData.set(layerId, updated);

    const layer = this.layers.get(layerId);
    if (layer) {
      if (updates.visible !== undefined) {
        if (updates.visible) {
          layer.addTo(this.map);
        } else {
          this.map.removeLayer(layer);
        }
      }
      if (updates.opacity !== undefined) {
        layer.setOpacity?.(updates.opacity);
      }
    }
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    this.updateLayer(layerId, { visible });
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    this.updateLayer(layerId, { opacity });
  }

  getLayers(): MapLayer[] {
    return Array.from(this.layerData.values());
  }

  reorderLayers(layerIds: string[]): void {
    // Leaflet 通过 zIndex 控制
    layerIds.forEach((id, index) => {
      const layer = this.layers.get(id);
      if (layer && layer.setZIndex) {
        layer.setZIndex(index);
      }
    });
  }

  // ============ 实体管理 ============

  addEntity(entity: MapEntity): string {
    if (!this.map) return entity.id;

    const marker = this.createLeafletEntity(entity);
    if (marker) {
      marker.addTo(this.entityLayerGroup);
      this.entities.set(entity.id, marker);
      this.entityData.set(entity.id, { ...entity });
    }

    return entity.id;
  }

  private createLeafletEntity(entity: MapEntity): any {
    const style = entity.style || {};

    switch (entity.type) {
      case 'point': {
        if (!entity.position) return null;

        if (style.iconUrl) {
          const icon = L.icon({
            iconUrl: style.iconUrl,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          const marker = L.marker([entity.position.lat, entity.position.lng], {
            icon,
            rotationAngle: style.iconRotation || 0,
          });
          if (entity.label) {
            marker.bindTooltip(entity.label, { permanent: false, direction: 'top' });
          }
          return marker;
        }

        return L.circleMarker([entity.position.lat, entity.position.lng], {
          radius: style.pointSize || 6,
          fillColor: style.pointColor || '#0078d7',
          color: style.pointOutlineColor || '#ffffff',
          weight: style.pointOutlineWidth || 1,
          fillOpacity: 0.8,
        });
      }

      case 'polyline': {
        if (!entity.positions || entity.positions.length < 2) return null;
        const latlngs = entity.positions.map(p => [p.lat, p.lng]);
        const polyline = L.polyline(latlngs, {
          color: style.lineColor || '#0078d7',
          weight: style.lineWidth || 2,
          opacity: 0.8,
          dashArray: style.lineDash ? style.lineDash.join(' ') : undefined,
        });
        return polyline;
      }

      case 'polygon': {
        if (!entity.positions || entity.positions.length < 3) return null;
        const latlngs = entity.positions.map(p => [p.lat, p.lng]);
        const polygon = L.polygon(latlngs, {
          fillColor: style.fillColor || '#0078d7',
          fillOpacity: style.fillOpacity ?? 0.3,
          color: style.outlineColor || '#ffffff',
          weight: style.outlineWidth || 1,
        });
        return polygon;
      }

      case 'label': {
        if (!entity.position) return null;
        const marker = L.marker([entity.position.lat, entity.position.lng], {
          icon: L.divIcon({
            className: 'custom-label',
            html: `<span style="color:${style.labelColor || '#fff'};font-size:${style.labelSize || 14}px">${style.labelText || entity.label || ''}</span>`,
          }),
        });
        return marker;
      }

      default: {
        // Check for circle entity (passed via properties.radius)
        if (entity.position && entity.properties?.radius) {
          return L.circle([entity.position.lat, entity.position.lng], {
            radius: entity.properties.radius,
            fillColor: style.fillColor || '#0078d7',
            fillOpacity: style.fillOpacity ?? 0.3,
            color: style.outlineColor || '#ffffff',
            weight: style.outlineWidth || 1,
          });
        }
        return null;
      }
    }
  }

  removeEntity(entityId: string): void {
    const marker = this.entities.get(entityId);
    if (marker && this.entityLayerGroup) {
      this.entityLayerGroup.removeLayer(marker);
    }
    this.entities.delete(entityId);
    this.entityData.delete(entityId);
    this.selectedEntities.delete(entityId);
  }

  updateEntity(entityId: string, updates: Partial<MapEntity>): void {
    const existing = this.entityData.get(entityId);
    if (!existing) return;

    const updated = { ...existing, ...updates };
    if (updates.style) {
      updated.style = { ...existing.style, ...updates.style };
    }

    // 重建实体
    this.removeEntity(entityId);
    this.addEntity(updated);
  }

  setEntityVisibility(entityId: string, visible: boolean): void {
    const marker = this.entities.get(entityId);
    if (!marker) return;
    if (visible) {
      marker.addTo(this.entityLayerGroup);
    } else {
      this.entityLayerGroup.removeLayer(marker);
    }
  }

  getEntity(entityId: string): MapEntity | undefined {
    return this.entityData.get(entityId);
  }

  getEntities(): MapEntity[] {
    return Array.from(this.entityData.values());
  }

  clearEntities(): void {
    if (this.entityLayerGroup) {
      this.entityLayerGroup.clearLayers();
    }
    this.entities.clear();
    this.entityData.clear();
    this.selectedEntities.clear();
  }

  // ============ 选择和高亮 ============

  selectEntity(entityId: string): void {
    this.selectedEntities.add(entityId);
    this.highlightEntity(entityId, '#ffff00');
  }

  deselectEntity(entityId: string): void {
    this.selectedEntities.delete(entityId);
    this.unhighlightEntity(entityId);
  }

  deselectAll(): void {
    this.selectedEntities.forEach(id => this.unhighlightEntity(id));
    this.selectedEntities.clear();
  }

  getSelectedEntities(): MapEntity[] {
    return Array.from(this.selectedEntities)
      .map(id => this.entityData.get(id))
      .filter((e): e is MapEntity => e !== undefined);
  }

  highlightEntity(entityId: string, color = '#ffff00'): void {
    const marker = this.entities.get(entityId);
    if (!marker) return;

    if (marker.setStyle) {
      marker.setStyle({
        color,
        weight: 3,
        fillOpacity: 0.6,
      });
    }
  }

  unhighlightEntity(entityId: string): void {
    const entity = this.entityData.get(entityId);
    const marker = this.entities.get(entityId);
    if (!marker || !entity) return;

    if (marker.setStyle && entity.style) {
      marker.setStyle({
        color: entity.style.outlineColor || entity.style.lineColor || '#ffffff',
        weight: entity.style.outlineWidth || entity.style.lineWidth || 1,
        fillOpacity: entity.style.fillOpacity ?? 0.3,
      });
    }
  }

  // ============ 相机控制 ============

  flyToEntity(entityId: string, options?: FlyOptions): void {
    const marker = this.entities.get(entityId);
    if (!marker || !this.map) return;

    const bounds = marker.getBounds?.() || marker.getLatLng?.();
    if (bounds) {
      if (bounds.pad) {
        this.map.fitBounds(bounds.pad(0.5));
      } else {
        this.map.flyTo(bounds, this.map.getZoom());
      }
    }
  }

  trackEntity(_entityId: string): void {
    // Leaflet 不原生支持跟踪，需要在 updateEntity 中处理
  }

  untrackEntity(): void {
    // 清除跟踪
  }

  // ============ 事件监听 ============

  onClick(callback: (event: MapClickEvent) => void): () => void {
    if (!this.map) return () => {};

    const handler = (e: any) => {
      const lngLatAlt: LngLatAlt = {
        lng: e.latlng.lng,
        lat: e.latlng.lat,
        alt: 0,
      };

      // 检查点击的实体
      let entity: MapEntity | undefined;
      if (e.layer) {
        for (const [id, layer] of this.entities.entries()) {
          if (layer === e.layer) {
            entity = this.entityData.get(id);
            break;
          }
        }
      }

      callback({
        lngLat: lngLatAlt,
        entity,
        screenPosition: e.containerPoint ? { x: e.containerPoint.x, y: e.containerPoint.y } : undefined,
      });
    };

    this.map.on('click', handler);
    const cleanup = () => this.map?.off('click', handler);
    this.eventCleanups.push(cleanup);
    return cleanup;
  }

  onDoubleClick(callback: (event: MapClickEvent) => void): () => void {
    if (!this.map) return () => {};

    const handler = (e: any) => {
      callback({
        lngLat: { lng: e.latlng.lng, lat: e.latlng.lat, alt: 0 },
      });
    };

    this.map.on('dblclick', handler);
    const cleanup = () => this.map?.off('dblclick', handler);
    this.eventCleanups.push(cleanup);
    return cleanup;
  }

  onRightClick(callback: (event: MapClickEvent) => void): () => void {
    if (!this.map) return () => {};

    const handler = (e: any) => {
      callback({
        lngLat: { lng: e.latlng.lng, lat: e.latlng.lat, alt: 0 },
      });
    };

    this.map.on('contextmenu', handler);
    const cleanup = () => this.map?.off('contextmenu', handler);
    this.eventCleanups.push(cleanup);
    return cleanup;
  }

  onHover(callback: (event: MapHoverEvent) => void): () => void {
    if (!this.map) return () => {};

    const handler = (e: any) => {
      callback({
        lngLat: { lng: e.latlng.lng, lat: e.latlng.lat, alt: 0 },
      });
    };

    this.map.on('mousemove', handler);
    const cleanup = () => this.map?.off('mousemove', handler);
    this.eventCleanups.push(cleanup);
    return cleanup;
  }

  onViewChange(callback: (event: ViewChangeEvent) => void): () => void {
    if (!this.map) return () => {};

    const handler = () => {
      const center = this.getCenter();
      const zoom = this.getZoom();
      const bounds = this.getBounds();
      callback({ center, zoom, bounds });
    };

    this.map.on('moveend', handler);
    const cleanup = () => this.map?.off('moveend', handler);
    this.eventCleanups.push(cleanup);
    return cleanup;
  }

  onDraw(callback: (event: DrawEvent) => void): () => void {
    this.drawCallback = callback;
    return () => {
      this.drawCallback = null;
    };
  }

  // ============ 绘图工具 ============

  startDraw(type: DrawEvent['type']): void {
    if (!this.map) return;
    this.cancelDraw();

    this.drawMode = type;
    this.drawPoints = [];

    // 创建临时图层用于预览
    this.drawTempLayer = L.layerGroup().addTo(this.map);

    if (type === 'point') {
      const handler = (e: any) => {
        const pos = { lng: e.latlng.lng, lat: e.latlng.lat, alt: 0 };
        this.drawCallback?.({
          type: 'point',
          positions: [pos],
        });
        this.cancelDraw();
      };
      this.map.on('click', handler);
      this.drawHandlers.push(() => this.map?.off('click', handler));
    } else if (type === 'polyline' || type === 'polygon') {
      const clickHandler = (e: any) => {
        this.drawPoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
        this._updateDrawPreview();
      };

      const dblClickHandler = (e: any) => {
        L.DomEvent.stopPropagation(e);
        if (this.drawPoints.length >= 2) {
          const positions: LngLatAlt[] = this.drawPoints.map(p => ({
            lng: p.lng,
            lat: p.lat,
            alt: 0,
          }));
          this.drawCallback?.({ type, positions });
        }
        this.cancelDraw();
      };

      this.map.on('click', clickHandler);
      this.map.on('dblclick', dblClickHandler);
      // Prevent map zoom on double-click during draw
      this.map.doubleClickZoom.disable();
      this.drawHandlers.push(() => {
        this.map?.off('click', clickHandler);
        this.map?.off('dblclick', dblClickHandler);
        this.map?.doubleClickZoom.enable();
      });
    } else if (type === 'circle') {
      let centerLatLng: any = null;

      const clickHandler = (e: any) => {
        if (!centerLatLng) {
          centerLatLng = e.latlng;
          this.drawPoints.push({ lat: centerLatLng.lat, lng: centerLatLng.lng });
        } else {
          const radius = centerLatLng.distanceTo(e.latlng);
          const positions: LngLatAlt[] = [
            { lng: centerLatLng.lng, lat: centerLatLng.lat, alt: 0 },
          ];
          this.drawCallback?.({
            type: 'circle',
            positions,
            properties: { radius },
          });
          this.cancelDraw();
        }
      };

      const mouseMoveHandler = (e: any) => {
        if (!centerLatLng) return;
        this.drawTempLayer.clearLayers();
        const radius = centerLatLng.distanceTo(e.latlng);
        const circle = L.circle(centerLatLng, {
          radius,
          color: '#0078d7',
          fillColor: '#0078d7',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '6 3',
        });
        this.drawTempLayer.addLayer(circle);
      };

      this.map.on('click', clickHandler);
      this.map.on('mousemove', mouseMoveHandler);
      this.drawHandlers.push(() => {
        this.map?.off('click', clickHandler);
        this.map?.off('mousemove', mouseMoveHandler);
      });
    } else if (type === 'rectangle') {
      let startLatLng: any = null;

      const clickHandler = (e: any) => {
        if (!startLatLng) {
          startLatLng = e.latlng;
          this.drawPoints.push({ lat: startLatLng.lat, lng: startLatLng.lng });
        } else {
          const bounds = L.latLngBounds(startLatLng, e.latlng);
          const positions: LngLatAlt[] = [
            { lng: bounds.getWest(), lat: bounds.getSouth(), alt: 0 },
            { lng: bounds.getEast(), lat: bounds.getSouth(), alt: 0 },
            { lng: bounds.getEast(), lat: bounds.getNorth(), alt: 0 },
            { lng: bounds.getWest(), lat: bounds.getNorth(), alt: 0 },
          ];
          this.drawCallback?.({ type: 'rectangle', positions });
          this.cancelDraw();
        }
      };

      const mouseMoveHandler = (e: any) => {
        if (!startLatLng) return;
        this.drawTempLayer.clearLayers();
        const bounds = L.latLngBounds(startLatLng, e.latlng);
        const rect = L.rectangle(bounds, {
          color: '#0078d7',
          fillColor: '#0078d7',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '6 3',
        });
        this.drawTempLayer.addLayer(rect);
      };

      this.map.on('click', clickHandler);
      this.map.on('mousemove', mouseMoveHandler);
      this.drawHandlers.push(() => {
        this.map?.off('click', clickHandler);
        this.map?.off('mousemove', mouseMoveHandler);
      });
    }
  }

  cancelDraw(): void {
    this.drawHandlers.forEach(fn => fn());
    this.drawHandlers = [];
    this.drawPoints = [];
    this.drawMode = null;
    if (this.drawTempLayer) {
      this.drawTempLayer.clearLayers();
      if (this.map) this.map.removeLayer(this.drawTempLayer);
      this.drawTempLayer = null;
    }
  }

  /** Update the preview polyline/polygon while drawing */
  private _updateDrawPreview(): void {
    if (!this.drawTempLayer) return;
    this.drawTempLayer.clearLayers();

    if (this.drawMode === 'polyline' && this.drawPoints.length >= 1) {
      const latlngs = this.drawPoints.map(p => [p.lat, p.lng]);
      const polyline = L.polyline(latlngs, {
        color: '#0078d7',
        weight: 2,
        dashArray: '6 3',
      });
      this.drawTempLayer.addLayer(polyline);
    } else if (this.drawMode === 'polygon' && this.drawPoints.length >= 1) {
      const latlngs = this.drawPoints.map(p => [p.lat, p.lng]);
      const polygon = L.polygon(latlngs, {
        color: '#0078d7',
        fillColor: '#0078d7',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6 3',
      });
      this.drawTempLayer.addLayer(polygon);
    }

    // Draw vertex markers
    this.drawPoints.forEach(p => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        color: '#0078d7',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
      });
      this.drawTempLayer.addLayer(marker);
    });
  }

  // ============ 地形分析 ============

  async getTerrainHeight(_lng: number, _lat: number): Promise<number> {
    return 0; // 2D 地图不支持地形查询
  }

  async computeLineOfSight(_from: LngLatAlt, _to: LngLatAlt): Promise<LOSResult> {
    return { hasLOS: true, profile: [] };
  }

  async computeViewshed(_center: LngLatAlt, _radius: number, _resolution?: number): Promise<ViewshedResult> {
    return { visible: [], bounds: { south: 0, west: 0, north: 0, east: 0 }, resolution: 0, center: { lng: 0, lat: 0 }, radius: 0 };
  }

  async getTerrainProfile(positions: LngLat[]): Promise<Array<{ lng: number; lat: number; altitude: number }>> {
    return positions.map(p => ({ lng: p.lng, lat: p.lat, altitude: 0 }));
  }

  // ============ 坐标转换 ============

  lngLatToScreen(lngLat: LngLat): { x: number; y: number } | null {
    if (!this.map) return null;
    const point = this.map.latLngToContainerPoint([lngLat.lat, lngLat.lng]);
    return { x: point.x, y: point.y };
  }

  screenToLngLat(screen: { x: number; y: number }): LngLatAlt | null {
    if (!this.map) return null;
    const latlng = this.map.containerPointToLatLng([screen.x, screen.y]);
    return { lng: latlng.lng, lat: latlng.lat, alt: 0 };
  }

  // ============ 截图 ============

  async captureImage(_options?: { width?: number; height?: number; format?: 'png' | 'jpeg' }): Promise<Blob> {
    // Leaflet 截图需要 html2canvas 等库
    throw new Error('Leaflet captureImage not implemented - use html2canvas');
  }

  // ============ 坐标工具 ============

  metersToDegrees(meters: number, atLatitude: number): { lng: number; lat: number } {
    const latDeg = meters / 110540;
    const lngDeg = meters / (111320 * Math.cos(atLatitude * Math.PI / 180));
    return { lng: lngDeg, lat: latDeg };
  }

  degreesToMeters(lngDelta: number, latDelta: number, atLatitude: number): { east: number; north: number } {
    const east = lngDelta * 111320 * Math.cos(atLatitude * Math.PI / 180);
    const north = latDelta * 110540;
    return { east, north };
  }

  getNativeEngine(): any {
    return this.map;
  }
}
