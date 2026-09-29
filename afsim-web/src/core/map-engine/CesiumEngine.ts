/**
 * CesiumJS 引擎适配器
 * 实现 MapEngine 接口，封装 CesiumJS 3D 地球功能
 */
import {
  MapEngine, MapEngineType, MapDimension,
  MapOptions, FlyOptions, LngLat, LngLatAlt, LngLatBounds,
  MapLayer, MapEntity, EntityStyle,
  MapClickEvent, MapHoverEvent, DrawEvent, ViewChangeEvent,
  LOSResult, ViewshedResult,
  ImagerySource, TerrainSource,
} from './MapEngine';

// Cesium 类型引用（动态导入）
let Cesium: any = null;

export class CesiumEngine implements MapEngine {
  readonly type: MapEngineType = 'cesium';
  readonly dimension: MapDimension = '3d';

  private viewer: any = null;
  private container: HTMLElement | null = null;
  private entities: Map<string, any> = new Map();
  private entityData: Map<string, MapEntity> = new Map();
  private layers: Map<string, any> = new Map();
  private layerData: Map<string, MapLayer> = new Map();
  private eventCleanups: Array<() => void> = [];
  private selectedEntities: Set<string> = new Set();
  private drawHandler: any = null;
  private trackedEntity: any = null;

  async initialize(container: HTMLElement, options?: MapOptions): Promise<void> {
    // 动态导入 Cesium
    if (!Cesium) {
      Cesium = await import('cesium');
    }

    this.container = container;

    const viewerOptions: any = {
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      sceneModePicker: false,
      geocoder: false,
      homeButton: options?.center ? false : true,
      navigationHelpButton: false,
      baseLayerPicker: false,
      requestRenderMode: false,
      maximumRenderTimeChange: Infinity,
    };

    // 设置地形
    if (options?.terrain !== false) {
      viewerOptions.terrainProvider = Cesium.Terrain.fromWorldTerrain();
    }

    this.viewer = new Cesium.Viewer(container, viewerOptions);

    // 按设备像素比渲染，避免在高 DPI 屏幕上图标/字体模糊
    this.viewer.resolutionScale = window.devicePixelRatio || 1;

    // 设置初始位置
    if (options?.center) {
      this.flyTo(options.center, options.zoom ?? 5, { duration: 0 });
    }

    // 禁用光照和雾
    this.viewer.scene.enableLighting = false;
    this.viewer.scene.fog.enabled = false;

    // 隐藏 credits
    const creditsEl = container.querySelector('.cesium-viewer-bottom');
    if (creditsEl) {
      (creditsEl as HTMLElement).style.display = 'none';
    }
  }

  destroy(): void {
    this.eventCleanups.forEach(fn => fn());
    this.eventCleanups = [];
    this.entities.clear();
    this.entityData.clear();
    this.layers.clear();
    this.layerData.clear();
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }

  isReady(): boolean {
    return this.viewer !== null;
  }

  // ============ 地图操作 ============

