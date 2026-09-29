/**
 * 想定编辑模块 - 类型定义
 * 支持大团队协同编辑（15+人）
 */

// ============ 环境/气象配置 ============

export interface EnvironmentConfig {
  temperature: number;       // 气温（摄氏度）
  windSpeedKnots: number;    // 风速（节）
  windDirection: number;     // 风向（度，气象学定义：风的来向）
  visibilityMeters: number;  // 能见度（米）
  precipitation: 'none' | 'rain' | 'snow' | 'fog';
  cloudCeilingMeters: number; // 云高（米）
}

// ============ 地形配置 ============

export interface TerrainConfig {
  source: 'cesium-ion' | 'quantized-mesh' | 'terrarium' | 'custom';
  url?: string;
  assetId?: number;
  exaggeration: number;
}

// ============ 装备版本引用 ============

/** 装备版本锁定引用 — 引用特定版本，不受后续变更影响 */
export interface EquipmentRef {
  equipmentId: string;
  version?: number;       // 锁定的装备版本号
  name?: string;          // 冗余快照：装备名称
  category?: string;      // 冗余快照：装备分类
}

// ============ 指令链分配 ============

/** AFSIM command_chain 分配 — 平台在某条指令链中的角色 */
export interface CommandChainAssignment {
  chainName: string;   // 链名称，如 'IFLITE', 'ELEMENT', 'BOMBER'
  leader: string;      // 'SELF'（本平台为链长）或其他平台 name
}

// ============ 平台实例 ============

export interface PlatformInstance {
  id: string;
  equipmentRef: EquipmentRef;  // 版本锁定的装备引用
  equipmentId?: string;        // deprecated: 向后兼容，优先使用 equipmentRef
  name: string;
  side: 'blue' | 'red' | 'neutral' | 'green';
  initialPosition: { lng: number; lat: number };
  initialAltitude: number; // 米
  initialHeading: number; // 度
  initialSpeed: number; // 节
  routeId?: string;           // 关联的路线 ID
  sensors?: string[];
  weapons?: string[];
  lockedBy?: string; // 锁定用户ID

  // AFSIM 对齐字段
  commander?: string;                    // 'SELF' 或其他平台 name
  commandChains?: CommandChainAssignment[]; // 多链 C2 分配
  routeInline?: RouteWaypoint[];         // 内联路线（优先于 routeId）
  creationTime?: number;                 // 延迟出现时间（秒）
  indestructible?: boolean;              // 不可摧毁
  categories?: string[];                 // 分类标签
  carrierId?: string;                    // 所属航母 ID（飞机搭载时）

  // 分批次到达配置（导出时按 batchGroupSize/batchIntervalSeconds 展开为多个带不同 creationTime 的实例）
  batchGroupId?: string;                 // 批次分组 ID（同组共享展开规则）
  batchGroupSize?: number;               // 该批次生成的平台数量
  batchIntervalSeconds?: number;         // 批次内相邻平台的到达间隔（秒）
}

// ============ 路线定义 ============

export interface RouteWaypoint {
  position: { lng: number; lat: number };
  altitude: number;
  speed: number;
  name?: string;
}

export interface RouteDefinition {
  id: string;
  name: string;
  waypoints: RouteWaypoint[];
  color?: string;
  lockedBy?: string;
}

// ============ 区域定义 ============

export interface ZoneCircleGeometry {
  type: 'circle';
  center: { lng: number; lat: number };
  radius: number; // 米
}

export interface ZonePolygonGeometry {
  type: 'polygon';
  vertices: Array<{ lng: number; lat: number }>;
}

export type ZoneGeometry = ZoneCircleGeometry | ZonePolygonGeometry;

export interface ZoneDefinition {
  id: string;
  name: string;
  type: 'exclusion' | 'inclusion' | 'threat' | 'safe';
  geometry: ZoneGeometry;
  fillColor?: string;
  strokeColor?: string;
  lockedBy?: string;
}

// ============ 航母载机 ============

