/**
 * 想定模板（新建想定时可选的预设内容）
 * 数据来源：参照 docs/afsim-demos-index.md 中的 air_to_air / ship_ad 等 demo 分类
 */
import type { PlatformInstance, RouteDefinition, Scenario, ZoneDefinition } from '../types';

export type TemplateContent = Pick<Scenario, 'platforms' | 'routes' | 'zones' | 'formations' | 'missions'>;

export interface ScenarioTemplateOption {
  id: string;
  name: string;
  description: string;
}

export const SCENARIO_TEMPLATE_OPTIONS: ScenarioTemplateOption[] = [
  {
    id: 'blank',
    name: '空白想定',
    description: '不预填任何平台/航线/区域，从空想定开始。',
  },
  {
    id: 'air-combat-2v2',
    name: '空战遭遇战 2v2',
    description: '蓝方 FA-18E/F-35C 与红方 Su-35/J-10C 对头进入，各配一条进入航线（参照 air_to_air demo）。',
  },
  {
    id: 'naval-air-defense',
    name: '舰艇编队防空',
    description: '蓝方 DDG-51 + CG-47 编队，红方 Su-30 沿突击航线接近，外加一个防空覆盖区域（参照 ship_ad demo）。',
  },
  {
    id: 'coastal-joint-ops',
    name: '沿海联合作战',
    description: '克隆「东海沿海战役想定」：9 个平台，含舰载防空、岸基防空、战斗机拦截三层防御体系。',
  },
];

const emptyContent = (): TemplateContent => ({
  platforms: [],
  routes: [],
  zones: [],
  formations: [],
  missions: [],
});

function airCombat2v2(): TemplateContent {
  const platforms: PlatformInstance[] = [
    {
      id: 'plat-blue-fa18e',
      equipmentRef: { equipmentId: 'FA-18E_Super_Hornet', name: 'FA-18E_Super_Hornet', category: 'aircraft' },
      name: '蓝鹰01',
      side: 'blue',
      initialPosition: { lng: 120.3, lat: 24.5 },
      initialAltitude: 8000,
      initialHeading: 90,
      initialSpeed: 480,
      routeId: 'route-blue-ingress',
    },
    {
      id: 'plat-blue-f35c',
      equipmentRef: { equipmentId: 'F-35C_Lightning_II', name: 'F-35C_Lightning_II', category: 'aircraft' },
      name: '蓝鹰02',
      side: 'blue',
      initialPosition: { lng: 120.3, lat: 24.2 },
      initialAltitude: 8500,
      initialHeading: 90,
      initialSpeed: 470,
      routeId: 'route-blue-ingress',
    },
    {
      id: 'plat-red-su35',
      equipmentRef: { equipmentId: 'Su-35_Flanker-E', name: 'Su-35_Flanker-E', category: 'aircraft' },
      name: '红鹰01',
      side: 'red',
      initialPosition: { lng: 123.0, lat: 24.5 },
      initialAltitude: 8200,
      initialHeading: 270,
      initialSpeed: 480,
      routeId: 'route-red-ingress',
    },
    {
      id: 'plat-red-j10c',
      equipmentRef: { equipmentId: 'J-10C_Vigorous_Dragon', name: 'J-10C_Vigorous_Dragon', category: 'aircraft' },
      name: '红鹰02',
      side: 'red',
      initialPosition: { lng: 123.0, lat: 24.2 },
      initialAltitude: 8500,
      initialHeading: 270,
      initialSpeed: 470,
      routeId: 'route-red-ingress',
    },
  ];

  const routes: RouteDefinition[] = [
    {
      id: 'route-blue-ingress',
      name: '蓝方进入航线',
      waypoints: [
        { position: { lng: 120.3, lat: 24.35 }, altitude: 8000, speed: 480 },
        { position: { lng: 121.6, lat: 24.35 }, altitude: 8000, speed: 480 },
      ],
      color: '#0078d7',
    },
    {
      id: 'route-red-ingress',
      name: '红方进入航线',
      waypoints: [
        { position: { lng: 123.0, lat: 24.35 }, altitude: 8200, speed: 480 },
        { position: { lng: 121.7, lat: 24.35 }, altitude: 8200, speed: 480 },
      ],
      color: '#d72828',
    },
  ];

  return { platforms, routes, zones: [], formations: [], missions: [] };
}

function navalAirDefense(): TemplateContent {
  const platforms: PlatformInstance[] = [
    {
      id: 'plat-blue-ddg51',
      equipmentRef: { equipmentId: 'DDG-51_Arleigh_Burke', name: 'DDG-51_Arleigh_Burke', category: 'ship' },
      name: '蓝方驱逐舰01',
      side: 'blue',
      initialPosition: { lng: 121.0, lat: 24.0 },
      initialAltitude: 0,
      initialHeading: 0,
      initialSpeed: 15,
    },
    {
      id: 'plat-blue-cg47',
      equipmentRef: { equipmentId: 'CG-47_Ticonderoga', name: 'CG-47_Ticonderoga', category: 'ship' },
      name: '蓝方巡洋舰01',
      side: 'blue',
      initialPosition: { lng: 121.2, lat: 23.8 },
      initialAltitude: 0,
      initialHeading: 0,
      initialSpeed: 15,
    },
    {
      id: 'plat-red-su30',
      equipmentRef: { equipmentId: 'Su-30_Flanker-C', name: 'Su-30_Flanker-C', category: 'aircraft' },
      name: '红方突击机01',
      side: 'red',
      initialPosition: { lng: 123.5, lat: 24.0 },
      initialAltitude: 7000,
      initialHeading: 270,
      initialSpeed: 500,
      routeId: 'route-red-strike',
    },
  ];

  const routes: RouteDefinition[] = [
    {
      id: 'route-red-strike',
      name: '红方突击航线',
      waypoints: [
        { position: { lng: 123.5, lat: 24.0 }, altitude: 7000, speed: 500 },
        { position: { lng: 122.3, lat: 23.95 }, altitude: 3000, speed: 530 },
        { position: { lng: 121.3, lat: 23.9 }, altitude: 500, speed: 540 },
      ],
      color: '#d72828',
    },
  ];

  const zones: ZoneDefinition[] = [
    {
      id: 'zone-naval-air-defense',
      name: '舰队防空覆盖区',
      type: 'safe',
      geometry: {
        type: 'circle',
        center: { lng: 121.1, lat: 23.9 },
        radius: 100000,
      },
      fillColor: '#28b43c15',
      strokeColor: '#28b43c',
    },
  ];

  return { platforms, routes, zones, formations: [], missions: [] };
}

export const TEMPLATE_CONTENT: Record<string, () => TemplateContent> = {
  blank: emptyContent,
  'air-combat-2v2': airCombat2v2,
  'naval-air-defense': navalAirDefense,
};