  setView(center: LngLat, zoom: number): void {
    if (!this.viewer) return;
    const height = this.zoomToHeight(zoom);
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat, height),
    });
  }

  flyTo(center: LngLat, zoom?: number, options?: FlyOptions): void {
    if (!this.viewer) return;
    const height = zoom !== undefined ? this.zoomToHeight(zoom) : undefined;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat, height ?? 1000000),
      duration: options?.duration ?? 2,
      orientation: {
        heading: options?.heading ? Cesium.Math.toRadians(options.heading) : undefined,
        pitch: options?.pitch ? Cesium.Math.toRadians(options.pitch) : undefined,
        roll: options?.roll ? Cesium.Math.toRadians(options.roll) : undefined,
      },
    });
  }

  fitBounds(bounds: LngLatBounds, padding = 0.1): void {
    if (!this.viewer) return;
    const extent = Cesium.Rectangle.fromDegrees(
      bounds.west - padding, bounds.south - padding,
      bounds.east + padding, bounds.north + padding
    );
    this.viewer.camera.flyTo({ destination: extent, duration: 1.5 });
  }

  getCenter(): LngLat {
    if (!this.viewer) return { lng: 0, lat: 0 };
    const camera = this.viewer.camera;
    const carto = Cesium.Cartographic.fromCartesian(camera.positionWC);
    return { lng: Cesium.Math.toDegrees(carto.longitude), lat: Cesium.Math.toDegrees(carto.latitude) };
  }

  getZoom(): number {
    if (!this.viewer) return 0;
    const height = this.viewer.camera.positionCartographic.height;
    return this.heightToZoom(height);
  }

  getBounds(): LngLatBounds {
    if (!this.viewer) return { south: -90, west: -180, north: 90, east: 180 };
    const rect = this.viewer.camera.computeViewRectangle();
    if (!rect) return { south: -90, west: -180, north: 90, east: 180 };
    return {
      south: Cesium.Math.toDegrees(rect.south),
      west: Cesium.Math.toDegrees(rect.west),
      north: Cesium.Math.toDegrees(rect.north),
      east: Cesium.Math.toDegrees(rect.east),
    };
  }

  // ============ 底图和地形 ============

  setImagerySource(source: ImagerySource): void {
    if (!this.viewer) return;
    // CesiumJS 底图切换通过 baseLayer 实现
    const layers = this.viewer.imageryLayers;
    layers.removeAll();

    if (source.type === 'openstreetmap') {
      layers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({ url: source.url }));
    } else if (source.type === 'tile' && source.url) {
      layers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({ url: source.url }));
    } else if (source.type === 'cesium-ion' && source.assetId) {
      layers.addImageryProvider(Cesium.ImageryLayer.fromProviderAsync(
        Cesium.IonImageryProvider.fromAssetId(source.assetId)
      ));
    }
  }

  setTerrainSource(source: TerrainSource): void {
    if (!this.viewer) return;
    if (source.type === 'cesium-ion') {
      this.viewer.terrainProvider = Cesium.Terrain.fromWorldTerrain();
    } else if (source.type === 'quantized-mesh' && source.url) {
      this.viewer.terrainProvider = new Cesium.CesiumTerrainProvider({ url: source.url });
    } else {
      this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }
  }

  getImagerySources(): ImagerySource[] {
    return [
      { id: 'cesium-ion', name: 'Cesium Ion', type: 'cesium-ion', assetId: 2, available: true },
      { id: 'osm', name: 'OpenStreetMap', type: 'openstreetmap', available: true },
      { id: 'dark', name: 'Dark Matter', type: 'tile', url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', available: true },
    ];
  }

  getTerrainSources(): TerrainSource[] {
    return [
      { id: 'cesium-ion', name: 'Cesium World Terrain', type: 'cesium-ion', assetId: 1, available: true },
      { id: 'ellipsoid', name: 'Ellipsoid (No Terrain)', type: 'custom', available: true },
    ];
  }

  // ============ 图层管理 ============

  addLayer(layer: MapLayer): string {
    if (!this.viewer) return layer.id;

    let imageryLayer: any = null;

    switch (layer.type) {
      case 'imagery':
        if (layer.source.url) {
          imageryLayer = this.viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({ url: layer.source.url })
          );
        }
        break;
      case 'wms':
        if (layer.source.url) {
          imageryLayer = this.viewer.imageryLayers.addImageryProvider(
            new Cesium.WebMapServiceImageryProvider({
              url: layer.source.url,
              layers: layer.source.layers || '',
              parameters: layer.source.parameters as any || {},
            })
          );
        }
        break;
      case 'geojson':
        if (layer.source.data || layer.source.url) {
          this.addGeoJsonLayer(layer);
        }
        break;
    }

    if (imageryLayer) {
      imageryLayer.show = layer.visible;
      imageryLayer.alpha = layer.opacity;
      this.layers.set(layer.id, imageryLayer);
    }

    this.layerData.set(layer.id, { ...layer });
    return layer.id;
  }

  private addGeoJsonLayer(layer: MapLayer): void {
    // 使用 Cesium.GeoJsonDataSource
    const dataSource = new Cesium.GeoJsonDataSource();
    if (layer.source.data) {
      dataSource.load(layer.source.data);
    } else if (layer.source.url) {
      dataSource.load(layer.source.url);
    }
    this.viewer.dataSources.add(dataSource);
    this.layers.set(layer.id, dataSource);
  }

  removeLayer(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer || !this.viewer) return;

    if (layer instanceof Cesium.ImageryLayer) {
      this.viewer.imageryLayers.remove(layer);
    } else if (layer instanceof Cesium.GeoJsonDataSource) {
      this.viewer.dataSources.remove(layer);
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
      if (updates.visible !== undefined) layer.show = updates.visible;
      if (updates.opacity !== undefined) layer.alpha = updates.opacity;
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
    // Cesium imageryLayers 通过 raise/lower 控制顺序
    // 这里简化实现
  }

  // ============ 实体管理 ============

  addEntity(entity: MapEntity): string {
    if (!this.viewer) return entity.id;

    const czEntity = this.createCesiumEntity(entity);
    this.viewer.entities.add(czEntity);
    this.entities.set(entity.id, czEntity);
    this.entityData.set(entity.id, { ...entity });

    return entity.id;
  }

  private createCesiumEntity(entity: MapEntity): any {
    const style = entity.style || {};
    const czEntity: any = { id: entity.id };

    if (entity.label) {
      czEntity.name = entity.label;
    }

    // 位置
    if (entity.position) {
      czEntity.position = Cesium.Cartesian3.fromDegrees(
        entity.position.lng, entity.position.lat, entity.position.alt || 0
      );
    }

    // 方向
    if (entity.heading !== undefined) {
      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(entity.heading),
        Cesium.Math.toRadians(entity.pitch || 0),
        Cesium.Math.toRadians(entity.roll || 0)
      );
      czEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
        czEntity.position || Cesium.Cartesian3.ZERO, hpr
      );
    }

    // 根据类型创建图形
    switch (entity.type) {
      case 'point':
        if (style.iconUrl) {
          czEntity.billboard = {
            image: style.iconUrl,
            scale: style.iconScale || 1,
            rotation: style.iconRotation ? Cesium.Math.toRadians(-style.iconRotation) : 0,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
          };
        } else {
          czEntity.point = {
            pixelSize: style.pointSize || 10,
            color: this.parseColor(style.pointColor || '#0078d7'),
            outlineColor: this.parseColor(style.pointOutlineColor || '#ffffff'),
            outlineWidth: style.pointOutlineWidth || 1,
          };
        }
        break;

      case 'polyline':
        czEntity.polyline = {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(
            (entity.positions || []).flatMap(p => [p.lng, p.lat, p.alt || 0])
          ),
          width: style.lineWidth || 2,
          material: style.lineGlow
            ? new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: this.parseColor(style.lineGlowColor || style.lineColor || '#0078d7'),
              })
            : this.parseColor(style.lineColor || '#0078d7'),
          clampToGround: false,
        };
        if (style.lineDash) {
          czEntity.polyline.material = new Cesium.PolylineDashMaterialProperty({
            color: this.parseColor(style.lineColor || '#0078d7'),
            dashLength: style.lineDash[0] || 16,
            dashPattern: parseInt('1111', 2),
          });
        }
        break;

      case 'polygon':
        czEntity.polygon = {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(
            (entity.positions || []).flatMap(p => [p.lng, p.lat])
          ),
          material: this.parseColorWithAlpha(style.fillColor || '#0078d7', style.fillOpacity ?? 0.3),
          outline: true,
          outlineColor: this.parseColor(style.outlineColor || '#ffffff'),
          outlineWidth: style.outlineWidth || 1,
        };
        break;

      case 'label':
        czEntity.label = {
          text: style.labelText || entity.label || '',
          font: `${style.labelSize || 14}px ${style.labelFont || 'sans-serif'}`,
          fillColor: this.parseColor(style.labelColor || '#ffffff'),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(
            style.labelOffset?.[0] || 0,
            style.labelOffset?.[1] || -10
          ),
        };
        break;
    }

    // 标签（附加到任何类型）
    if (entity.label && entity.type !== 'label') {
      czEntity.label = {
        text: entity.label,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 1,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        showBackground: true,
        backgroundColor: new Cesium.Color(0.1, 0.1, 0.1, 0.7),
      };
    }

    // 属性
    czEntity.properties = entity.properties || {};

    return czEntity;
  }

  removeEntity(entityId: string): void {
    const czEntity = this.entities.get(entityId);
    if (czEntity && this.viewer) {
      this.viewer.entities.remove(czEntity);
    }
    this.entities.delete(entityId);
    this.entityData.delete(entityId);
    this.selectedEntities.delete(entityId);
  }

  updateEntity(entityId: string, updates: Partial<MapEntity>): void {
    const existing = this.entityData.get(entityId);
    if (!existing) return;

    // 合并更新
    const updated = { ...existing, ...updates };
    if (updates.style) {
      updated.style = { ...existing.style, ...updates.style };
    }

    // 重建实体（CesiumJS 不支持直接修改大部分属性）
    this.removeEntity(entityId);
    this.addEntity(updated);
  }

  setEntityVisibility(entityId: string, visible: boolean): void {
    const czEntity = this.entities.get(entityId);
    if (czEntity) czEntity.show = visible;
  }

  getEntity(entityId: string): MapEntity | undefined {
    return this.entityData.get(entityId);
  }

  getEntities(): MapEntity[] {
    return Array.from(this.entityData.values());
  }

  clearEntities(): void {
    if (!this.viewer) return;
    this.viewer.entities.removeAll();
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
    const czEntity = this.entities.get(entityId);
    if (!czEntity) return;

    // 添加高亮效果
    if (czEntity.point) {
      czEntity.point.outlineColor = Cesium.Color.fromCssColorString(color);
      czEntity.point.outlineWidth = 3;
    } else if (czEntity.billboard) {
      czEntity.billboard.color = Cesium.Color.fromCssColorString(color);
    }
  }

  unhighlightEntity(entityId: string): void {
    const czEntity = this.entities.get(entityId);
    if (!czEntity) return;

    if (czEntity.point) {
      czEntity.point.outlineColor = Cesium.Color.WHITE;
      czEntity.point.outlineWidth = 1;
    } else if (czEntity.billboard) {
      czEntity.billboard.color = Cesium.Color.WHITE;
    }
  }

  // ============ 相机控制 ============

  flyToEntity(entityId: string, options?: FlyOptions): void {
    const czEntity = this.entities.get(entityId);
    if (!czEntity || !this.viewer) return;

    this.viewer.flyTo(czEntity, {
      duration: options?.duration ?? 2,
      offset: options?.pitch ? new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(options.heading || 0),
        Cesium.Math.toRadians(options.pitch),
      ) : undefined,
    });
  }

  trackEntity(entityId: string): void {
    const czEntity = this.entities.get(entityId);
    if (!czEntity || !this.viewer) return;
    this.viewer.trackedEntity = czEntity;
    this.trackedEntity = czEntity;
  }

  untrackEntity(): void {
    if (!this.viewer) return;
    this.viewer.trackedEntity = undefined;
    this.trackedEntity = null;
  }

  // ============ 事件监听 ============

  onClick(callback: (event: MapClickEvent) => void): () => void {
    return this.addEventHandler('LEFT_CLICK', callback);
  }

  onDoubleClick(callback: (event: MapClickEvent) => void): () => void {
    return this.addEventHandler('LEFT_DOUBLE_CLICK', callback);
  }

  onRightClick(callback: (event: MapClickEvent) => void): () => void {
    return this.addEventHandler('RIGHT_CLICK', callback);
  }

  onHover(callback: (event: MapHoverEvent) => void): () => void {
    if (!this.viewer) return () => {};

    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const cartesian = this.viewer.camera.pickEllipsoid(
        movement.endPosition, this.viewer.scene.globe.ellipsoid
      );
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lngLat: LngLatAlt = {
        lng: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude),
        alt: carto.height ?? 0,
      };

      // 检查是否悬停在实体上
      const picked = this.viewer.scene.pick(movement.endPosition);
      let entity: MapEntity | undefined;
      if (picked && picked.id) {
        entity = this.entityData.get(picked.id.id || picked.id);
      }

      callback({
        lngLat,
        entity,
        layerId: undefined,
      });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    const cleanup = () => handler.destroy();
    this.eventCleanups.push(cleanup);
    return cleanup;
  }

  onViewChange(callback: (event: ViewChangeEvent) => void): () => void {
    if (!this.viewer) return () => {};

    const removeListener = this.viewer.camera.changed.addEventListener(() => {
      const center = this.getCenter();
      const zoom = this.getZoom();
      const bounds = this.getBounds();
      const heading = Cesium.Math.toDegrees(this.viewer.camera.heading);
      const pitch = Cesium.Math.toDegrees(this.viewer.camera.pitch);
      callback({ center, zoom, bounds, heading, pitch });
    });

    this.eventCleanups.push(removeListener);
    return removeListener;
  }

  onDraw(callback: (event: DrawEvent) => void): () => void {
    // 绘图功能需要更复杂的实现
    // 暂时返回空函数
    return () => {};
  }

  private addEventHandler(eventType: string, callback: (event: MapClickEvent) => void): () => void {
    if (!this.viewer) return () => {};

    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const ray = this.viewer.camera.getPickRay(click.position);
      const cartesian = (ray && this.viewer.scene.globe.pick(ray, this.viewer.scene))
        || this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid);
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lngLatAlt: LngLatAlt = {
        lng: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude),
        alt: carto.height,
      };

      // 检查点击的实体
      const picked = this.viewer.scene.pick(click.position);
      let entity: MapEntity | undefined;
      if (picked && picked.id) {
        entity = this.entityData.get(picked.id.id || picked.id);
      }

      callback({
        lngLat: lngLatAlt,
        entity,
        screenPosition: { x: click.position.x, y: click.position.y },
      });
    }, (Cesium.ScreenSpaceEventType as any)[eventType]);

    const cleanup = () => handler.destroy();
    this.eventCleanups.push(cleanup);
    return cleanup;
  }

  // ============ 绘图工具 ============

  startDraw(type: DrawEvent['type']): void {
    // 绘图功能需要更复杂的实现
    // 暂时留空
  }

  cancelDraw(): void {
    if (this.drawHandler) {
      this.drawHandler.destroy();
      this.drawHandler = null;
    }
  }

  // ============ 地形分析 ============

  async getTerrainHeight(lng: number, lat: number): Promise<number> {
    if (!this.viewer) return 0;

    const cartographic = Cesium.Cartographic.fromDegrees(lng, lat);
    try {
      const heights = await Cesium.sampleTerrainMostDetailed(
        this.viewer.terrainProvider, [cartographic]
      );
      return heights[0]?.height ?? 0;
    } catch {
      return 0;
    }
  }

  async computeLineOfSight(from: LngLatAlt, to: LngLatAlt): Promise<LOSResult> {
    if (!this.viewer) {
      return { hasLOS: true, profile: [] };
    }

    const numSamples = 100;
    const profile: LOSResult['profile'] = [];
    let hasLOS = true;
    let obstructionPoint: LngLatAlt | undefined;

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const lng = from.lng + (to.lng - from.lng) * t;
      const lat = from.lat + (to.lat - from.lat) * t;
      const losHeight = from.alt + (to.alt - from.alt) * t;
      const distance = t * this.haversineDistance(from, to);

      const terrainHeight = await this.getTerrainHeight(lng, lat);

      profile.push({ distance, terrainHeight, losHeight });

      if (terrainHeight > losHeight && hasLOS) {
        hasLOS = false;
        obstructionPoint = { lng, lat, alt: terrainHeight };
      }
    }

    return { hasLOS, obstructionPoint, profile };
  }

  async computeViewshed(center: LngLatAlt, radius: number, resolution = 50): Promise<ViewshedResult> {
    // 简化的视域分析实现
    const gridSize = Math.ceil(radius / resolution);
    const visible: boolean[][] = [];

    for (let i = 0; i < gridSize * 2; i++) {
      visible[i] = [];
      for (let j = 0; j < gridSize * 2; j++) {
        const dx = (i - gridSize) * resolution;
        const dy = (j - gridSize) * resolution;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) {
          visible[i][j] = false;
          continue;
        }

        // 简化：假设无障碍物即可见
        const targetLng = center.lng + (dx / 111320) / Math.cos(center.lat * Math.PI / 180);
        const targetLat = center.lat + dy / 110540;
        const terrainHeight = await this.getTerrainHeight(targetLng, targetLat);
        visible[i][j] = terrainHeight <= center.alt;
      }
    }

    const halfSpan = (gridSize * resolution) / 111320;
    return {
      visible,
      bounds: {
        south: center.lat - halfSpan,
        north: center.lat + halfSpan,
        west: center.lng - halfSpan / Math.cos(center.lat * Math.PI / 180),
        east: center.lng + halfSpan / Math.cos(center.lat * Math.PI / 180),
      },
      resolution,
      center: { lng: center.lng, lat: center.lat },
      radius,
    };
  }

  async getTerrainProfile(positions: LngLat[]): Promise<Array<{ lng: number; lat: number; altitude: number }>> {
    const result: Array<{ lng: number; lat: number; altitude: number }> = [];
    for (const pos of positions) {
      const altitude = await this.getTerrainHeight(pos.lng, pos.lat);
      result.push({ lng: pos.lng, lat: pos.lat, altitude });
    }
    return result;
  }

  // ============ 坐标转换 ============

  lngLatToScreen(lngLat: LngLat): { x: number; y: number } | null {
    if (!this.viewer) return null;
    const cartesian = Cesium.Cartesian3.fromDegrees(lngLat.lng, lngLat.lat);
    const screenPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(this.viewer.scene, cartesian);
    if (!screenPos) return null;
    return { x: screenPos.x, y: screenPos.y };
  }

  screenToLngLat(screen: { x: number; y: number }): LngLatAlt | null {
    if (!this.viewer) return null;
    const cartesian2 = new Cesium.Cartesian2(screen.x, screen.y);
    // globe.pick respects terrain; pickEllipsoid is the fallback when looking away from earth
    const ray = this.viewer.camera.getPickRay(cartesian2);
    const cartesian = (ray && this.viewer.scene.globe.pick(ray, this.viewer.scene))
      || this.viewer.camera.pickEllipsoid(cartesian2, this.viewer.scene.globe.ellipsoid);
    if (!cartesian) return null;
    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    return {
      lng: Cesium.Math.toDegrees(carto.longitude),
      lat: Cesium.Math.toDegrees(carto.latitude),
      alt: carto.height,
    };
  }

  // ============ 截图 ============

  async captureImage(options?: { width?: number; height?: number; format?: 'png' | 'jpeg' }): Promise<Blob> {
    if (!this.viewer) throw new Error('Engine not initialized');

    this.viewer.render();
    const canvas = this.viewer.scene.canvas;

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to capture image'));
        },
        options?.format === 'jpeg' ? 'image/jpeg' : 'image/png',
        0.9
      );
    });
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
    return this.viewer;
  }

  // ============ 私有辅助方法 ============

  private zoomToHeight(zoom: number): number {
    // 近似 zoom → camera height 映射
    return 40075016.686 * Math.pow(2, -zoom) / 2;
  }

  private heightToZoom(height: number): number {
    return Math.log2(40075016.686 / (height * 2));
  }

  private parseColor(color: string): any {
    return Cesium.Color.fromCssColorString(color);
  }

  private parseColorWithAlpha(color: string, alpha: number): any {
    const c = Cesium.Color.fromCssColorString(color);
    c.alpha = alpha;
    return c;
  }

  private haversineDistance(a: LngLat, b: LngLat): number {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
}
