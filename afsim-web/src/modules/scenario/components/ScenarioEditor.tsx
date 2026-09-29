/**
 * 想定编辑器 - 主布局
 * 左侧工具栏 | 中间地图区域 | 右侧属性面板
 * 底部时间轴
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Tooltip,
  Space,
  Tag,
  Badge,
  Spin,
  message,
  Dropdown,
  Typography,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Modal,
} from 'antd';
import {
  SelectOutlined,
  AimOutlined,
  BranchesOutlined,
  EnvironmentOutlined,
  RadiusSettingOutlined,
  EditOutlined,
  MessageOutlined,
  TeamOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  CompressOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  LockOutlined,
  UnlockOutlined,
  ClockCircleOutlined,
  DownOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  RocketOutlined,
  ClusterOutlined,
  DeploymentUnitOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import { useScenarioEditorStore, useCollabStore } from '../store/scenarioStore';
import {
  exportScenarioForSimulation,
  wrapAsGatewayScenario,
  downloadGatewayScenario,
} from '../utils/scenarioExporter';
import { uploadScenario, startSimulation } from '../../../api/client';
import { connectWebSocket } from '../../../api/websocket';
import { useSimStore } from '../../../store/simStore';
import { usePlatformStore } from '../../../store/platformStore';
import type { EditorTool, CommandChainAssignment, EngagementConfig, FormationDefinition, MissionDefinition, PlatformInstance } from '../types';
import type { MapEngine, LngLat } from '../../../core/map-engine/MapEngine';
import { resolvePlatformIcon } from '../../equipment/iconRegistry';
import { PlatformPlacer } from './PlatformPlacer';
import { RouteEditor } from './RouteEditor';
import { ZoneEditor } from './ZoneEditor';
import { CollabPanel } from './CollabPanel';
import { ScenarioMapContainer } from './ScenarioMapContainer';
import { ScenarioValidator } from './ScenarioValidator';
import { EntityTreePanel } from './EntityTreePanel';
import { EnvironmentPanel } from './EnvironmentPanel';

const { Sider, Content } = Layout;
const { Text } = Typography;

// ============ 工具配置 ============

const TOOLS: Array<{
  key: EditorTool;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}> = [
  { key: 'select', icon: <SelectOutlined />, label: '选择', shortcut: 'V' },
  { key: 'place_platform', icon: <AimOutlined />, label: '放置平台', shortcut: 'P' },
  { key: 'draw_route', icon: <BranchesOutlined />, label: '绘制路线', shortcut: 'R' },
  { key: 'draw_zone_circle', icon: <RadiusSettingOutlined />, label: '圆形区域', shortcut: 'C' },
  { key: 'draw_zone_polygon', icon: <EnvironmentOutlined />, label: '多边形区域', shortcut: 'G' },
  { key: 'measure', icon: <EditOutlined />, label: '量测', shortcut: 'M' },
  { key: 'comment', icon: <MessageOutlined />, label: '评论', shortcut: 'T' },
];

// ============ 右侧面板Tab ============

const RIGHT_TABS = [
  { key: 'entities', label: '实体', icon: <AimOutlined /> },
  { key: 'properties', label: '属性', icon: <SettingOutlined /> },
  { key: 'environment', label: '环境', icon: <CloudOutlined /> },
  { key: 'carriers', label: '航母', icon: <DeploymentUnitOutlined /> },
  { key: 'formations', label: '编队', icon: <ClusterOutlined /> },
  { key: 'missions', label: '任务', icon: <RocketOutlined /> },
  { key: 'collab', label: '协同', icon: <TeamOutlined /> },
  { key: 'comments', label: '评论', icon: <MessageOutlined /> },
  { key: 'chat', label: '聊天', icon: <MessageOutlined /> },
  { key: 'validate', label: '验证', icon: <CheckCircleOutlined /> },
];

interface ScenarioEditorProps {
  scenarioId: string;
  onBack?: () => void;
}

export const ScenarioEditor: React.FC<ScenarioEditorProps> = ({
  scenarioId,
  onBack,
}) => {
  const {
    currentScenario,
    loading,
    saving,
    dirty,
    currentBranch,
    branches,
    activeTool,
    selectedPlatformId,
    selectedRouteId,
    selectedZoneId,
    selectedFormationId,
    selectedMissionId,
    history,
    rightPanelTab,
    loadScenario,
    clearScenario,
    saveScenario,
    undo,
    redo,
    setActiveTool,
    setRightPanelTab,
    loadBranches,
    switchBranch,
    createBranch,
    equipment,
    addPlatform,
    loadEquipment,
    selectPlatform,
    selectRoute,
    selectZone,
    selectFormation,
    selectMission,
    addFormation,
    addMission,
    loadAircraftToCarrier,
    launchAircraft,
    recoverAircraft,
  } = useScenarioEditorStore();

  const { comments, loadComments, loadChat } = useCollabStore();

  const navigate = useNavigate();
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [mapEngine, setMapEngine] = useState<MapEngine | null>(null);
  const [cursorCoords, setCursorCoords] = useState<LngLat | null>(null);
  const [runningSimulation, setRunningSimulation] = useState(false);

  // 加载数据；卸载时清除 store，避免下次进入时渲染 Zustand 里的旧 currentScenario
  useEffect(() => {
    loadScenario(scenarioId);
    loadEquipment();
    return () => clearScenario();
  }, [scenarioId, loadScenario, loadEquipment, clearScenario]);

  useEffect(() => {
    if (scenarioId) {
      loadComments(scenarioId);
      loadChat();
    }
  }, [scenarioId, loadComments, loadChat]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === 's') {
          e.preventDefault();
          saveScenario();
          return;
        }
      }

      const tool = TOOLS.find((t) => t.shortcut?.toLowerCase() === key);
      if (tool) {
        setActiveTool(tool.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveScenario, setActiveTool]);

  // 保存
  const handleSave = useCallback(async () => {
    await saveScenario();
    message.success('想定已保存');
  }, [saveScenario]);

  // 创建分支
  const handleCreateBranch = useCallback(async () => {
    const name = `branch-${Date.now().toString(36)}`;
    await createBranch(name);
    message.success(`分支 ${name} 已创建`);
  }, [createBranch]);

  // 导出想定 → 上传网关 → 启动仿真
  const handleRunSimulation = useCallback(async () => {
    if (!currentScenario) return;
    setRunningSimulation(true);
    try {
      // 生成 AFSIM 场景文本（platform type defs 留空，由网关侧 demos 提供）
      const afsimBody = exportScenarioForSimulation(currentScenario, new Map());
      // 使用想定 id（ASCII，唯一）而非中文 name 生成 CASE 名/文件名，
      // 避免与同名的网关生产想定文件冲突，也避免 CASE 占位符全为下划线。
      const wrapped = wrapAsGatewayScenario(currentScenario.id, afsimBody, {
        endTime: '30 mins',
      });
      const filename = `${currentScenario.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.scenario`;
      const file = new File([wrapped], filename, { type: 'text/plain' });

      try {
        const scenarioInfo = await uploadScenario(file);
        const simStatus = await startSimulation(scenarioInfo.id, 'realtime');
        usePlatformStore.getState().clearAll();
        useSimStore.getState().startSimulation(scenarioInfo.id, simStatus.sim_id);
        useSimStore.getState().setSimTime(simStatus.sim_time);
        useSimStore.getState().setClockRate(simStatus.clock_rate);
        connectWebSocket(simStatus.sim_id);
        useSimStore.getState().setConnected(true);
        message.success('想定已上传并启动仿真');
        window.dispatchEvent(new Event('truesim:scenarios-updated'));
        navigate('/module/simulation');
      } catch {
        // 网关不可达时降级为本地下载
        downloadGatewayScenario(filename, wrapped);
        message.info('网关不可达，已下载 .scenario 文件，请手动上传到仿真网关');
      }
    } catch (err) {
      message.error(`导出失败: ${(err as Error).message}`);
    } finally {
      setRunningSimulation(false);
    }
  }, [currentScenario, navigate]);

  // 地图引擎就绪后设置鼠标跟踪
  useEffect(() => {
    if (!mapEngine) return;
    const cleanup = mapEngine.onHover((event) => {
      setCursorCoords({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    });
    return cleanup;
  }, [mapEngine]);

  // 选中实体时高亮，取消选中时取消高亮
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapEngine) return;
    const prev = prevSelectedRef.current;
    if (prev) {
      mapEngine.unhighlightEntity(prev);
    }
    if (selectedPlatformId) {
      const eid = `platform-${selectedPlatformId}`;
      mapEngine.highlightEntity(eid);
      prevSelectedRef.current = eid;
    } else if (selectedRouteId) {
      const eid = `route-${selectedRouteId}`;
      mapEngine.highlightEntity(eid);
      prevSelectedRef.current = eid;
    } else if (selectedZoneId) {
      const eid = `zone-${selectedZoneId}`;
      mapEngine.highlightEntity(eid);
      prevSelectedRef.current = eid;
    } else {
      prevSelectedRef.current = null;
    }
  }, [mapEngine, selectedPlatformId, selectedRouteId, selectedZoneId]);

  // ---- 实体同步：加载/新增/删除 ----
  const renderedEntityIds = useRef<Set<string>>(new Set());

  // 渲染单个实体到地图
  const renderEntity = useCallback((engine: MapEngine, type: string, id: string, data: Record<string, unknown>) => {
    const entityId = `${type}-${id}`;
    if (renderedEntityIds.current.has(entityId)) return;
    renderedEntityIds.current.add(entityId);

    if (type === 'platform') {
      const pos = data.initialPosition as { lng: number; lat: number };
      if (!pos) return;
      const sideColors: Record<string, string> = { blue: '#0078d7', red: '#d72828', green: '#28b43c' };
      const side = (data.side as string) || 'blue';
      const equipmentRef = data.equipmentRef as { category?: string } | undefined;
      const iconUrl = resolvePlatformIcon(undefined, equipmentRef?.category || 'unknown', side);
      engine.addEntity({
        id: entityId,
        type: 'point',
        position: { lng: pos.lng, lat: pos.lat, alt: (data.initialAltitude as number) || 0 },
        label: data.name as string,
        style: { iconUrl, pointColor: sideColors[side] || '#0078d7', pointSize: 10, pointOutline: true, pointOutlineColor: '#000', pointOutlineWidth: 2 },
      });
    } else if (type === 'route') {
      const waypoints = data.waypoints as Array<{ position: { lng: number; lat: number } }>;
      if (!waypoints?.length) return;
      engine.addEntity({
        id: entityId,
        type: 'polyline',
        positions: waypoints.map((wp) => ({ lng: wp.position.lng, lat: wp.position.lat, alt: 0 })),
        label: data.name as string,
        style: { lineColor: '#28b43c', lineWidth: 2, lineDash: [8, 4] },
      });
    } else if (type === 'zone') {
      const geometry = data.geometry as { type: string; center?: { lng: number; lat: number }; radius?: number; vertices?: Array<{ lng: number; lat: number }> };
      if (!geometry) return;
      const zoneColors: Record<string, string> = { exclusion: '#d72828', inclusion: '#0078d7', threat: '#d97706', safe: '#28b43c' };
      const zoneType = (data.type as string) || 'exclusion';
      if (geometry.type === 'circle' && geometry.center) {
        engine.addEntity({
          id: entityId, type: 'point',
          position: { lng: geometry.center.lng, lat: geometry.center.lat, alt: 0 },
          label: data.name as string,
          style: { pointColor: zoneColors[zoneType] || '#0078d7', pointSize: Math.min(20, Math.max(8, (geometry.radius || 1000) / 5000)) },
          properties: { radius: geometry.radius },
        });
      } else if (geometry.type === 'polygon' && geometry.vertices?.length) {
        engine.addEntity({
          id: entityId, type: 'polygon',
          positions: geometry.vertices.map((v) => ({ lng: v.lng, lat: v.lat, alt: 0 })),
          label: data.name as string,
          style: { fillColor: zoneColors[zoneType] || '#0078d7', fillOpacity: 0.15, outlineColor: zoneColors[zoneType] || '#0078d7', outlineWidth: 2 },
        });
      }
    }
  }, []);

  // 同步实体到地图（加载已有 + 清理已删除）
  useEffect(() => {
    if (!mapEngine || !currentScenario) return;

    // 1. 清理已删除的实体
    const currentIds = new Set<string>();
    currentScenario.platforms.forEach((p) => currentIds.add(`platform-${p.id}`));
    currentScenario.routes.forEach((r) => currentIds.add(`route-${r.id}`));
    currentScenario.zones.forEach((z) => currentIds.add(`zone-${z.id}`));

    for (const eid of renderedEntityIds.current) {
      if (!currentIds.has(eid)) {
        mapEngine.removeEntity(eid);
        renderedEntityIds.current.delete(eid);
      }
    }

    // 2. 渲染新实体
    currentScenario.platforms.forEach((p) => renderEntity(mapEngine, 'platform', p.id, p as unknown as Record<string, unknown>));
    currentScenario.routes.forEach((r) => renderEntity(mapEngine, 'route', r.id, r as unknown as Record<string, unknown>));
    currentScenario.zones.forEach((z) => renderEntity(mapEngine, 'zone', z.id, z as unknown as Record<string, unknown>));
  }, [mapEngine, currentScenario, renderEntity]);

  // ---- 缩放控制 ----
  const handleZoomIn = useCallback(() => {
    if (mapEngine) mapEngine.setView(mapEngine.getCenter(), mapEngine.getZoom() + 1);
  }, [mapEngine]);

  const handleZoomOut = useCallback(() => {
    if (mapEngine) mapEngine.setView(mapEngine.getCenter(), mapEngine.getZoom() - 1);
  }, [mapEngine]);

  const handleFitBounds = useCallback(() => {
    if (!mapEngine || !currentScenario) return;
    const positions = [
      ...currentScenario.platforms.map((p) => p.initialPosition),
      ...currentScenario.routes.flatMap((r) => r.waypoints.map((w) => w.position)),
    ];
    if (positions.length === 0) return;
    const lngs = positions.map((p) => p.lng);
    const lats = positions.map((p) => p.lat);
    const bounds = {
      west: Math.min(...lngs),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      north: Math.max(...lats),
    };
    mapEngine.fitBounds(bounds);
  }, [mapEngine, currentScenario]);

  // 地图点击处理
  const handleMapClick = useCallback(
    (lngLat: LngLat) => {
      if (activeTool === 'place_platform') {
        useScenarioEditorStore.getState().setPendingPosition(lngLat);
        return;
      }
      // 选择模式：根据点击位置查找最近的实体
      if (activeTool === 'select' && currentScenario) {
        const threshold = 0.5; // 度阈值（粗略匹配）
        let closest: { type: string; id: string; dist: number } | null = null;

        currentScenario.platforms.forEach((p) => {
          const dist = Math.hypot(p.initialPosition.lng - lngLat.lng, p.initialPosition.lat - lngLat.lat);
          if (dist < threshold && (!closest || dist < closest.dist)) {
            closest = { type: 'platform', id: p.id, dist };
          }
        });

        currentScenario.routes.forEach((r) => {
          r.waypoints.forEach((wp) => {
            const dist = Math.hypot(wp.position.lng - lngLat.lng, wp.position.lat - lngLat.lat);
            if (dist < threshold && (!closest || dist < closest.dist)) {
              closest = { type: 'route', id: r.id, dist };
            }
          });
        });

        if (closest) {
          const c = closest as { type: string; id: string; dist: number };
          if (c.type === 'platform') useScenarioEditorStore.getState().selectPlatform(c.id);
          else if (c.type === 'route') useScenarioEditorStore.getState().selectRoute(c.id);
        } else {
          // 点击空白处取消选择
          useScenarioEditorStore.getState().selectPlatform(null);
        }
      }
    },
    [activeTool, currentScenario]
  );

  // 拖拽放置：从装备卡片拖到地图上松手时，按落点坐标创建平台实例
  const handleDropEquipment = useCallback(
    (equipmentId: string, lngLat: LngLat) => {
      const eq = equipment.find((e) => e.id === equipmentId);
      if (!eq) return;

      const platformId = `plat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const platform: PlatformInstance = {
        id: platformId,
        equipmentRef: {
          equipmentId: eq.id,
          name: eq.name,
          category: eq.category,
        },
        name: eq.name,
        side: eq.side,
        initialPosition: { ...lngLat },
        initialAltitude: eq.category === 'aircraft' ? 8000 : 0,
        initialHeading: 0,
        initialSpeed: Math.round(eq.maxSpeed * 0.6),
        sensors: eq.sensors,
        weapons: eq.weapons,
      };

      addPlatform(platform);
      message.success(`已放置平台「${eq.name}」`);
    },
    [equipment, addPlatform]
  );

  // 分支菜单
  const branchMenu = {
    items: [
      ...branches.map((b) => ({
        key: b.id,
        label: (
          <Space>
            <span>{b.name}</span>
            {b.id === currentBranch?.id && <Tag color="blue">当前</Tag>}
          </Space>
        ),
      })),
      { type: 'divider' as const },
      {
        key: 'create',
        label: '创建新分支',
        icon: <BranchesOutlined />,
      },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'create') {
        handleCreateBranch();
      } else {
        switchBranch(key);
      }
    },
  };

  // 仅在没有任何可展示数据（首次打开或切换到不同想定）时显示全屏 Spinner；
  // 同一想定的后台刷新（loading=true）改用 Content 内的覆盖层，避免卸载地图
  if (!currentScenario || currentScenario.id !== scenarioId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <Spin size="large" tip="加载想定中..." />
      </div>
    );
  }

  const onlineCollaborators = currentScenario.collaborators.filter((c) => c.online);
  const unresolvedComments = comments.filter((c) => !c.resolved).length;

  return (
    <Layout style={{ height: '100%', background: 'var(--bg-primary)' }}>
      {/* 左侧工具栏 */}
      <Sider
        width={56}
        collapsedWidth={0}
        collapsed={leftPanelCollapsed}
        style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid #2a3a4a',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0',
            gap: 2,
          }}
        >
          {/* 返回按钮 */}
          <Tooltip title="返回列表" placement="right">
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              style={{ marginBottom: 8, color: 'var(--text-secondary)' }}
            />
          </Tooltip>

          <div
            style={{
              width: 32,
              height: 1,
              background: 'var(--border-color)',
              marginBottom: 8,
            }}
          />

          {/* 工具按钮 */}
          {TOOLS.map((tool) => (
            <Tooltip key={tool.key} title={`${tool.label} (${tool.shortcut})`} placement="right">
              <Button
                type={activeTool === tool.key ? 'primary' : 'text'}
                size="small"
                icon={tool.icon}
                onClick={() => setActiveTool(tool.key)}
                style={{
                  width: 40,
                  height: 36,
                  marginBottom: 2,
                  color: activeTool === tool.key ? '#fff' : 'var(--text-secondary)',
                }}
              />
            </Tooltip>
          ))}

          <div
            style={{
              width: 32,
              height: 1,
              background: 'var(--border-color)',
              margin: '8px 0',
            }}
          />

          {/* 撤销/重做 */}
          <Tooltip title="撤销" placement="right">
            <Button
              type="text"
              size="small"
              icon={<UndoOutlined />}
              onClick={undo}
              disabled={history.past.length === 0}
              className={history.past.length > 0 ? 'editor-toolbar-btn-active' : undefined}
              style={{
                width: 40,
                height: 36,
                color: history.past.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}
            />
          </Tooltip>
          <Tooltip title="重做" placement="right">
            <Button
              type="text"
              size="small"
              icon={<RedoOutlined />}
              onClick={redo}
              disabled={history.future.length === 0}
              className={history.future.length > 0 ? 'editor-toolbar-btn-active' : undefined}
              style={{
                width: 40,
                height: 36,
                color: history.future.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}
            />
          </Tooltip>
        </div>
      </Sider>

      {/* 中间区域 */}
      <Layout>
        {/* 顶部信息栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 16px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid #2a3a4a',
            minHeight: 40,
          }}
        >
          <Space size={12}>
            <Text
              strong
              style={{ fontSize: 14, color: 'var(--text-primary)', maxWidth: 300 }}
              ellipsis
            >
              {currentScenario.name}
            </Text>
            <Tag
              color={
                currentScenario.status === 'approved'
                  ? 'success'
                  : currentScenario.status === 'in_review'
                  ? 'processing'
                  : currentScenario.status === 'draft'
                  ? 'default'
                  : 'warning'
              }
            >
              {currentScenario.status === 'draft'
                ? '草稿'
                : currentScenario.status === 'in_review'
                ? '审核中'
                : currentScenario.status === 'approved'
                ? '已批准'
                : '已归档'}
            </Tag>
            <Tag>v{currentScenario.version}</Tag>
            {dirty && (
              <Tag color="warning">未保存</Tag>
            )}
          </Space>

          <Space size={8}>
            {/* 分支选择 */}
            <Dropdown menu={branchMenu} trigger={['click']}>
              <Button size="small" icon={<BranchesOutlined />}>
                {currentBranch?.name || 'main'} <DownOutlined />
              </Button>
            </Dropdown>

            {/* 缩放控制 */}
            <Tooltip title="放大">
              <Button size="small" type="text" icon={<ZoomInOutlined />} style={{ color: 'var(--text-secondary)' }} onClick={handleZoomIn} />
            </Tooltip>
            <Tooltip title="缩小">
              <Button size="small" type="text" icon={<ZoomOutOutlined />} style={{ color: 'var(--text-secondary)' }} onClick={handleZoomOut} />
            </Tooltip>
            <Tooltip title="适应视图">
              <Button size="small" type="text" icon={<CompressOutlined />} style={{ color: 'var(--text-secondary)' }} onClick={handleFitBounds} />
            </Tooltip>

            {/* 在线协作者 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
              {onlineCollaborators.slice(0, 5).map((c) => (
                <Tooltip key={c.userId} title={`${c.userName} (${c.role})`}>
                  <Badge dot color="#28b43c" offset={[-2, 2]}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: c.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#fff',
                        border: '2px solid #0a0e14',
                      }}
                    >
                      {c.userName.charAt(0)}
                    </div>
                  </Badge>
                </Tooltip>
              ))}
              {onlineCollaborators.length > 5 && (
                <Tag style={{ fontSize: 10 }}>+{onlineCollaborators.length - 5}</Tag>
              )}
            </div>

            {/* 保存 */}
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!dirty}
            >
              保存
            </Button>

            {/* 运行仿真 */}
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRunSimulation}
              loading={runningSimulation}
              disabled={currentScenario.status === 'archived'}
              style={{ background: '#28b43c', borderColor: '#28b43c' }}
            >
              运行仿真
            </Button>
          </Space>
        </div>

        <Layout style={{ background: 'transparent' }}>
          {/* 地图区域 */}
          <Content
            style={{
              position: 'relative',
              background: 'var(--bg-primary)',
              overflow: 'hidden',
            }}
          >
            {/* 同一想定后台刷新时的遮罩：地图保持挂载，避免 Leaflet 二次初始化失败 */}
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.45)',
                  pointerEvents: 'all',
                }}
              >
                <Spin size="large" tip="加载想定中..." />
              </div>
            )}
            <ScenarioMapContainer
              onMapReady={setMapEngine}
              onClick={handleMapClick}
              onDropEquipment={handleDropEquipment}
            >
              {/* 中心提示 - 无平台时显示 */}
              {currentScenario.platforms.length === 0 && !mapEngine && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <AimOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
                  <div style={{ fontSize: 14, marginBottom: 8 }}>
                    选择左侧工具开始编辑想定
                  </div>
                  <div style={{ fontSize: 12 }}>
                    按 <Tag>P</Tag> 放置平台，<Tag>R</Tag> 绘制路线，<Tag>C</Tag> 绘制区域
                  </div>
                </div>
              )}
            </ScenarioMapContainer>

            {/* 浮动工具面板 - zIndex 须高于 Leaflet 内部 pane（最高 700），否则地图图层会盖住面板 */}
            {activeTool === 'place_platform' && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 1000,
                }}
              >
                <PlatformPlacer />
              </div>
            )}
            {activeTool === 'draw_route' && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 1000,
                }}
              >
                <RouteEditor mapEngine={mapEngine} />
              </div>
            )}
            {(activeTool === 'draw_zone_circle' || activeTool === 'draw_zone_polygon') && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 1000,
                }}
              >
                <ZoneEditor
                  geometryType={activeTool === 'draw_zone_circle' ? 'circle' : 'polygon'}
                  mapEngine={mapEngine}
                />
              </div>
            )}

            {/* 坐标显示 */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                fontSize: 10,
                fontFamily: 'monospace',
                color: 'var(--text-muted)',
                background: 'rgba(13,17,23,0.8)',
                padding: '2px 8px',
                borderRadius: 3,
                zIndex: 10,
              }}
            >
              {cursorCoords
                ? `${cursorCoords.lat.toFixed(3)}°N ${cursorCoords.lng.toFixed(3)}°E`
                : '---'}{' '}
              | 缩放: {mapEngine?.getZoom() ?? '-'} | 工具: {TOOLS.find((t) => t.key === activeTool)?.label}
            </div>
          </Content>

          {/* 右侧属性面板 */}
          <Sider
            width={rightPanelCollapsed ? 0 : 320}
            collapsedWidth={0}
            collapsed={rightPanelCollapsed}
            style={{
              background: 'var(--bg-secondary)',
              borderLeft: '1px solid #2a3a4a',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: 320,
              }}
            >
              {/* 面板Tab */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #2a3a4a',
                  background: 'var(--bg-primary)',
                }}
              >
                {RIGHT_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() =>
                      setRightPanelTab(
                        tab.key as 'entities' | 'properties' | 'environment' | 'carriers' | 'formations' | 'missions' | 'collab' | 'comments' | 'chat' | 'validate'
                      )
                    }
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      background:
                        rightPanelTab === tab.key ? 'var(--bg-secondary)' : 'transparent',
                      border: 'none',
                      borderBottom:
                        rightPanelTab === tab.key
                          ? '2px solid var(--accent-primary)'
                          : '2px solid transparent',
                      color:
                        rightPanelTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.key === 'comments' && unresolvedComments > 0 && (
                      <Badge
                        count={unresolvedComments}
                        size="small"
                        style={{ marginLeft: 2 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* 面板内容 */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                {rightPanelTab === 'entities' && (
                  <EntityTreePanel
                    platforms={currentScenario?.platforms ?? []}
                    routes={currentScenario?.routes ?? []}
                    zones={currentScenario?.zones ?? []}
                    formations={currentScenario?.formations ?? []}
                    missions={currentScenario?.missions ?? []}
                    selectedPlatformId={selectedPlatformId}
                    selectedRouteId={selectedRouteId}
                    selectedZoneId={selectedZoneId}
                    selectedFormationId={selectedFormationId}
                    selectedMissionId={selectedMissionId}
                    onSelectPlatform={selectPlatform}
                    onSelectRoute={selectRoute}
                    onSelectZone={selectZone}
                    onSelectFormation={selectFormation}
                    onSelectMission={selectMission}
                    onDrop={(dragKey, dropKey) => {
                      // Drag-and-drop handling
                      if (dragKey.startsWith('platform:') && dropKey.startsWith('platform:')) {
                        const aircraftId = dragKey.slice('platform:'.length);
                        const carrierId = dropKey.slice('platform:'.length);
                        const carrier = currentScenario?.platforms.find((p) => p.id === carrierId);
                        if (carrier && (carrier.categories?.[0] ?? carrier.equipmentRef?.category) === 'carrier') {
                          loadAircraftToCarrier(carrierId, aircraftId);
                          message.success('飞机已装载到航母');
                        }
                      }
                      if (dragKey.startsWith('platform:') && dropKey.startsWith('formation:')) {
                        const aircraftId = dragKey.slice('platform:'.length);
                        const formationId = dropKey.slice('formation:'.length);
                        // Add to formation (handled by formation panel logic)
                        message.info(`将飞机 ${aircraftId} 加入编队 ${formationId}`);
                      }
                    }}
                  />
                )}
                {rightPanelTab === 'properties' && (
                  <PropertiesPanel mapEngine={mapEngine} />
                )}
                {rightPanelTab === 'environment' && (
                  <EnvironmentPanel />
                )}
                {rightPanelTab === 'carriers' && (
                  <CarrierOpsPanel />
                )}
                {rightPanelTab === 'formations' && (
                  <FormationPanel />
                )}
                {rightPanelTab === 'missions' && (
                  <MissionPanel />
                )}
                {rightPanelTab === 'collab' && (
                  <CollabPanel scenario={currentScenario} />
                )}
                {rightPanelTab === 'comments' && (
                  <CommentsPanel scenarioId={scenarioId} />
                )}
                {rightPanelTab === 'chat' && (
                  <ChatPanel />
                )}
                {rightPanelTab === 'validate' && (
                  <div style={{ padding: 12 }}>
                    <ScenarioValidator
                      scenario={currentScenario}
                      onLocateEntity={(entityId) => {
                        // 定位到实体：尝试 flyTo
                        const mapId = renderedEntityIds.current.has(entityId) ? entityId : null;
                        if (mapId && mapEngine) mapEngine.flyToEntity(mapId);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </Sider>
        </Layout>

        {/* 底部状态栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 16px',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid #2a3a4a',
            fontSize: 11,
            color: 'var(--text-muted)',
            minHeight: 32,
          }}
        >
          <Space size={16}>
            <span>
              <AimOutlined style={{ marginRight: 4 }} />
              平台: {currentScenario.platforms.length}
            </span>
            <span>
              <BranchesOutlined style={{ marginRight: 4 }} />
              路线: {currentScenario.routes.length}
            </span>
            <span>
              <EnvironmentOutlined style={{ marginRight: 4 }} />
              区域: {currentScenario.zones.length}
            </span>
            <span>
              <ClusterOutlined style={{ marginRight: 4 }} />
              编队: {currentScenario.formations?.length ?? 0}
            </span>
            <span>
              <RocketOutlined style={{ marginRight: 4 }} />
              任务: {currentScenario.missions?.length ?? 0}
            </span>
          </Space>
          <Space size={16}>
            <span>
              <TeamOutlined style={{ marginRight: 4 }} />
              在线: {onlineCollaborators.length}/{currentScenario.collaborators.length}
            </span>
            <span>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              更新: {new Date(currentScenario.updatedAt).toLocaleString('zh-CN')}
            </span>
            <span>
              <LockOutlined style={{ marginRight: 4 }} />
              密级: {currentScenario.classification}
            </span>
          </Space>
        </div>
      </Layout>
    </Layout>
  );
};

// ============ 航母操作面板 ============

const AIRCRAFT_TYPE_LABELS: Record<string, string> = {
  fighter: '战斗机',
  bomber: '轰炸机',
  awacs: '预警机',
  helicopter: '直升机',
  transport: '运输机',
  tanker: '加油机',
  uav: '无人机',
};

const CarrierOpsPanel: React.FC = () => {
  const {
    currentScenario,
    selectedPlatformId,
    selectPlatform,
    launchAircraft,
    recoverAircraft,
    loadAircraftToCarrier,
  } = useScenarioEditorStore();

  if (!currentScenario) return null;

  const carriers = currentScenario.platforms.filter(
    (p) => (p.categories?.[0] ?? p.equipmentRef?.category) === 'carrier'
  );

  const selectedCarrier = selectedPlatformId
    ? carriers.find((c) => c.id === selectedPlatformId)
    : carriers[0];

  if (!selectedCarrier) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
        <DeploymentUnitOutlined style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }} />
        <div>暂无航母平台</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>请先部署航母到想定中</div>
      </div>
    );
  }

  // Embarked aircraft (on this carrier)
  const embarked = currentScenario.platforms.filter((p) => p.carrierId === selectedCarrier.id);
  // Launched aircraft (were on this carrier, now launched)
  const launched = currentScenario.platforms.filter(
    (p) => !p.carrierId && p.categories?.includes('fighter') || p.categories?.includes('awacs') || p.categories?.includes('helicopter')
  );

  // Group embarked by type
  const typeGroups = new Map<string, typeof embarked>();
  for (const ac of embarked) {
    const type = ac.categories?.[0] ?? ac.equipmentRef?.category ?? 'unknown';
    const arr = typeGroups.get(type) ?? [];
    arr.push(ac);
    typeGroups.set(type, arr);
  }

  const handleLaunch = (aircraftId: string) => {
    launchAircraft(aircraftId);
    message.success('飞机已发射');
  };

  const handleRecover = (aircraftId: string) => {
    recoverAircraft(aircraftId, selectedCarrier.id);
    message.success('飞机已回收');
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
        <DeploymentUnitOutlined style={{ marginRight: 6 }} />
        {selectedCarrier.name} — 载机管理
      </div>

      {/* Embarked aircraft */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          已装载 ({embarked.length})
        </div>
        {embarked.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
            无载机 — 从实体树拖拽飞机到此航母进行装载
          </div>
        ) : (
          Array.from(typeGroups.entries()).map(([type, aircraft]) => (
            <div key={type} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                {AIRCRAFT_TYPE_LABELS[type] ?? type} ({aircraft.length})
              </div>
              {aircraft.map((ac) => (
                <div
                  key={ac.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 8px',
                    background: 'var(--bg-primary)',
                    borderRadius: 4,
                    marginBottom: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => selectPlatform(ac.id)}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{ac.name}</span>
                  <Button
                    size="small"
                    type="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunch(ac.id);
                    }}
                  >
                    发射
                  </Button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Quick load */}
      <div style={{ borderTop: '1px solid #2a3a4a', paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          快速装载
        </div>
        <Select
          size="small"
          style={{ width: '100%' }}
          placeholder="选择飞机装载到航母"
          onChange={(aircraftId) => {
            loadAircraftToCarrier(selectedCarrier.id, aircraftId);
            message.success('飞机已装载');
          }}
          options={currentScenario.platforms
            .filter((p) => {
              const cat = p.categories?.[0] ?? p.equipmentRef?.category ?? '';
              return ['fighter', 'awacs', 'helicopter', 'bomber', 'transport', 'tanker', 'uav'].includes(cat)
                && p.id !== selectedCarrier.id
                && p.carrierId !== selectedCarrier.id;
            })
            .map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
    </div>
  );
};

// ============ 编队管理面板 ============

const FORMATION_TYPE_OPTIONS = [
  { value: 'vic', label: 'V字形' },
  { value: 'trail', label: '纵队' },
  { value: 'line_abreast', label: '横排' },
  { value: 'custom', label: '自定义' },
];

/**
 * 按队形类型与序号计算僚机相对长机的偏移量（x: 前后，y: 左右，单位：米）
 * rank 从 1 开始，奇偶交替分配左右两侧
 */
function computeFormationOffset(
  type: FormationDefinition['type'],
  spacing: number,
  rank: number,
): { x: number; y: number; z: number } {
  const side = rank % 2 === 1 ? 1 : -1;
  const echelon = Math.ceil(rank / 2);
  switch (type) {
    case 'trail':
      return { x: -spacing * rank, y: 0, z: 0 };
    case 'line_abreast':
      return { x: 0, y: side * spacing * echelon, z: 0 };
    case 'vic':
    case 'custom':
    default:
      return { x: -spacing * echelon, y: side * spacing * echelon, z: 0 };
  }
}

const FormationPanel: React.FC = () => {
  const {
    currentScenario,
    selectedFormationId,
    selectFormation,
    addFormation,
    updateFormation,
    removeFormation,
  } = useScenarioEditorStore();

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchCount, setBatchCount] = useState(2);

  if (!currentScenario) return null;

  const formations = currentScenario.formations ?? [];
  const selected = formations.find((f) => f.id === selectedFormationId);

  const handleBatchAdd = () => {
    if (!selected) return;
    const available = currentScenario.platforms.filter(
      (p) => !selected.members.some((m) => m.platformId === p.id)
    );
    const count = Math.min(batchCount, available.length);
    if (count <= 0) {
      message.warning('没有可加入编队的平台');
      return;
    }
    const startRank = selected.members.length;
    const newMembers = available.slice(0, count).map((p, i) => ({
      platformId: p.id,
      role: 'wingman' as const,
      offset: computeFormationOffset(selected.type, selected.spacing, startRank + i + 1),
    }));
    updateFormation(selected.id, { members: [...selected.members, ...newMembers] });
    message.success(`已批量添加 ${count} 个成员`);
    setBatchModalOpen(false);
  };

  const handleCreate = () => {
    const id = `formation-${Date.now().toString(36)}`;
    addFormation({
      id,
      name: `编队 ${formations.length + 1}`,
      type: 'vic',
      leaderId: '',
      members: [],
      spacing: 500,
      bearing: 0,
    });
    selectFormation(id);
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          <ClusterOutlined style={{ marginRight: 6 }} />
          编队管理
        </div>
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建编队
        </Button>
      </div>

      {formations.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
          <ClusterOutlined style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }} />
          <div>暂无编队</div>
        </div>
      ) : (
        formations.map((f) => {
          const leader = currentScenario.platforms.find((p) => p.id === f.leaderId);
          return (
            <div
              key={f.id}
              style={{
                padding: '8px 10px',
                background: f.id === selectedFormationId ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                borderRadius: 4,
                marginBottom: 8,
                cursor: 'pointer',
                border: f.id === selectedFormationId ? '1px solid var(--accent-primary)' : '1px solid transparent',
              }}
              onClick={() => selectFormation(f.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
                <Space size={4}>
                  <Tag style={{ fontSize: 10 }}>
                    {FORMATION_TYPE_OPTIONS.find((o) => o.value === f.type)?.label ?? f.type}
                  </Tag>
                  <Tag style={{ fontSize: 10 }}>{f.members.length}架</Tag>
                </Space>
              </div>
              {leader && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  长机: {leader.name}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Selected formation detail */}
      {selected && (
        <div style={{ marginTop: 16, borderTop: '1px solid #2a3a4a', paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            编队详情
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={propLabelStyle}>名称</div>
              <Input
                size="small"
                value={selected.name}
                onChange={(e) => updateFormation(selected.id, { name: e.target.value })}
              />
            </div>
            <div>
              <div style={propLabelStyle}>队形</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={selected.type}
                onChange={(v) => updateFormation(selected.id, { type: v })}
                options={FORMATION_TYPE_OPTIONS}
              />
            </div>
            <div>
              <div style={propLabelStyle}>长机</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={selected.leaderId || undefined}
                onChange={(v) => {
                  const members = selected.members.map((m) =>
                    m.platformId === selected.leaderId ? { ...m, role: 'wingman' as const } : m
                  );
                  const existing = members.find((m) => m.platformId === v);
                  if (existing) {
                    updateFormation(selected.id, {
                      leaderId: v,
                      members: members.map((m) => m.platformId === v ? { ...m, role: 'leader' as const } : m),
                    });
                  } else {
                    updateFormation(selected.id, {
                      leaderId: v,
                      members: [...members, { platformId: v, role: 'leader', offset: { x: 0, y: 0, z: 0 } }],
                    });
                  }
                }}
                placeholder="选择长机"
                options={currentScenario.platforms
                  .filter((p) => {
                    const cat = p.categories?.[0] ?? p.equipmentRef?.category ?? '';
                    return ['fighter', 'awacs', 'helicopter', 'bomber'].includes(cat);
                  })
                  .map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <div style={propLabelStyle}>间距 (m)</div>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                value={selected.spacing}
                onChange={(v) => v !== null && updateFormation(selected.id, { spacing: v })}
                min={100}
                max={5000}
                step={100}
              />
            </div>
            <div>
              <div style={{ ...propLabelStyle, display: 'flex', justifyContent: 'space-between' }}>
                <span>成员 ({selected.members.length})</span>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ padding: 0, fontSize: 10, color: '#0078d7' }}
                  onClick={() => {
                    const available = currentScenario.platforms.filter(
                      (p) => !selected.members.some((m) => m.platformId === p.id)
                    );
                    if (available.length > 0) {
                      updateFormation(selected.id, {
                        members: [...selected.members, {
                          platformId: available[0].id,
                          role: 'wingman',
                          offset: { x: selected.spacing, y: 0, z: 0 },
                        }],
                      });
                    }
                  }}
                >
                  添加成员
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<ClusterOutlined />}
                  style={{ padding: 0, fontSize: 10, color: '#0078d7', marginLeft: 8 }}
                  onClick={() => { setBatchCount(2); setBatchModalOpen(true); }}
                >
                  批量添加
                </Button>
              </div>
              {selected.members.map((m, idx) => {
                const mp = currentScenario.platforms.find((p) => p.id === m.platformId);
                return (
                  <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                    <Tag color={m.role === 'leader' ? 'gold' : 'default'} style={{ fontSize: 10, margin: 0 }}>
                      {m.role === 'leader' ? '长机' : '僚机'}
                    </Tag>
                    <span style={{ fontSize: 11, flex: 1, color: 'var(--text-primary)' }}>
                      {mp?.name ?? m.platformId}
                    </span>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      style={{ padding: '0 2px' }}
                      onClick={() => {
                        updateFormation(selected.id, {
                          members: selected.members.filter((_, i) => i !== idx),
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <Popconfirm
              title="确定删除此编队？"
              onConfirm={() => {
                removeFormation(selected.id);
                selectFormation(null);
                message.success('编队已删除');
              }}
            >
              <Button size="small" danger block>
                删除编队
              </Button>
            </Popconfirm>
          </div>
        </div>
      )}

      <Modal
        title="批量添加编队成员"
        open={batchModalOpen}
        onCancel={() => setBatchModalOpen(false)}
        onOk={handleBatchAdd}
        okText="添加"
        cancelText="取消"
        width={320}
      >
        <div style={propLabelStyle}>添加数量</div>
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          value={batchCount}
          onChange={(v) => setBatchCount(v ?? 1)}
          min={1}
          max={20}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          将依次加入未在编队中的平台（角色均为僚机），并按当前队形「{FORMATION_TYPE_OPTIONS.find((o) => o.value === selected?.type)?.label}」自动计算各自的编队偏移量
        </div>
      </Modal>
    </div>
  );
};

// ============ 任务管理面板 ============

const MISSION_TYPE_OPTIONS = [
  { value: 'strike', label: '打击' },
  { value: 'patrol', label: '巡逻' },
  { value: 'cap', label: 'CAP' },
  { value: 'escort', label: '护航' },
  { value: 'recon', label: '侦察' },
  { value: 'engage', label: '武器交战' },
];

const ENGAGEMENT_ROE_OPTIONS = [
  { value: 'auto', label: '自动（满足条件即开火）' },
  { value: 'hold', label: '禁止开火（hold fire）' },
  { value: 'tight', label: '严格（仅确认敌方目标）' },
  { value: 'free', label: '自由交战（free fire）' },
];

const MISSION_STATUS_LABELS: Record<string, string> = {
  planned: '计划中',
  active: '执行中',
  completed: '已完成',
  aborted: '已取消',
};

function defaultEngagement(current?: EngagementConfig): EngagementConfig {
  return current ?? { weaponName: '', roe: 'auto' };
}

const MissionPanel: React.FC = () => {
  const {
    currentScenario,
    selectedMissionId,
    selectMission,
    addMission,
    updateMission,
    removeMission,
  } = useScenarioEditorStore();

  if (!currentScenario) return null;

  const missions = currentScenario.missions ?? [];
  const selected = missions.find((m) => m.id === selectedMissionId);

  const handleCreate = () => {
    const id = `mission-${Date.now().toString(36)}`;
    addMission({
      id,
      name: `任务 ${missions.length + 1}`,
      type: 'strike',
      assignedPlatforms: [],
      status: 'planned',
    });
    selectMission(id);
  };

  const MISSION_TYPE_COLORS: Record<string, string> = {
    strike: '#f5222d',
    patrol: '#1890ff',
    cap: '#fa8c16',
    escort: '#52c41a',
    recon: '#722ed1',
    engage: '#eb2f96',
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          <RocketOutlined style={{ marginRight: 6 }} />
          任务管理
        </div>
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建任务
        </Button>
      </div>

      {missions.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
          <RocketOutlined style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }} />
          <div>暂无任务</div>
        </div>
      ) : (
        missions.map((m) => (
          <div
            key={m.id}
            style={{
              padding: '8px 10px',
              background: m.id === selectedMissionId ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
              borderRadius: 4,
              marginBottom: 8,
              cursor: 'pointer',
              border: m.id === selectedMissionId ? '1px solid var(--accent-primary)' : '1px solid transparent',
            }}
            onClick={() => selectMission(m.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                <Tag color={MISSION_TYPE_COLORS[m.type]} style={{ fontSize: 10, marginRight: 4 }}>
                  {MISSION_TYPE_OPTIONS.find((o) => o.value === m.type)?.label ?? m.type}
                </Tag>
                {m.name}
              </span>
              <Tag style={{ fontSize: 10 }}>{MISSION_STATUS_LABELS[m.status] ?? m.status}</Tag>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {m.assignedPlatforms.length}架平台
              {m.targetZoneId && ` · 目标区域`}
              {m.routeId && ` · 航线`}
            </div>
          </div>
        ))
      )}

      {/* Selected mission detail */}
      {selected && (
        <div style={{ marginTop: 16, borderTop: '1px solid #2a3a4a', paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            任务详情
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={propLabelStyle}>名称</div>
              <Input
                size="small"
                value={selected.name}
                onChange={(e) => updateMission(selected.id, { name: e.target.value })}
              />
            </div>
            <div>
              <div style={propLabelStyle}>类型</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={selected.type}
                onChange={(v) => updateMission(selected.id, { type: v })}
                options={MISSION_TYPE_OPTIONS}
              />
            </div>
            <div>
              <div style={propLabelStyle}>状态</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={selected.status}
                onChange={(v) => updateMission(selected.id, { status: v })}
                options={Object.entries(MISSION_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
            <div>
              <div style={propLabelStyle}>目标区域</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={selected.targetZoneId || undefined}
                onChange={(v) => updateMission(selected.id, { targetZoneId: v || undefined })}
                allowClear
                placeholder="无"
                options={currentScenario.zones.map((z) => ({ value: z.id, label: z.name }))}
              />
            </div>
            <div>
              <div style={propLabelStyle}>任务航线</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={selected.routeId || undefined}
                onChange={(v) => updateMission(selected.id, { routeId: v || undefined })}
                allowClear
                placeholder="无"
                options={currentScenario.routes.map((r) => ({ value: r.id, label: r.name }))}
              />
            </div>
            <div>
              <div style={propLabelStyle}>关联编队</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={selected.formationId || undefined}
                onChange={(v) => updateMission(selected.id, { formationId: v || undefined })}
                allowClear
                placeholder="无"
                options={(currentScenario.formations ?? []).map((f) => ({ value: f.id, label: f.name }))}
              />
            </div>
            <div>
              <div style={{ ...propLabelStyle, display: 'flex', justifyContent: 'space-between' }}>
                <span>分配平台 ({selected.assignedPlatforms.length})</span>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ padding: 0, fontSize: 10, color: '#0078d7' }}
                  onClick={() => {
                    const available = currentScenario.platforms.filter(
                      (p) => !selected.assignedPlatforms.includes(p.id)
                    );
                    if (available.length > 0) {
                      updateMission(selected.id, {
                        assignedPlatforms: [...selected.assignedPlatforms, available[0].id],
                      });
                    }
                  }}
                >
                  添加
                </Button>
              </div>
              {selected.assignedPlatforms.map((pid, idx) => {
                const mp = currentScenario.platforms.find((p) => p.id === pid);
                return (
                  <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 11, flex: 1, color: 'var(--text-primary)' }}>
                      {mp?.name ?? pid}
                    </span>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      style={{ padding: '0 2px' }}
                      onClick={() => {
                        updateMission(selected.id, {
                          assignedPlatforms: selected.assignedPlatforms.filter((_, i) => i !== idx),
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            {selected.type === 'engage' && (
              <div style={{ borderTop: '1px solid #2a3a4a', paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  武器交战配置
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={propLabelStyle}>武器</div>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={selected.engagement?.weaponName || undefined}
                      onChange={(v) =>
                        updateMission(selected.id, {
                          engagement: { ...defaultEngagement(selected.engagement), weaponName: v },
                        })
                      }
                      allowClear
                      placeholder="选择武器"
                      options={Array.from(
                        new Set(
                          selected.assignedPlatforms
                            .map((pid) => currentScenario.platforms.find((p) => p.id === pid))
                            .flatMap((p) => p?.weapons ?? [])
                        )
                      ).map((w) => ({ value: w, label: w }))}
                    />
                  </div>
                  <div>
                    <div style={propLabelStyle}>目标平台</div>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={selected.engagement?.targetPlatformId || undefined}
                      onChange={(v) =>
                        updateMission(selected.id, {
                          engagement: { ...defaultEngagement(selected.engagement), targetPlatformId: v || undefined },
                        })
                      }
                      allowClear
                      placeholder="无（按区域/战术自动选择）"
                      options={currentScenario.platforms
                        .filter((p) => !selected.assignedPlatforms.includes(p.id))
                        .map((p) => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                  <div>
                    <div style={propLabelStyle}>交战规则（ROE）</div>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={selected.engagement?.roe ?? 'auto'}
                      onChange={(v) =>
                        updateMission(selected.id, {
                          engagement: { ...defaultEngagement(selected.engagement), roe: v },
                        })
                      }
                      options={ENGAGEMENT_ROE_OPTIONS}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={propLabelStyle}>交战距离 (米)</div>
                      <InputNumber
                        size="small"
                        style={{ width: '100%' }}
                        min={0}
                        value={selected.engagement?.maxRange}
                        onChange={(v) =>
                          updateMission(selected.id, {
                            engagement: { ...defaultEngagement(selected.engagement), maxRange: v ?? undefined },
                          })
                        }
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={propLabelStyle}>齐射数量</div>
                      <InputNumber
                        size="small"
                        style={{ width: '100%' }}
                        min={1}
                        value={selected.engagement?.salvoSize}
                        onChange={(v) =>
                          updateMission(selected.id, {
                            engagement: { ...defaultEngagement(selected.engagement), salvoSize: v ?? undefined },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <Popconfirm
              title="确定删除此任务？"
              onConfirm={() => {
                removeMission(selected.id);
                selectMission(null);
                message.success('任务已删除');
              }}
            >
              <Button size="small" danger block>
                删除任务
              </Button>
            </Popconfirm>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 属性面板 ============

const SIDE_COLORS: Record<string, string> = {
  blue: '#0078d7',
  red: '#d72828',
  neutral: 'var(--text-secondary)',
  green: '#28b43c',
};

const propLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--text-muted)',
  marginBottom: 4,
};

const PropertiesPanel: React.FC<{ mapEngine?: MapEngine | null }> = ({ mapEngine }) => {
  const {
    currentScenario,
    selectedPlatformId,
    selectedRouteId,
    selectedZoneId,
    updatePlatform,
    removePlatform,
    selectPlatform,
  } = useScenarioEditorStore();

  if (!currentScenario) return null;

  // 选中平台 — 可编辑表单
  if (selectedPlatformId) {
    const platform = currentScenario.platforms.find(
      (p) => p.id === selectedPlatformId
    );
    if (platform) {
      const handleChange = (field: string, value: unknown) => {
        updatePlatform(platform.id, { [field]: value } as any);
        // 同步更新地图实体
        if (mapEngine && (field === 'initialPosition' || field === 'initialAltitude')) {
          const pos = field === 'initialPosition' ? value as { lng: number; lat: number } : platform.initialPosition;
          const alt = field === 'initialAltitude' ? value as number : platform.initialAltitude;
          mapEngine.updateEntity(`platform-${platform.id}`, {
            position: { lng: pos.lng, lat: pos.lat, alt },
          });
        }
      };

      const handleDelete = () => {
        mapEngine?.removeEntity(`platform-${platform.id}`);
        removePlatform(platform.id);
        message.success('平台已删除');
      };

      // 同阵营其他平台列表（用于指挥官选择）
      const sameSidePlatforms = currentScenario.platforms.filter(
        (p) => p.id !== platform.id && p.side === platform.side
      );

      return (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              平台属性
            </div>
            <Popconfirm
              title="确定删除此平台？"
              onConfirm={handleDelete}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 名称 */}
            <div>
              <div style={propLabelStyle}>名称</div>
              <Input
                size="small"
                value={platform.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>

            {/* 装备引用（只读） */}
            <div>
              <div style={propLabelStyle}>装备</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {platform.equipmentRef
                  ? `${platform.equipmentRef.name || platform.equipmentRef.equipmentId} v${platform.equipmentRef.version}`
                  : platform.equipmentId || '-'}
              </div>
            </div>

            {/* 阵营 */}
            <div>
              <div style={propLabelStyle}>阵营</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={platform.side}
                onChange={(v) => handleChange('side', v)}
                options={[
                  { value: 'blue', label: '蓝方' },
                  { value: 'red', label: '红方' },
                  { value: 'neutral', label: '中立' },
                  { value: 'green', label: '绿方' },
                ]}
              />
            </div>

            {/* 位置 */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={propLabelStyle}>经度</div>
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  value={platform.initialPosition.lng}
                  onChange={(v) => v !== null && handleChange('initialPosition', { ...platform.initialPosition, lng: v })}
                  step={0.01}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={propLabelStyle}>纬度</div>
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  value={platform.initialPosition.lat}
                  onChange={(v) => v !== null && handleChange('initialPosition', { ...platform.initialPosition, lat: v })}
                  step={0.01}
                />
              </div>
            </div>

            {/* 高度 / 航向 / 速度 */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={propLabelStyle}>高度 (m)</div>
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  value={platform.initialAltitude}
                  onChange={(v) => v !== null && handleChange('initialAltitude', v)}
                  step={100}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={propLabelStyle}>航向 (°)</div>
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  value={platform.initialHeading}
                  onChange={(v) => v !== null && handleChange('initialHeading', v)}
                  min={0}
                  max={359}
                  step={5}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={propLabelStyle}>速度 (kn)</div>
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  value={platform.initialSpeed}
                  onChange={(v) => v !== null && handleChange('initialSpeed', v)}
                  min={0}
                  step={10}
                />
              </div>
            </div>

            {/* 航线分配 */}
            <div>
              <div style={propLabelStyle}>关联路线</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={platform.routeId || undefined}
                onChange={(v) => handleChange('routeId', v || undefined)}
                allowClear
                placeholder="无"
                options={currentScenario.routes.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
              />
            </div>

            {/* 指挥官 */}
            <div>
              <div style={propLabelStyle}>指挥官</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={platform.commander || undefined}
                onChange={(v) => handleChange('commander', v || undefined)}
                allowClear
                placeholder="无"
                options={[
                  { value: 'SELF', label: 'SELF（自主）' },
                  ...sameSidePlatforms.map((p) => ({
                    value: p.name,
                    label: p.name,
                  })),
                ]}
              />
            </div>

            {/* 指令链 */}
            <div>
              <div style={{ ...propLabelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>指令链</span>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ padding: 0, fontSize: 10, color: '#0078d7' }}
                  onClick={() => {
                    const chains = platform.commandChains ? [...platform.commandChains] : [];
                    chains.push({ chainName: `CHAIN_${chains.length + 1}`, leader: 'SELF' });
                    handleChange('commandChains', chains);
                  }}
                >
                  添加
                </Button>
              </div>
              {(platform.commandChains ?? []).length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>无</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(platform.commandChains ?? []).map((chain, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <Input
                        size="small"
                        value={chain.chainName}
                        onChange={(e) => {
                          const chains = [...(platform.commandChains ?? [])];
                          chains[idx] = { ...chains[idx], chainName: e.target.value };
                          handleChange('commandChains', chains);
                        }}
                        style={{ flex: 1 }}
                        placeholder="链名称"
                      />
                      <Select
                        size="small"
                        value={chain.leader}
                        onChange={(v) => {
                          const chains = [...(platform.commandChains ?? [])];
                          chains[idx] = { ...chains[idx], leader: v };
                          handleChange('commandChains', chains);
                        }}
                        style={{ flex: 1 }}
                        options={[
                          { value: 'SELF', label: 'SELF' },
                          ...sameSidePlatforms.map((p) => ({ value: p.name, label: p.name })),
                        ]}
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        style={{ padding: '0 2px' }}
                        onClick={() => {
                          const chains = (platform.commandChains ?? []).filter((_, i) => i !== idx);
                          handleChange('commandChains', chains);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 高级属性 */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={propLabelStyle}>延迟出现 (s)</div>
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  value={platform.creationTime ?? 0}
                  onChange={(v) => handleChange('creationTime', v ?? 0)}
                  min={0}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  size="small"
                  block
                  type={platform.indestructible ? 'primary' : 'default'}
                  onClick={() => handleChange('indestructible', !platform.indestructible)}
                  style={{ fontSize: 11 }}
                >
                  {platform.indestructible ? '不可摧毁 ✓' : '可摧毁'}
                </Button>
              </div>
            </div>

            {/* 批量生成计划（分批次到达） */}
            <div style={{ marginTop: 4, borderTop: '1px solid #2a3a4a', paddingTop: 10 }}>
              <div style={{ ...propLabelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>批量生成计划</span>
                <Button
                  type="text"
                  size="small"
                  style={{ padding: 0, fontSize: 10, color: '#0078d7' }}
                  onClick={() => {
                    if (platform.batchGroupId) {
                      // 取消批量计划
                      updatePlatform(platform.id, {
                        batchGroupId: undefined,
                        batchGroupSize: undefined,
                        batchIntervalSeconds: undefined,
                      });
                    } else {
                      handleChange('batchGroupId', `batch-${platform.id}`);
                      handleChange('batchGroupSize', 3);
                      handleChange('batchIntervalSeconds', 30);
                    }
                  }}
                >
                  {platform.batchGroupId ? '取消分批次' : '启用分批次'}
                </Button>
              </div>
              {platform.batchGroupId && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={propLabelStyle}>批次数量</div>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={platform.batchGroupSize ?? 1}
                      onChange={(v) => handleChange('batchGroupSize', v ?? 1)}
                      min={1}
                      max={100}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={propLabelStyle}>到达间隔 (s)</div>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={platform.batchIntervalSeconds ?? 0}
                      onChange={(v) => handleChange('batchIntervalSeconds', v ?? 0)}
                      min={0}
                    />
                  </div>
                </div>
              )}
              {platform.batchGroupId && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  导出仿真时将以本平台为模板，按"延迟出现 + i × 到达间隔"批量展开为 {platform.batchGroupSize ?? 1} 个实例
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  // 选中路线
  if (selectedRouteId) {
    const route = currentScenario.routes.find(
      (r) => r.id === selectedRouteId
    );
    if (route) {
      return (
        <div style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              color: 'var(--text-primary)',
            }}
          >
            路线属性
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PropertyRow label="名称" value={route.name} />
            <PropertyRow
              label="航路点数"
              value={String(route.waypoints.length)}
              mono
            />
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                航路点
              </div>
              {route.waypoints.map((wp, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '6px 8px',
                    background: 'var(--bg-primary)',
                    borderRadius: 4,
                    marginBottom: 4,
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>WP{idx + 1}: </span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {wp.position.lat.toFixed(3)}°N, {wp.position.lng.toFixed(3)}°E
                  </span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                    FL{(wp.altitude / 30.48).toFixed(0)} / {wp.speed}kn
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  // 选中区域
  if (selectedZoneId) {
    const zone = currentScenario.zones.find((z) => z.id === selectedZoneId);
    if (zone) {
      return (
        <div style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              color: 'var(--text-primary)',
            }}
          >
            区域属性
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PropertyRow label="名称" value={zone.name} />
            <PropertyRow
              label="类型"
              value={
                <Tag
                  color={
                    zone.type === 'exclusion'
                      ? 'red'
                      : zone.type === 'threat'
                      ? 'orange'
                      : zone.type === 'safe'
                      ? 'green'
                      : 'blue'
                  }
                >
                  {zone.type === 'exclusion'
                    ? '排除区'
                    : zone.type === 'threat'
                    ? '威胁区'
                    : zone.type === 'safe'
                    ? '安全区'
                    : '包含区'}
                </Tag>
              }
            />
            <PropertyRow
              label="几何"
              value={
                zone.geometry.type === 'circle'
                  ? `圆形 R=${(zone.geometry.radius / 1000).toFixed(1)}km`
                  : `多边形 ${zone.geometry.vertices.length}点`
              }
              mono
            />
          </div>
        </div>
      );
    }
  }

  // 未选中 - 显示想定概览
  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 12,
          color: 'var(--text-primary)',
        }}
      >
        想定概览
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PropertyRow label="名称" value={currentScenario.name} />
        <PropertyRow label="版本" value={`v${currentScenario.version}`} mono />
        <PropertyRow label="密级" value={currentScenario.classification} />
        <PropertyRow
          label="创建者"
          value={currentScenario.createdBy}
        />
        <PropertyRow
          label="创建时间"
          value={new Date(currentScenario.createdAt).toLocaleString('zh-CN')}
        />
        <PropertyRow
          label="更新时间"
          value={new Date(currentScenario.updatedAt).toLocaleString('zh-CN')}
        />
      </div>

      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        统计
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginTop: 8,
        }}
      >
        <StatCard
          label="平台"
          value={currentScenario.platforms.length}
          color="#0078d7"
        />
        <StatCard
          label="路线"
          value={currentScenario.routes.length}
          color="#28b43c"
        />
        <StatCard
          label="区域"
          value={currentScenario.zones.length}
          color="#c8c83c"
        />
        <StatCard
          label="协作者"
          value={currentScenario.collaborators.length}
          color="#d72828"
        />
      </div>
    </div>
  );
};

// ============ 属性行 ============

const PropertyRow: React.FC<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}> = ({ label, value, mono }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 0',
    }}
  >
    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
    <span
      style={{
        fontSize: 12,
        color: 'var(--text-primary)',
        fontFamily: mono ? 'monospace' : undefined,
      }}
    >
      {value}
    </span>
  </div>
);

// ============ 统计卡片 ============

const StatCard: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => (
  <div
    style={{
      background: 'var(--bg-primary)',
      borderRadius: 4,
      padding: '8px 12px',
      borderLeft: `3px solid ${color}`,
    }}
  >
    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
      {label}
    </div>
  </div>
);

// ============ 评论面板 ============

const CommentsPanel: React.FC<{ scenarioId: string }> = ({ scenarioId }) => {
  const { comments, loadComments, addComment } = useCollabStore();
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    loadComments(scenarioId);
  }, [scenarioId, loadComments]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment({
      userId: 'user-001',
      userName: '张指挥官',
      content: newComment.trim(),
      resolved: false,
    });
    setNewComment('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {comments.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
            暂无评论
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              style={{
                padding: '8px 10px',
                background: 'var(--bg-primary)',
                borderRadius: 4,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {c.userName}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {new Date(c.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {c.content}
              </div>
              {c.entityType && (
                <Tag style={{ marginTop: 4, fontSize: 10 }}>
                  {c.entityType}: {c.entityId}
                </Tag>
              )}
              {c.replies?.map((r) => (
                <div
                  key={r.id}
                  style={{
                    marginTop: 6,
                    padding: '6px 8px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 3,
                    marginLeft: 12,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {r.userName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.content}</div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <div
        style={{
          padding: 8,
          borderTop: '1px solid #2a3a4a',
          display: 'flex',
          gap: 6,
        }}
      >
        <Input
          size="small"
          placeholder="添加评论..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onPressEnter={handleAddComment}
        />
        <Button size="small" type="primary" onClick={handleAddComment}>
          发送
        </Button>
      </div>
    </div>
  );
};

// ============ 聊天面板 ============

const ChatPanel: React.FC = () => {
  const { chatMessages, loadChat, sendMessage } = useCollabStore();
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  const handleSend = async () => {
    if (!newMsg.trim()) return;
    await sendMessage(newMsg.trim());
    setNewMsg('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: 10,
              padding: '6px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 3,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {msg.userName}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {new Date(msg.timestamp).toLocaleTimeString('zh-CN')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          padding: 8,
          borderTop: '1px solid #2a3a4a',
          display: 'flex',
          gap: 6,
        }}
      >
        <Input
          size="small"
          placeholder="输入消息..."
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onPressEnter={handleSend}
        />
        <Button size="small" type="primary" onClick={handleSend}>
          发送
        </Button>
      </div>
    </div>
  );
};

export default ScenarioEditor;
