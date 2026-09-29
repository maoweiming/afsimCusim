/**
 * 想定编辑模块 - API 客户端
 * 支持真实 REST API 调用，不可用时回退到 Mock 数据
 */

import type {
  Scenario,
  ScenarioBranch,
  PlatformInstance,
  RouteDefinition,
  ZoneDefinition,
  FormationDefinition,
  MissionDefinition,
  EquipmentItem,
  ScenarioComment,
  ChatMessage,
} from '../types';
import type { AfsimEquipment } from '../../equipment/afsim/types';
import { equipmentApi } from '../../equipment/api/equipmentApi';
import { TEMPLATE_CONTENT, type TemplateContent } from '../data/scenarioTemplates';

// ============ Configuration ============

const API_BASE =
  (import.meta as any).env?.VITE_DATA_API_URL || 'http://localhost:8080/api/v1';
const USE_MOCK =
  (import.meta as any).env?.VITE_USE_MOCK === 'true'; // default to real backend; set VITE_USE_MOCK=true for mock

// ============ 模拟延迟 ============

function delay(ms: number = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ Equipment Adapter ============

const MOVER_TO_DOMAIN: Record<string, string> = {
  WSF_AIR_MOVER: 'air',
  WSF_ROTORCRAFT_MOVER: 'air',
  WSF_HYBRID_MOVER: 'air',
  WSF_GROUND_MOVER: 'land',
  WSF_ROAD_MOVER: 'land',
  WSF_SURFACE_MOVER: 'surface',
  WSF_SUBSURFACE_MOVER: 'subsurface',
  WSF_SPACE_MER: 'space',
  WSF_KINEMATIC_MOVER: 'space',
  WSF_GUIDED_MOVER: 'air',
};

const DOMAIN_TO_CATEGORY: Record<string, EquipmentItem['category']> = {
  air: 'aircraft',
  land: 'vehicle',
  surface: 'ship',
  subsurface: 'submarine',
  space: 'vehicle',
};

/**
 * Convert AfsimEquipment (from equipment management) to EquipmentItem (for scenario editor).
 */
function equipmentToScenarioItem(eq: AfsimEquipment): EquipmentItem {
  // Infer domain from mover type
  let domain: string = eq.platform.spatialDomain || 'air';
  for (const [, mover] of Object.entries(eq.platform.movers || {})) {
    const moverType = (mover as { type?: string }).type || '';
    if (MOVER_TO_DOMAIN[moverType]) {
      domain = MOVER_TO_DOMAIN[moverType];
      break;
    }
  }

  const side = (eq.platform.side as EquipmentItem['side']) ?? 'neutral';
  const category = DOMAIN_TO_CATEGORY[domain as keyof typeof DOMAIN_TO_CATEGORY] ?? 'aircraft';

  // Extract sensor/weapon names from AFSIM platform component maps
  const sensors = Object.keys(eq.platform.sensors || {});
  const weapons = Object.keys(eq.platform.weapons || {});

  // Extract max speed/altitude from first mover
  let maxSpeed = 0;
  let maxAltitude = 0;
  const firstMover = Object.values(eq.platform.movers || {})[0] as unknown as Record<string, unknown> | undefined;
  if (firstMover) {
    const speedStr = firstMover.maximumSpeed as string | undefined;
    if (speedStr) {
      const match = speedStr.match(/([\d.]+)/);
      if (match) maxSpeed = parseFloat(match[1]);
    }
    const altStr = firstMover.maximumAltitude as string | undefined;
    if (altStr) {
      const match = altStr.match(/([\d.]+)/);
      if (match) maxAltitude = parseFloat(match[1]);
    }
  }

  return {
    id: eq.name,
    name: eq.name,
    category,
    side,
    icon: eq.platform.icon || '',
    maxSpeed,
    maxAltitude,
    sensors,
    weapons,
  };
}

// ============ Mock 想定数据 ============

const MOCK_SCENARIOS: Scenario[] = [
  {
    id: 'scn-taiwan-strait-2024',
    name: '台海防御作战想定',
    description: '模拟2024年度台海方向联合防御作战，包含海空联合打击、防空反导、反潜作战等场景。想定基于公开情报资料构建，用于战术推演和指挥训练。',
    version: '2.1.0',
    status: 'in_review',
    terrain: {
      source: 'cesium-ion',
      assetId: 1,
      exaggeration: 1.0,
    },
    platforms: [
      {
        id: 'plat-f16-01',
        equipmentRef: { equipmentId: 'eq-f16v', version: 1, name: 'F-16V 战斗机', category: 'aircraft' },
        name: '红箭中队 F-16V #1',
        side: 'blue',
        initialPosition: { lng: 121.5, lat: 25.0 },
        initialAltitude: 8000,
        initialHeading: 270,
        initialSpeed: 450,
      },
      {
        id: 'plat-f16-02',
        equipmentRef: { equipmentId: 'eq-f16v', version: 1, name: 'F-16V 战斗机', category: 'aircraft' },
        name: '红箭中队 F-16V #2',
        side: 'blue',
        initialPosition: { lng: 121.5, lat: 24.8 },
        initialAltitude: 8000,
        initialHeading: 270,
        initialSpeed: 450,
      },
      {
        id: 'plat-kidd-01',
        equipmentRef: { equipmentId: 'eq-kiddclass', version: 1, name: '基德级驱逐舰', category: 'ship' },
        name: '1802基德号',
        side: 'blue',
        initialPosition: { lng: 121.0, lat: 24.5 },
        initialAltitude: 0,
        initialHeading: 180,
        initialSpeed: 15,
      },
      {
        id: 'plat-j20-01',
        equipmentRef: { equipmentId: 'eq-j20', version: 1, name: '歼-20 隐身战斗机', category: 'aircraft' },
        name: '东部战区 歼-20 #1',
        side: 'red',
        initialPosition: { lng: 119.5, lat: 25.5 },
        initialAltitude: 12000,
        initialHeading: 90,
        initialSpeed: 600,
      },
      {
        id: 'plat-052d-01',
        equipmentRef: { equipmentId: 'eq-suzhou052d', version: 1, name: '052D型驱逐舰（苏州舰）', category: 'ship' },
        name: '132苏州舰',
        side: 'red',
        initialPosition: { lng: 119.0, lat: 25.0 },
        initialAltitude: 0,
        initialHeading: 60,
        initialSpeed: 18,
      },
      {
        id: 'plat-s300-01',
        equipmentRef: { equipmentId: 'eq-s300', version: 1, name: 'S-300PMU2 防空系统', category: 'sensor' },
        name: 'S-300PMU2 阵地A',
        side: 'red',
        initialPosition: { lng: 118.5, lat: 25.8 },
        initialAltitude: 0,
        initialHeading: 0,
        initialSpeed: 0,
      },
    ],
    routes: [
      {
        id: 'route-f16-patrol',
        name: '西部巡逻航线',
        waypoints: [
          { position: { lng: 121.5, lat: 25.0 }, altitude: 8000, speed: 450 },
          { position: { lng: 120.5, lat: 24.5 }, altitude: 9000, speed: 500 },
          { position: { lng: 119.8, lat: 24.8 }, altitude: 8000, speed: 450 },
          { position: { lng: 121.0, lat: 25.2 }, altitude: 8000, speed: 450 },
        ],
        color: '#0078d7',
      },
      {
        id: 'route-ship-advance',
        name: '编队前进航线',
        waypoints: [
          { position: { lng: 119.0, lat: 25.0 }, altitude: 0, speed: 18 },
          { position: { lng: 119.5, lat: 24.5 }, altitude: 0, speed: 20 },
          { position: { lng: 120.0, lat: 24.0 }, altitude: 0, speed: 15 },
        ],
        color: '#d72828',
      },
    ],
    zones: [
      {
        id: 'zone-taiwan-adiz',
        name: '台湾防空识别区',
        type: 'inclusion',
        geometry: {
          type: 'polygon',
          vertices: [
            { lng: 117.5, lat: 21.0 },
            { lng: 122.0, lat: 21.0 },
            { lng: 124.0, lat: 25.0 },
            { lng: 122.0, lat: 29.0 },
            { lng: 117.5, lat: 29.0 },
          ],
        },
        fillColor: '#0078d720',
        strokeColor: '#0078d7',
      },
      {
        id: 'zone-missile-corridor',
        name: '导弹打击走廊',
        type: 'threat',
        geometry: {
          type: 'polygon',
          vertices: [
            { lng: 118.0, lat: 24.0 },
            { lng: 121.0, lat: 24.0 },
            { lng: 121.0, lat: 26.0 },
            { lng: 118.0, lat: 26.0 },
          ],
        },
        fillColor: '#d7282820',
        strokeColor: '#d72828',
      },
      {
        id: 'zone-safe-corridor',
        name: '民航安全走廊',
        type: 'safe',
        geometry: {
          type: 'circle',
          center: { lng: 120.5, lat: 23.5 },
          radius: 50000,
        },
        fillColor: '#28b43c20',
        strokeColor: '#28b43c',
      },
    ],
    formations: [],
    missions: [],
    tags: ['台海', '防空', '海空联合', '高级'],
    classification: '机密',
    collaborators: [
      {
        userId: 'user-001',
        userName: '张指挥官',
        role: 'owner',
        online: true,
        color: '#0078d7',
        cursor: { lng: 121.0, lat: 25.0 },
      },
      {
        userId: 'user-002',
        userName: '李参谋',
        role: 'editor',
        online: true,
        color: '#28b43c',
        cursor: { lng: 119.5, lat: 24.5 },
      },
      {
        userId: 'user-003',
        userName: '王分析员',
        role: 'editor',
        online: false,
        color: '#c8c83c',
      },
      {
        userId: 'user-004',
        userName: '赵观察员',
        role: 'viewer',
        online: true,
        color: '#d72828',
      },
    ],
    createdBy: 'user-001',
    createdAt: '2024-03-15T08:00:00Z',
    updatedAt: '2024-04-20T14:30:00Z',
  },
  {
    id: 'scn-south-china-sea',
    name: '南海巡航任务想定',
    description: '模拟南海海域联合巡航任务，包含水面舰艇编队巡逻、空中巡逻、水下反潜搜索等科目。适用于日常战备训练和战术研究。',
    version: '1.3.0',
    status: 'approved',
    terrain: {
      source: 'cesium-ion',
      assetId: 1,
      exaggeration: 1.0,
    },
    platforms: [
      {
        id: 'plat-p3c-01',
        equipmentRef: { equipmentId: 'eq-p3c', version: 1, name: 'P-3C 反潜巡逻机', category: 'aircraft' },
        name: '反潜巡逻机 #1',
        side: 'blue',
        initialPosition: { lng: 115.0, lat: 15.0 },
        initialAltitude: 5000,
        initialHeading: 180,
        initialSpeed: 350,
      },
      {
        id: 'plat-kilo-01',
        equipmentRef: { equipmentId: 'eq-kh640', version: 1, name: '基洛级潜艇', category: 'submarine' },
        name: '基洛级潜艇 #1',
        side: 'red',
        initialPosition: { lng: 114.0, lat: 14.0 },
        initialAltitude: -150,
        initialHeading: 45,
        initialSpeed: 8,
      },
    ],
    routes: [
      {
        id: 'route-patrol-scs',
        name: '南海巡逻航线',
        waypoints: [
          { position: { lng: 115.0, lat: 15.0 }, altitude: 5000, speed: 350 },
          { position: { lng: 114.0, lat: 13.0 }, altitude: 4000, speed: 300 },
          { position: { lng: 116.0, lat: 12.0 }, altitude: 5000, speed: 350 },
          { position: { lng: 117.0, lat: 14.0 }, altitude: 5000, speed: 350 },
          { position: { lng: 115.0, lat: 15.0 }, altitude: 5000, speed: 350 },
        ],
        color: '#28b43c',
      },
    ],
    zones: [
      {
        id: 'zone-scs-patrol',
        name: '南海巡逻区',
        type: 'inclusion',
        geometry: {
          type: 'polygon',
          vertices: [
            { lng: 112.0, lat: 10.0 },
            { lng: 118.0, lat: 10.0 },
            { lng: 118.0, lat: 18.0 },
            { lng: 112.0, lat: 18.0 },
          ],
        },
        fillColor: '#28b43c15',
        strokeColor: '#28b43c',
      },
    ],
    formations: [],
    missions: [],
    tags: ['南海', '反潜', '巡逻', '中级'],
    classification: '秘密',
    collaborators: [
      {
        userId: 'user-005',
        userName: '陈舰长',
        role: 'owner',
        online: true,
        color: '#0078d7',
      },
      {
        userId: 'user-006',
        userName: '刘大副',
        role: 'editor',
        online: false,
        color: '#c8c83c',
      },
    ],
    createdBy: 'user-005',
    createdAt: '2024-02-10T06:00:00Z',
    updatedAt: '2024-04-18T09:15:00Z',
  },
  {
    id: 'scn-island-defense',
    name: '岛屿防御作战想定',
    description: '模拟东南海域岛屿防御作战，包含两栖登陆、岸基反舰、防空拦截等想定。想定支持红蓝双方对抗推演。',
    version: '1.0.0',
    status: 'draft',
    terrain: {
      source: 'cesium-ion',
      assetId: 1,
      exaggeration: 1.5,
    },
    platforms: [
      {
        id: 'plat-haima-01',
        equipmentRef: { equipmentId: 'eq-haima', version: 1, name: '海马斯火箭炮', category: 'vehicle' },
        name: '海马斯火力单元 #1',
        side: 'blue',
        initialPosition: { lng: 121.2, lat: 23.5 },
        initialAltitude: 0,
        initialHeading: 0,
        initialSpeed: 0,
      },
      {
        id: 'plat-haima-02',
        equipmentRef: { equipmentId: 'eq-haima', version: 1, name: '海马斯火箭炮', category: 'vehicle' },
        name: '海马斯火力单元 #2',
        side: 'blue',
        initialPosition: { lng: 121.4, lat: 23.3 },
        initialAltitude: 0,
        initialHeading: 0,
        initialSpeed: 0,
      },
    ],
    routes: [],
    zones: [
      {
        id: 'zone-fire-zone',
        name: '火力打击区',
        type: 'threat',
        geometry: {
          type: 'circle',
          center: { lng: 121.3, lat: 23.4 },
          radius: 30000,
        },
        fillColor: '#d9770620',
        strokeColor: '#d97706',
      },
    ],
    formations: [],
    missions: [],
    tags: ['岛屿', '防御', '两栖', '初级'],
    classification: '内部',
    collaborators: [
      {
        userId: 'user-007',
        userName: '黄营长',
        role: 'owner',
        online: true,
        color: '#0078d7',
      },
    ],
    createdBy: 'user-007',
    createdAt: '2024-04-01T10:00:00Z',
    updatedAt: '2024-04-25T16:45:00Z',
  },
  {
    id: 'scn-anti-sub-drill',
    name: '联合反潜演习想定',
    description: '模拟东海海域联合反潜演习，包含舰艇编队搜潜、反潜机应召搜索、潜艇规避等战术科目。',
    version: '3.0.1',
    status: 'approved',
    terrain: {
      source: 'cesium-ion',
      assetId: 1,
      exaggeration: 1.0,
    },
    platforms: [],
    routes: [],
    zones: [],
    formations: [],
    missions: [],
    tags: ['反潜', '演习', '东海', '高级'],
    classification: '机密',
    collaborators: [
      {
        userId: 'user-008',
        userName: '吴司令',
        role: 'owner',
        online: false,
        color: '#0078d7',
      },
      {
        userId: 'user-009',
        userName: '郑参谋长',
        role: 'editor',
        online: true,
        color: '#28b43c',
      },
      {
        userId: 'user-010',
        userName: '孙处长',
        role: 'viewer',
        online: false,
        color: '#c8c83c',
      },
    ],
    createdBy: 'user-008',
    createdAt: '2024-01-20T03:00:00Z',
    updatedAt: '2024-04-10T11:20:00Z',
  },
  {
    id: 'scn-integrated-defense',
    name: '一体化防空反导演练',
    description: '模拟弹道导弹防御和巡航导弹拦截一体化演练，包含预警探测、跟踪识别、拦截打击全流程。',
    version: '1.2.0',
    status: 'draft',
    terrain: {
      source: 'cesium-ion',
      assetId: 1,
      exaggeration: 1.0,
    },
    platforms: [
      {
        id: 'plat-s300-ex',
        equipmentRef: { equipmentId: 'eq-s300', version: 1, name: 'S-300PMU2 防空系统', category: 'sensor' },
        name: 'S-300 阵地 Alpha',
        side: 'red',
        initialPosition: { lng: 117.0, lat: 26.0 },
        initialAltitude: 0,
        initialHeading: 0,
        initialSpeed: 0,
      },
    ],
    routes: [],
    zones: [
      {
        id: 'zone-threat-ring',
        name: 'S-300 威胁环',
        type: 'threat',
        geometry: {
          type: 'circle',
          center: { lng: 117.0, lat: 26.0 },
          radius: 200000,
        },
        fillColor: '#d7282810',
        strokeColor: '#d72828',
      },
    ],
    formations: [],
    missions: [],
    tags: ['防空', '反导', '一体化', '高级'],
    classification: '绝密',
    collaborators: [
      {
        userId: 'user-011',
        userName: '周司令员',
        role: 'owner',
        online: true,
        color: '#0078d7',
      },
    ],
    createdBy: 'user-011',
    createdAt: '2024-04-05T07:00:00Z',
    updatedAt: '2024-04-27T20:10:00Z',
  },
  // ───── 沿海战役想定（用例：验证编辑→仿真完整链路）─────
  {
    id: 'scn-coastal-campaign',
    name: '东海沿海战役想定',
    description: '模拟东部战区沿海方向防御作战。蓝方（东部战区）舰空联合拦截红方（远海来袭）突防编队。含舰载防空、岸基防空、战斗机拦截三层防御体系，适用于防空战术推演与验证。',
    version: '1.0.0',
    status: 'draft' as const,
    terrain: { source: 'cesium-ion' as const, assetId: 1, exaggeration: 1.0 },
    environment: {
      temperature: 22,
      windSpeedKnots: 12,
      windDirection: 45,
      visibilityMeters: 15000,
      precipitation: 'none' as const,
      cloudCeilingMeters: 3000,
    },
    platforms: [
      // ── 蓝方：东部战区 ──
      {
        id: 'plat-052d-kunming',
        equipmentRef: { equipmentId: 'eq-suzhou052d', version: 1, name: '052D型驱逐舰', category: 'ship' },
        name: '172昆明舰',
        side: 'blue' as const,
        initialPosition: { lng: 122.0, lat: 25.0 },
        initialAltitude: 0,
        initialHeading: 270,
        initialSpeed: 18,
        routeId: 'route-fleet-west',
      },
      {
        id: 'plat-054a-huangshan',
        equipmentRef: { equipmentId: 'eq-054a', version: 1, name: '054A型护卫舰', category: 'ship' },
        name: '570黄山舰',
        side: 'blue' as const,
        initialPosition: { lng: 122.2, lat: 24.6 },
        initialAltitude: 0,
        initialHeading: 270,
        initialSpeed: 15,
        routeId: 'route-fleet-west',
      },
      {
        id: 'plat-j16-1',
        equipmentRef: { equipmentId: 'eq-j16', version: 1, name: 'J-16 多用途战斗机', category: 'aircraft' },
        name: '蓝鹰01',
        side: 'blue' as const,
        initialPosition: { lng: 120.5, lat: 26.2 },
        initialAltitude: 9000,
        initialHeading: 90,
        initialSpeed: 550,
        routeId: 'route-cap-patrol',
      },
      {
        id: 'plat-j16-2',
        equipmentRef: { equipmentId: 'eq-j16', version: 1, name: 'J-16 多用途战斗机', category: 'aircraft' },
        name: '蓝鹰02',
        side: 'blue' as const,
        initialPosition: { lng: 120.7, lat: 25.8 },
        initialAltitude: 9000,
        initialHeading: 90,
        initialSpeed: 550,
        routeId: 'route-cap-patrol',
      },
      {
        id: 'plat-hq9-alpha',
        equipmentRef: { equipmentId: 'eq-hq9', version: 1, name: 'HQ-9B 远程防空系统', category: 'sensor' },
        name: 'HQ-9 阵地Alpha',
        side: 'blue' as const,
        initialPosition: { lng: 119.5, lat: 25.5 },
        initialAltitude: 0,
        initialHeading: 90,
        initialSpeed: 0,
      },
      // ── 红方：来袭编队 ──
      {
        id: 'plat-fa18-1',
        equipmentRef: { equipmentId: 'eq-fa18e', version: 1, name: 'F/A-18E 超级大黄蜂', category: 'aircraft' },
        name: '红剑01',
        side: 'red' as const,
        initialPosition: { lng: 126.5, lat: 25.5 },
        initialAltitude: 8000,
        initialHeading: 270,
        initialSpeed: 480,
        routeId: 'route-ingress',
      },
      {
        id: 'plat-fa18-2',
        equipmentRef: { equipmentId: 'eq-fa18e', version: 1, name: 'F/A-18E 超级大黄蜂', category: 'aircraft' },
        name: '红剑02',
        side: 'red' as const,
        initialPosition: { lng: 126.5, lat: 24.8 },
        initialAltitude: 8000,
        initialHeading: 270,
        initialSpeed: 480,
        routeId: 'route-ingress',
      },
      {
        id: 'plat-ea18g',
        equipmentRef: { equipmentId: 'eq-ea18g', version: 1, name: 'EA-18G 咆哮者电战机', category: 'aircraft' },
        name: '红鹰EW',
        side: 'red' as const,
        initialPosition: { lng: 127.0, lat: 26.0 },
        initialAltitude: 8500,
        initialHeading: 270,
        initialSpeed: 450,
      },
      {
        id: 'plat-e2d',
        equipmentRef: { equipmentId: 'eq-e2d', version: 1, name: 'E-2D 先进鹰眼预警机', category: 'aircraft' },
        name: '红眼AEW',
        side: 'red' as const,
        initialPosition: { lng: 128.0, lat: 26.5 },
        initialAltitude: 7000,
        initialHeading: 270,
        initialSpeed: 350,
      },
    ],
    routes: [
      {
        id: 'route-cap-patrol',
        name: '蓝方CAP巡逻路线',
        waypoints: [
          { position: { lng: 120.5, lat: 26.2 }, altitude: 9000, speed: 550 },
          { position: { lng: 122.0, lat: 26.0 }, altitude: 9000, speed: 550 },
          { position: { lng: 122.5, lat: 25.0 }, altitude: 9000, speed: 550 },
          { position: { lng: 121.0, lat: 24.5 }, altitude: 9000, speed: 550 },
          { position: { lng: 120.0, lat: 25.5 }, altitude: 9000, speed: 550 },
          { position: { lng: 120.5, lat: 26.2 }, altitude: 9000, speed: 550 },
        ],
        color: '#0078d7',
      },
      {
        id: 'route-fleet-west',
        name: '蓝方舰队机动路线',
        waypoints: [
          { position: { lng: 122.2, lat: 25.0 }, altitude: 0, speed: 18 },
          { position: { lng: 121.5, lat: 25.2 }, altitude: 0, speed: 20 },
          { position: { lng: 120.8, lat: 25.0 }, altitude: 0, speed: 20 },
        ],
        color: '#0078d7',
      },
      {
        id: 'route-ingress',
        name: '红方突防路线',
        waypoints: [
          { position: { lng: 126.5, lat: 25.2 }, altitude: 8000, speed: 480 },
          { position: { lng: 124.5, lat: 25.0 }, altitude: 3000, speed: 520 },
          { position: { lng: 122.5, lat: 24.8 }, altitude: 500, speed: 540 },
          { position: { lng: 121.0, lat: 24.5 }, altitude: 200, speed: 540 },
        ],
        color: '#d72828',
      },
    ],
    zones: [
      {
        id: 'zone-adiz',
        name: '防空识别区（ADIZ）',
        type: 'threat' as const,
        geometry: {
          type: 'polygon' as const,
          vertices: [
            { lng: 120.0, lat: 27.0 },
            { lng: 126.0, lat: 27.0 },
            { lng: 126.0, lat: 23.0 },
            { lng: 120.0, lat: 23.0 },
          ],
        },
        fillColor: '#0078d720',
        strokeColor: '#0078d7',
      },
      {
        id: 'zone-intercept',
        name: '拦截接战区',
        type: 'threat' as const,
        geometry: {
          type: 'circle' as const,
          center: { lng: 122.5, lat: 25.2 },
          radius: 120000,
        },
        fillColor: '#d7282820',
        strokeColor: '#d72828',
      },
      {
        id: 'zone-coastal-defense',
        name: '岸基防空覆盖区',
        type: 'safe' as const,
        geometry: {
          type: 'circle' as const,
          center: { lng: 119.5, lat: 25.5 },
          radius: 200000,
        },
        fillColor: '#28b43c15',
        strokeColor: '#28b43c',
      },
    ],
    formations: [
      {
        id: 'formation-cap',
        name: '蓝鹰双机编队',
        type: 'vic' as const,
        leaderId: 'plat-j16-1',
        members: [
          { platformId: 'plat-j16-1', role: 'leader' as const, offset: { x: 0, y: 0, z: 0 } },
          { platformId: 'plat-j16-2', role: 'wingman' as const, offset: { x: -500, y: 500, z: 0 } },
        ],
        spacing: 500,
        bearing: 90,
      },
    ],
    missions: [
      {
        id: 'mission-cap',
        name: '夺取制空权',
        type: 'cap' as const,
        status: 'planned' as const,
        assignedPlatforms: ['plat-j16-1', 'plat-j16-2'],
        targetZoneId: 'zone-intercept',
      },
      {
        id: 'mission-sam',
        name: '岸基防空拦截',
        type: 'strike' as const,
        status: 'planned' as const,
        assignedPlatforms: ['plat-hq9-alpha'],
      },
      {
        id: 'mission-engage-cap',
        name: '蓝鹰编队拦截交战',
        type: 'engage' as const,
        status: 'planned' as const,
        assignedPlatforms: ['plat-j16-1', 'plat-j16-2'],
        engagement: {
          weaponName: 'int_missile',
          roe: 'free' as const,
          maxRange: 60000,
          salvoSize: 1,
        },
      },
    ],
    tags: ['沿海', '防空', '舰空联合', '东海', '拦截'],
    classification: '秘密',
    collaborators: [
      { userId: 'user-001', userName: '张指挥官', role: 'owner' as const, online: true, color: '#0078d7' },
      { userId: 'user-002', userName: '李参谋', role: 'editor' as const, online: false, color: '#28b43c' },
    ],
    createdBy: 'user-001',
    createdAt: '2026-06-09T08:00:00Z',
    updatedAt: '2026-06-09T08:00:00Z',
  },
];

// ============ Mock 分支数据 ============

const MOCK_BRANCHES: ScenarioBranch[] = [
  {
    id: 'branch-main',
    scenarioId: 'scn-taiwan-strait-2024',
    name: 'main',
    createdBy: 'user-001',
    createdAt: '2024-03-15T08:00:00Z',
    status: 'active',
  },
  {
    id: 'branch-alt-scenario',
    scenarioId: 'scn-taiwan-strait-2024',
    name: 'alternative-deployment',
    parentBranchId: 'branch-main',
    createdBy: 'user-002',
    createdAt: '2024-04-01T10:00:00Z',
    status: 'active',
  },
  {
    id: 'branch-experimental',
    scenarioId: 'scn-taiwan-strait-2024',
    name: 'experimental-equipment',
    parentBranchId: 'branch-main',
    createdBy: 'user-003',
    createdAt: '2024-04-10T14:00:00Z',
    status: 'active',
  },
];

// ============ Mock 评论 ============

const MOCK_COMMENTS: ScenarioComment[] = [
  {
    id: 'cmt-001',
    userId: 'user-002',
    userName: '李参谋',
    content: 'F-16V巡逻航线建议向西偏移10公里，避开民用航线。',
    position: { lng: 120.5, lat: 24.5 },
    entityType: 'route',
    entityId: 'route-f16-patrol',
    resolved: false,
    createdAt: '2024-04-18T09:30:00Z',
    replies: [
      {
        id: 'cmt-001-r1',
        userId: 'user-001',
        userName: '张指挥官',
        content: '已收到，将在下一版本中调整。',
        resolved: false,
        createdAt: '2024-04-18T10:15:00Z',
        replies: [],
      },
    ],
  },
  {
    id: 'cmt-002',
    userId: 'user-004',
    userName: '赵观察员',
    content: '导弹走廊区域标注需要更新，当前范围偏大。',
    entityType: 'zone',
    entityId: 'zone-missile-corridor',
    resolved: false,
    createdAt: '2024-04-19T14:00:00Z',
    replies: [],
  },
];

// ============ Mock 聊天消息 ============

const MOCK_CHAT: ChatMessage[] = [
  {
    id: 'msg-001',
    userId: 'user-001',
    userName: '张指挥官',
    content: '各位，想定V2.1已完成初稿，请大家审阅。',
    timestamp: '2024-04-20T08:00:00Z',
    type: 'text',
  },
  {
    id: 'msg-002',
    userId: 'user-002',
    userName: '李参谋',
    content: '收到，正在查看空中巡逻部分。',
    timestamp: '2024-04-20T08:05:00Z',
    type: 'text',
  },
  {
    id: 'msg-003',
    userId: 'user-004',
    userName: '赵观察员',
    content: '建议增加反潜作战单元。',
    timestamp: '2024-04-20T08:10:00Z',
    type: 'text',
  },
  {
    id: 'msg-004',
    userId: 'user-001',
    userName: '张指挥官',
    content: '好建议，已加入待办。',
    timestamp: '2024-04-20T08:12:00Z',
    type: 'text',
  },
];

// ============ 模拟数据存储 ============

let scenarios = [...MOCK_SCENARIOS];
let branches = [...MOCK_BRANCHES];
let comments = [...MOCK_COMMENTS];
let chatMessages = [...MOCK_CHAT];

// ============ API 函数 ============

/** 获取想定列表 */
export async function fetchScenarioList(): Promise<Scenario[]> {
  if (USE_MOCK) {
    await delay(400);
    return [...scenarios];
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Scenarios API unavailable, using mock data:', e);
    return [...scenarios];
  }
}

/** 获取单个想定详情 */
export async function fetchScenario(id: string): Promise<Scenario> {
  if (USE_MOCK) {
    await delay(200);
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`想定 ${id} 不存在`);
    return { ...scenario };
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Scenarios API unavailable, using mock data:', e);
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`想定 ${id} 不存在`);
    return { ...scenario };
  }
}

