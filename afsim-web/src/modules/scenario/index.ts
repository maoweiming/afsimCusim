/**
 * 想定编辑模块入口
 * 导出所有公开接口、组件和类型
 */

// 类型导出
export type {
  Scenario,
  ScenarioStatus,
  TerrainConfig,
  PlatformInstance,
  RouteDefinition,
  RouteWaypoint,
  ZoneDefinition,
  ZoneCircleGeometry,
  ZonePolygonGeometry,
  ZoneGeometry,
  Collaborator,
  ScenarioBranch,
  EditorTool,
  EquipmentItem,
  ScenarioComment,
  ChatMessage,
  EditorSnapshot,
} from './types';

// 状态管理导出
export {
  useScenarioListStore,
  useScenarioEditorStore,
  useCollabStore,
} from './store/scenarioStore';

// API 导出
export {
  fetchScenarioList,
  fetchScenario,
  createScenario,
  updateScenario,
  deleteScenario,
  fetchEquipmentList,
  fetchBranches,
  createBranch,
  fetchComments,
  addComment,
  fetchChatMessages,
  sendChatMessage,
  savePlatforms,
  saveRoutes,
  saveZones,
} from './api/scenarioApi';

// 组件导出
export { ScenarioList } from './components/ScenarioList';
export { ScenarioEditor } from './components/ScenarioEditor';
export { PlatformPlacer } from './components/PlatformPlacer';
export { RouteEditor } from './components/RouteEditor';
export { ZoneEditor } from './components/ZoneEditor';
export { CollabPanel } from './components/CollabPanel';
export { ScenarioValidator } from './components/ScenarioValidator';
