/**
 * main.tsx - 应用引导
 * 注册渲染器 + 插件，加载角色配置，启动 React 应用
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// 插件系统
import { PluginRegistry } from './core/plugin/PluginRegistry';
import { RoleConfigLoader } from './core/plugin/RoleConfigLoader';

// 图层系统
import { LayerManager } from './core/layer/LayerManager';
import { PlatformRenderer } from './core/layer/renderers/PlatformRenderer';
import { TrackRenderer } from './core/layer/renderers/TrackRenderer';
import { SensorBeamRenderer } from './core/layer/renderers/SensorBeamRenderer';
import { WeaponArcRenderer } from './core/layer/renderers/WeaponArcRenderer';
import { GeoJsonRenderer } from './core/layer/renderers/GeoJsonRenderer';
import { TileRenderer } from './core/layer/renderers/TileRenderer';
import { ZoneRenderer } from './core/layer/renderers/ZoneRenderer';

// 内置插件
import { SimGlobePlugin } from './plugins/SimGlobePlugin';
import { MapDataPlugin } from './plugins/MapDataPlugin';
import { ScenarioPlugin } from './plugins/ScenarioPlugin';
import { EquipmentPlugin } from './plugins/EquipmentPlugin';
import { DataCenterPlugin } from './plugins/DataCenterPlugin';
import { AnalysisPlugin } from './plugins/AnalysisPlugin';

// ============ Bootstrap ============

async function bootstrap() {
  // 1. 注册图层渲染器
  const layerManager = LayerManager.getInstance();
  layerManager.registerRenderer(new PlatformRenderer());
  layerManager.registerRenderer(new TrackRenderer());
  layerManager.registerRenderer(new SensorBeamRenderer());
  layerManager.registerRenderer(new WeaponArcRenderer());
  layerManager.registerRenderer(new GeoJsonRenderer());
  layerManager.registerRenderer(new TileRenderer());
  layerManager.registerRenderer(new ZoneRenderer());

  // 2. 注册插件
  const registry = PluginRegistry.getInstance();
  registry.register(new SimGlobePlugin(), { autoInit: true });
  registry.register(new MapDataPlugin(), { autoInit: true });
  registry.register(new ScenarioPlugin(), { autoInit: true });
  registry.register(new EquipmentPlugin(), { autoInit: true });
  registry.register(new DataCenterPlugin(), { autoInit: true });
  registry.register(new AnalysisPlugin(), { autoInit: true });

  // 3. 加载默认角色（从 localStorage 或默认 viewer）
  const savedRole = (localStorage.getItem('truesim:role') as any) || 'admin';
  await registry.setRole(savedRole);
}

// ============ 启动 ============

bootstrap().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}).catch((err) => {
  console.error('[TrueSim] Bootstrap failed:', err);
  // 降级：直接渲染
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
