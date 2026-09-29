/**
 * MapDataPlugin - 地图数据
 * 地理空间数据管理，支持 GeoJSON / WMS 图层叠加
 * 仅 admin 和 analyst 角色可访问
 */
import { lazy } from 'react';
import { HeatMapOutlined } from '@ant-design/icons';
import type { PluginContribution } from '../core/plugin/types';
import type { LayerDefinition } from '../core/layer/types';
import { BasePlugin } from './BasePlugin';

// ============ 图层定义 ============

const geojsonLayer: LayerDefinition = {
  id: 'layer-geojson',
  name: 'GeoJSON 数据',
  type: 'geojson',
  renderingMode: 'engine',
  style: {
    fillColor: '#3388ff',
    fillOpacity: 0.2,
    strokeColor: '#3388ff',
    strokeWidth: 2,
  },
  tags: ['geospatial', 'data'],
};

const wmsLayer: LayerDefinition = {
  id: 'layer-wms',
  name: 'WMS 服务图层',
  type: 'wms',
  renderingMode: 'engine',
  source: {
    url: '',
    layers: '',
    parameters: { transparent: 'true', format: 'image/png' },
  },
  style: {},
  tags: ['geospatial', 'data'],
};

// ============ Lazy 页面组件 ============

const MapDataPage = lazy(() => import('../pages/MapDataPage'));

// ============ 插件定义 ============

export class MapDataPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'map-data',
      name: '地图数据',
      version: '1.0.0',
      description: '地理空间数据管理，GeoJSON / WMS 图层叠加',
      author: 'TrueSim',
      allowedRoles: ['admin', 'analyst'],
      icon: 'HeatMapOutlined',
    });
  }

  protected buildContribution(): PluginContribution {
    return {
      routes: [
        {
          path: '/mapdata',
          component: MapDataPage,
          requiresAuth: true,
        },
      ],
      navItems: [
        {
          key: 'map-data',
          label: '地图数据',
          icon: <HeatMapOutlined />,
          order: 2,
        },
      ],
      layers: [
        { layerDefinition: geojsonLayer, presetGroup: 'geospatial' },
        { layerDefinition: wmsLayer, presetGroup: 'geospatial' },
      ],
    };
  }
}

export default MapDataPlugin;