export interface CarrierAssignment {
  carrierId: string;
  aircraftId: string;
  status: 'embarked' | 'launched' | 'recovery';
  deckPosition?: string;
}

// ============ 编队定义 ============

export type FormationType = 'vic' | 'trail' | 'line_abreast' | 'custom';

export interface FormationMember {
  platformId: string;
  role: 'leader' | 'wingman';
  offset: { x: number; y: number; z: number };
}

export interface FormationDefinition {
  id: string;
  name: string;
  type: FormationType;
  leaderId: string;
  members: FormationMember[];
  spacing: number;       // 间距（米）
  bearing: number;       // 基准航向
}

// ============ 任务定义 ============

export type MissionType = 'strike' | 'patrol' | 'cap' | 'escort' | 'recon' | 'engage';
export type MissionStatus = 'planned' | 'active' | 'completed' | 'aborted';

/** 交战规则（Rules of Engagement） */
export type EngagementROE = 'auto' | 'hold' | 'tight' | 'free';

/** 武器交战配置（用于 type === 'engage' 的任务） */
export interface EngagementConfig {
  weaponName: string;          // 武器名称，取自分配平台的 PlatformInstance.weapons
  targetPlatformId?: string;   // 目标平台 ID
  roe: EngagementROE;           // 交战规则
  maxRange?: number;            // 交战距离（米）
  salvoSize?: number;           // 齐射数量
}

export interface MissionDefinition {
  id: string;
  name: string;
  type: MissionType;
  assignedPlatforms: string[];
  formationId?: string;
  targetZoneId?: string;
  targetPosition?: { lng: number; lat: number };
  routeId?: string;
  status: MissionStatus;
  timeWindow?: { start: number; end: number };
  engagement?: EngagementConfig; // type === 'engage' 时的武器交战配置
}

// ============ 协作者 ============

export interface Collaborator {
  userId: string;
  userName: string;
  role: 'owner' | 'editor' | 'viewer';
  online: boolean;
  color: string;
  cursor?: { lng: number; lat: number };
  avatar?: string;
}

// ============ 想定主接口 ============

export type ScenarioStatus = 'draft' | 'in_review' | 'approved' | 'archived';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  version: string; // 语义化版本
  status: ScenarioStatus;

  terrain: TerrainConfig;
  environment?: EnvironmentConfig;
  platforms: PlatformInstance[];
  routes: RouteDefinition[];
  zones: ZoneDefinition[];
  formations: FormationDefinition[];
  missions: MissionDefinition[];

  tags: string[];
  classification: string; // 密级
  collaborators: Collaborator[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============ 分支管理 ============

export interface ScenarioBranch {
  id: string;
  scenarioId: string;
  name: string;
  parentBranchId?: string;
  createdBy: string;
  createdAt: string;
  status: 'active' | 'merged' | 'abandoned';
}

// ============ 编辑器工具 ============

export type EditorTool =
  | 'select'
  | 'place_platform'
  | 'draw_route'
  | 'draw_zone_circle'
  | 'draw_zone_polygon'
  | 'measure'
  | 'comment';

// ============ 装备库条目 ============

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'aircraft' | 'ship' | 'submarine' | 'vehicle' | 'missile' | 'sensor';
  side: 'blue' | 'red' | 'neutral';
  model?: string; // 3D模型路径
  icon: string;
  maxSpeed: number; // 节
  maxAltitude: number; // 米
  sensors: string[];
  weapons: string[];
  description?: string;
}

// ============ 协同评论 ============

export interface ScenarioComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  position?: { lng: number; lat: number };
  entityType?: string;
  entityId?: string;
  resolved: boolean;
  createdAt: string;
  replies: ScenarioComment[];
}

// ============ 聊天消息 ============

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'system';
}

// ============ 编辑器状态快照 ============

export interface EditorSnapshot {
  timestamp: number;
  platforms: PlatformInstance[];
  routes: RouteDefinition[];
  zones: ZoneDefinition[];
}
