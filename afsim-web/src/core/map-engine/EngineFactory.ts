/**
 * 地图引擎工厂
 * 根据配置创建对应的引擎实例
 */
import { MapEngine, MapEngineType, MapEngineDescriptor, MapDimension } from './MapEngine';
import { CesiumEngine } from './CesiumEngine';
import { LeafletEngine } from './LeafletEngine';

// 引擎注册表
const engineRegistry: Map<MapEngineType, {
  descriptor: MapEngineDescriptor;
  factory: () => MapEngine;
}> = new Map();

// 注册引擎
engineRegistry.set('cesium', {
  descriptor: {
    id: 'cesium',
    name: 'CesiumJS',
    dimension: '3d',
    icon: 'GlobalOutlined',
    available: true,
  },
  factory: () => new CesiumEngine(),
});

engineRegistry.set('leaflet', {
  descriptor: {
    id: 'leaflet',
    name: 'Leaflet',
    dimension: '2d',
    icon: 'HeatMapOutlined',
    available: true,
  },
  factory: () => new LeafletEngine(),
});

// 未来可扩展
// engineRegistry.set('mapboxgl', { ... });
// engineRegistry.set('openlayers', { ... });

export class EngineFactory {
  /**
   * 创建地图引擎实例
   */
  static create(type: MapEngineType): MapEngine {
    const entry = engineRegistry.get(type);
    if (!entry) {
      throw new Error(`Unknown map engine type: ${type}`);
    }
    return entry.factory();
  }

  /**
   * 获取所有可用的引擎描述
   */
  static getAvailableEngines(): MapEngineDescriptor[] {
    return Array.from(engineRegistry.values())
      .filter(entry => entry.descriptor.available)
      .map(entry => entry.descriptor);
  }

  /**
   * 获取指定维度的引擎
   */
  static getEnginesByDimension(dimension: MapDimension): MapEngineDescriptor[] {
    return this.getAvailableEngines().filter(e => e.dimension === dimension);
  }

  /**
   * 检查引擎是否可用
   */
  static isEngineAvailable(type: MapEngineType): boolean {
    const entry = engineRegistry.get(type);
    return entry?.descriptor.available ?? false;
  }

  /**
   * 获取引擎描述
   */
  static getDescriptor(type: MapEngineType): MapEngineDescriptor | undefined {
    return engineRegistry.get(type)?.descriptor;
  }
}

export default EngineFactory;