/** 为模板内容中的所有 id 及引用字段重新生成 ID，避免同一模板多次实例化时冲突 */
function cloneWithFreshIds(content: TemplateContent, prefix: string): TemplateContent {
  const cloned: TemplateContent = JSON.parse(JSON.stringify(content));
  const idMap = new Map<string, string>();
  const remap = (oldId: string): string => {
    let newId = idMap.get(oldId);
    if (!newId) {
      newId = `${prefix}-${oldId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      idMap.set(oldId, newId);
    }
    return newId;
  };

  cloned.platforms.forEach((p: PlatformInstance) => {
    p.id = remap(p.id);
    if (p.routeId) p.routeId = remap(p.routeId);
    if (p.carrierId) p.carrierId = remap(p.carrierId);
  });
  cloned.routes.forEach((r: RouteDefinition) => {
    r.id = remap(r.id);
  });
  cloned.zones.forEach((z: ZoneDefinition) => {
    z.id = remap(z.id);
  });
  cloned.formations.forEach((f: FormationDefinition) => {
    f.id = remap(f.id);
    f.leaderId = remap(f.leaderId);
    f.members.forEach((m) => {
      m.platformId = remap(m.platformId);
    });
  });
  cloned.missions.forEach((m: MissionDefinition) => {
    m.id = remap(m.id);
    m.assignedPlatforms = m.assignedPlatforms.map(remap);
    if (m.formationId) m.formationId = remap(m.formationId);
    if (m.targetZoneId) m.targetZoneId = remap(m.targetZoneId);
    if (m.routeId) m.routeId = remap(m.routeId);
  });

  return cloned;
}

/** 根据模板 ID 生成想定初始内容（平台/航线/区域/编队/任务） */
function instantiateTemplate(templateId?: string): TemplateContent {
  if (!templateId || templateId === 'blank') {
    return { platforms: [], routes: [], zones: [], formations: [], missions: [] };
  }
  if (templateId === 'coastal-joint-ops') {
    const source = MOCK_SCENARIOS.find((s) => s.id === 'scn-coastal-campaign');
    if (!source) return { platforms: [], routes: [], zones: [], formations: [], missions: [] };
    const content: TemplateContent = {
      platforms: source.platforms,
      routes: source.routes,
      zones: source.zones,
      formations: source.formations,
      missions: source.missions,
    };
    return cloneWithFreshIds(content, 'tpl-coastal');
  }
  const factory = TEMPLATE_CONTENT[templateId];
  if (!factory) return { platforms: [], routes: [], zones: [], formations: [], missions: [] };
  return cloneWithFreshIds(factory(), `tpl-${templateId}`);
}

/** 创建想定 */
export async function createScenario(
  data: Pick<Scenario, 'name' | 'description' | 'tags' | 'classification'> & { templateId?: string }
): Promise<Scenario> {
  if (USE_MOCK) {
    await delay(500);
    const now = new Date().toISOString();
    const newScenario: Scenario = {
      id: `scn-${Date.now()}`,
      name: data.name,
      description: data.description,
      version: '0.1.0',
      status: 'draft',
      terrain: { source: 'cesium-ion', assetId: 1, exaggeration: 1.0 },
      platforms: [],
      routes: [],
      zones: [],
      formations: [],
      missions: [],
      tags: data.tags,
      classification: data.classification,
      collaborators: [
        {
          userId: 'user-001',
          userName: '张指挥官',
          role: 'owner',
          online: true,
          color: '#0078d7',
        },
      ],
      createdBy: 'user-001',
      createdAt: now,
      updatedAt: now,
    };
    Object.assign(newScenario, instantiateTemplate(data.templateId));
    scenarios.unshift(newScenario);
    return newScenario;
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Scenarios API unavailable, using mock data:', e);
    const now = new Date().toISOString();
    const newScenario: Scenario = {
      id: `scn-${Date.now()}`,
      name: data.name,
      description: data.description,
      version: '0.1.0',
      status: 'draft',
      terrain: { source: 'cesium-ion', assetId: 1, exaggeration: 1.0 },
      platforms: [],
      routes: [],
      zones: [],
      formations: [],
      missions: [],
      tags: data.tags,
      classification: data.classification,
      collaborators: [
        {
          userId: 'user-001',
          userName: '张指挥官',
          role: 'owner',
          online: true,
          color: '#0078d7',
        },
      ],
      createdBy: 'user-001',
      createdAt: now,
      updatedAt: now,
    };
    Object.assign(newScenario, instantiateTemplate(data.templateId));
    scenarios.unshift(newScenario);
    return newScenario;
  }
}

/** 更新想定 */
export async function updateScenario(
  id: string,
  updates: Partial<Scenario>
): Promise<Scenario> {
  if (USE_MOCK) {
    await delay(300);
    const idx = scenarios.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`想定 ${id} 不存在`);
    scenarios[idx] = {
      ...scenarios[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return scenarios[idx];
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Scenarios API unavailable, using mock data:', e);
    const idx = scenarios.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`想定 ${id} 不存在`);
    scenarios[idx] = {
      ...scenarios[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return scenarios[idx];
  }
}

/** 更新想定状态（草稿/审核中/已批准/已归档） */
export async function updateScenarioStatus(
  id: string,
  status: import('../types').ScenarioStatus
): Promise<Scenario> {
  return updateScenario(id, { status });
}

/** 删除想定 */
export async function deleteScenario(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300);
    scenarios = scenarios.filter((s) => s.id !== id);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (e) {
    console.warn('Scenarios API unavailable, using mock data:', e);
    scenarios = scenarios.filter((s) => s.id !== id);
  }
}

/** 获取装备库 — 从装备管理模块获取并适配为场景编辑器格式 */
export async function fetchEquipmentList(): Promise<EquipmentItem[]> {
  try {
    const response = await equipmentApi.list({ pageSize: 1000 });
    // Fetch full AfsimEquipment details for each item
    const items: EquipmentItem[] = [];
    for (const eq of response.data) {
      const detail = await equipmentApi.get(eq.name);
      if (detail) {
        items.push(equipmentToScenarioItem(detail));
      }
    }
    return items;
  } catch (e) {
    console.warn('Equipment API unavailable:', e);
    return [];
  }
}

/** 获取分支列表 */
export async function fetchBranches(scenarioId: string): Promise<ScenarioBranch[]> {
  if (USE_MOCK) {
    await delay(200);
    return branches.filter((b) => b.scenarioId === scenarioId);
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${scenarioId}/branches`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Branches API unavailable, using mock data:', e);
    return branches.filter((b) => b.scenarioId === scenarioId);
  }
}

/** 创建分支 */
export async function createBranch(
  scenarioId: string,
  name: string,
  parentBranchId?: string
): Promise<ScenarioBranch> {
  if (USE_MOCK) {
    await delay(400);
    const newBranch: ScenarioBranch = {
      id: `branch-${Date.now()}`,
      scenarioId,
      name,
      parentBranchId: parentBranchId || 'branch-main',
      createdBy: 'user-001',
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    branches.push(newBranch);
    return newBranch;
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${scenarioId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentBranchId }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Branches API unavailable, using mock data:', e);
    const newBranch: ScenarioBranch = {
      id: `branch-${Date.now()}`,
      scenarioId,
      name,
      parentBranchId: parentBranchId || 'branch-main',
      createdBy: 'user-001',
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    branches.push(newBranch);
    return newBranch;
  }
}

/** 获取评论 */
export async function fetchComments(scenarioId: string): Promise<ScenarioComment[]> {
  if (USE_MOCK) {
    await delay(200);
    // 简单返回所有评论（实际应按scenarioId过滤）
    return [...comments];
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${scenarioId}/comments`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Comments API unavailable, using mock data:', e);
    return [...comments];
  }
}

/** 添加评论 */
export async function addComment(
  comment: Omit<ScenarioComment, 'id' | 'createdAt' | 'replies'>
): Promise<ScenarioComment> {
  if (USE_MOCK) {
    await delay(300);
    const newComment: ScenarioComment = {
      ...comment,
      id: `cmt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    comments.push(newComment);
    return newComment;
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Comments API unavailable, using mock data:', e);
    const newComment: ScenarioComment = {
      ...comment,
      id: `cmt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    comments.push(newComment);
    return newComment;
  }
}

/** 获取聊天消息 */
export async function fetchChatMessages(): Promise<ChatMessage[]> {
  if (USE_MOCK) {
    await delay(200);
    return [...chatMessages];
  }

  try {
    const response = await fetch(`${API_BASE}/chat/messages`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Chat API unavailable, using mock data:', e);
    return [...chatMessages];
  }
}

/** 发送聊天消息 */
export async function sendChatMessage(
  content: string,
  userId: string = 'user-001',
  userName: string = '张指挥官'
): Promise<ChatMessage> {
  if (USE_MOCK) {
    await delay(100);
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId,
      userName,
      content,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    chatMessages.push(msg);
    return msg;
  }

  try {
    const response = await fetch(`${API_BASE}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, userId, userName }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn('Chat API unavailable, using mock data:', e);
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId,
      userName,
      content,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    chatMessages.push(msg);
    return msg;
  }
}

/** 保存平台实例到想定 */
export async function savePlatforms(
  scenarioId: string,
  platforms: PlatformInstance[]
): Promise<void> {
  if (USE_MOCK) {
    await delay(300);
    const idx = scenarios.findIndex((s) => s.id === scenarioId);
    if (idx !== -1) {
      scenarios[idx].platforms = platforms;
      scenarios[idx].updatedAt = new Date().toISOString();
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${scenarioId}/platforms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(platforms),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (e) {
    console.warn('Platforms API unavailable, using mock data:', e);
    const idx = scenarios.findIndex((s) => s.id === scenarioId);
    if (idx !== -1) {
      scenarios[idx].platforms = platforms;
      scenarios[idx].updatedAt = new Date().toISOString();
    }
  }
}

/** 保存路线到想定 */
export async function saveRoutes(
  scenarioId: string,
  routes: RouteDefinition[]
): Promise<void> {
  if (USE_MOCK) {
    await delay(300);
    const idx = scenarios.findIndex((s) => s.id === scenarioId);
    if (idx !== -1) {
      scenarios[idx].routes = routes;
      scenarios[idx].updatedAt = new Date().toISOString();
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${scenarioId}/routes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routes),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (e) {
    console.warn('Routes API unavailable, using mock data:', e);
    const idx = scenarios.findIndex((s) => s.id === scenarioId);
    if (idx !== -1) {
      scenarios[idx].routes = routes;
      scenarios[idx].updatedAt = new Date().toISOString();
    }
  }
}

/** 保存区域到想定 */
export async function saveZones(
  scenarioId: string,
  zones: ZoneDefinition[]
): Promise<void> {
  if (USE_MOCK) {
    await delay(300);
    const idx = scenarios.findIndex((s) => s.id === scenarioId);
    if (idx !== -1) {
      scenarios[idx].zones = zones;
      scenarios[idx].updatedAt = new Date().toISOString();
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/scenarios/${scenarioId}/zones`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zones),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (e) {
    console.warn('Zones API unavailable, using mock data:', e);
    const idx = scenarios.findIndex((s) => s.id === scenarioId);
    if (idx !== -1) {
      scenarios[idx].zones = zones;
      scenarios[idx].updatedAt = new Date().toISOString();
    }
  }
}
