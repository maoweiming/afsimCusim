/**
 * SimGlobePlugin - 仿真地球
 * 核心仿真态势可视化，包含 3D 地球、图层控制面板
 * 所有角色均可访问
 */
import { lazy, Suspense, type ComponentType } from 'react';
import { GlobalOutlined, LoadingOutlined } from '@ant-design/icons';
import type { PluginContribution } from '../core/plugin/types';
import type { LayerDefinition } from '../core/layer/types';
import { BasePlugin } from './BasePlugin';

// ============ 图层定义（与 LayerPresets 保持一致） ============

const platformLayer: LayerDefinition = {
  id: 'layer-platforms',
  name: '平台',
  type: 'platform',
  renderingMode: 'direct',
  style: { pointColor: '#00ff88', pointSize: 8, showLabel: true, labelSize: 12 },
  tags: ['simulation', 'core'],
};

const trackLayer: LayerDefinition = {
  id: 'layer-tracks',
  name: '航迹',
  type: 'track',
  renderingMode: 'direct',
  style: { lineColor: '#00bfff', lineWidth: 2, lineGlow: true, lineGlowColor: '#00bfff', lineGlowPower: 3 },
  tags: ['simulation', 'core'],
};

const sensorBeamLayer: LayerDefinition = {
  id: 'layer-sensor-beams',
  name: '传感器波束',
  type: 'sensor_beam',
  renderingMode: 'direct',
  style: { beamAlpha: 0.3, beamDashLength: 10, lineColor: '#ffff00' },
  tags: ['simulation', 'sensor'],
};

const weaponArcLayer: LayerDefinition = {
  id: 'layer-weapon-arcs',
  name: '武器射界',
  type: 'weapon_arc',
  renderingMode: 'direct',
  style: { fillColor: '#ff4444', fillOpacity: 0.2, strokeColor: '#ff4444', strokeWidth: 1 },
  tags: ['simulation', 'weapon'],
};

// ============ Lazy 页面组件 ============

const SimulationPage = lazy(() => import('../pages/SimulationPage'));

// ============ Lazy 侧边栏面板 ============

const LazyUnifiedLayerPanel = lazy(() => import('../components/LayerPanel/UnifiedLayerPanel'));

const UnifiedLayerPanel: ComponentType = () => (
  <Suspense fallback={<LoadingOutlined spin />}>
    <LazyUnifiedLayerPanel />
  </Suspense>
);

// ============ 插件定义 ============

export class SimGlobePlugin extends BasePlugin {
  constructor() {
    super({
      id: 'sim-globe',
      name: '仿真地球',
      version: '1.0.0',
      description: '核心仿真态势可视化，3D 地球 + 图层控制',
      author: 'TrueSim',
      allowedRoles: ['admin', 'operator', 'analyst', 'viewer'],
      icon: 'GlobalOutlined',
    });
  }

  protected buildContribution(): PluginContribution {
    return {
      routes: [
        {
          path: '/simulation',
          component: SimulationPage,
          requiresAuth: true,
        },
      ],
      navItems: [
        {
          key: 'sim-globe',
          label: '仿真态势',
          icon: <GlobalOutlined />,
          order: 0,
        },
      ],
      sidebarPanels: [
        {
          id: 'layer-panel',
          title: '图层控制',
          side: 'right',
          order: 0,
          component: UnifiedLayerPanel,
          collapsible: true,
          defaultCollapsed: false,
        },
      ],
      layers: [
        { layerDefinition: platformLayer, presetGroup: 'simulation' },
        { layerDefinition: trackLayer, presetGroup: 'simulation' },
        { layerDefinition: sensorBeamLayer, presetGroup: 'simulation' },
        { layerDefinition: weaponArcLayer, presetGroup: 'simulation' },
      ],
    };
  }
}

export default SimGlobePlugin;
