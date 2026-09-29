/**
 * EntityTreePanel - 想定实体树（航母攻防版）
 * 按阵营分组，航母下按类型显示载机，编队和任务独立分组
 * 支持拖拽：飞机→航母（装载）、飞机→编队（加入）、拖拽调整顺序
 */
import React, { useMemo, useCallback } from 'react';
import { Tree, Typography, Empty, Badge, Tag } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  AimOutlined,
  BranchesOutlined,
  EnvironmentOutlined,
  RocketOutlined,
  ClusterOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import type {
  PlatformInstance,
  RouteDefinition,
  ZoneDefinition,
  FormationDefinition,
  MissionDefinition,
} from '../types';

const { Text } = Typography;

// ============ Types ============

interface EntityTreePanelProps {
  platforms: PlatformInstance[];
  routes: RouteDefinition[];
  zones: ZoneDefinition[];
  formations: FormationDefinition[];
  missions: MissionDefinition[];
  selectedPlatformId: string | null;
  selectedRouteId: string | null;
  selectedZoneId: string | null;
  selectedFormationId: string | null;
  selectedMissionId: string | null;
  onSelectPlatform: (id: string | null) => void;
  onSelectRoute: (id: string | null) => void;
  onSelectZone: (id: string | null) => void;
  onSelectFormation: (id: string | null) => void;
  onSelectMission: (id: string | null) => void;
  onDrop?: (dragKey: string, dropKey: string, dropToGap: boolean) => void;
}

// ============ Side config ============

const SIDE_OPTIONS = [
  { value: 'blue', label: '蓝方', color: '#0078d7' },
  { value: 'red', label: '红方', color: '#d72828' },
  { value: 'neutral', label: '中立', color: '#8899aa' },
  { value: 'green', label: '绿方', color: '#28b43c' },
];

// ============ Aircraft type labels ============

const AIRCRAFT_TYPE_LABELS: Record<string, string> = {
  fighter: '战斗机',
  bomber: '轰炸机',
  awacs: '预警机',
  helicopter: '直升机',
  transport: '运输机',
  tanker: '加油机',
  uav: '无人机',
};

const MISSION_TYPE_LABELS: Record<string, string> = {
  strike: '打击',
  patrol: '巡逻',
  cap: 'CAP',
  escort: '护航',
  recon: '侦察',
};

const MISSION_TYPE_COLORS: Record<string, string> = {
  strike: '#f5222d',
  patrol: '#1890ff',
  cap: '#fa8c16',
  escort: '#52c41a',
  recon: '#722ed1',
};

const FORMATION_TYPE_LABELS: Record<string, string> = {
  vic: 'V字形',
  trail: '纵队',
  line_abreast: '横排',
  custom: '自定义',
};

// ============ Helpers ============

function getAircraftType(p: PlatformInstance): string {
  return p.categories?.[0] ?? p.equipmentRef?.category ?? 'unknown';
}

function isAircraft(p: PlatformInstance): boolean {
  const cat = getAircraftType(p);
  return ['fighter', 'bomber', 'awacs', 'helicopter', 'transport', 'tanker', 'uav'].includes(cat);
}

function isCarrier(p: PlatformInstance): boolean {
  const cat = p.categories?.[0] ?? p.equipmentRef?.category ?? '';
  return cat === 'carrier';
}

// ============ Component ============

export const EntityTreePanel: React.FC<EntityTreePanelProps> = ({
  platforms,
  routes,
  zones,
  formations,
  missions,
  selectedPlatformId,
  selectedRouteId,
  selectedZoneId,
  selectedFormationId,
  selectedMissionId,
  onSelectPlatform,
  onSelectRoute,
  onSelectZone,
  onSelectFormation,
  onSelectMission,
  onDrop,
}) => {
  // Build tree data
  const treeData = useMemo<DataNode[]>(() => {
    // Group platforms by side
    const sideGroups = new Map<string, PlatformInstance[]>();
    for (const p of platforms) {
      const arr = sideGroups.get(p.side) ?? [];
      arr.push(p);
      sideGroups.set(p.side, arr);
    }

    const platformNodes: DataNode[] = SIDE_OPTIONS
      .filter((so) => sideGroups.has(so.value))
      .map((so) => {
        const sidePlatforms = sideGroups.get(so.value) ?? [];

        // Separate carriers and non-carriers
        const carriers = sidePlatforms.filter(isCarrier);
        const nonCarriers = sidePlatforms.filter((p) => !isCarrier(p));
        // Non-carrier, non-embarked platforms
        const freePlatforms = nonCarriers.filter((p) => !p.carrierId);
        // Embarked aircraft grouped by carrier
        const embarkedByCarrier = new Map<string, PlatformInstance[]>();
        for (const p of nonCarriers) {
          if (p.carrierId) {
            const arr = embarkedByCarrier.get(p.carrierId) ?? [];
            arr.push(p);
            embarkedByCarrier.set(p.carrierId, arr);
          }
        }

        const children: DataNode[] = [];

        // Carrier nodes (expandable with embarked aircraft)
        for (const carrier of carriers) {
          const embarked = embarkedByCarrier.get(carrier.id) ?? [];
          // Group embarked by aircraft type
          const typeGroups = new Map<string, PlatformInstance[]>();
          for (const ac of embarked) {
            const type = getAircraftType(ac);
            const arr = typeGroups.get(type) ?? [];
            arr.push(ac);
            typeGroups.set(type, arr);
          }

          const carrierChildren: DataNode[] = [];
          if (embarked.length > 0) {
            for (const [type, aircraft] of typeGroups) {
              const label = AIRCRAFT_TYPE_LABELS[type] ?? type;
              carrierChildren.push({
                key: `carrier_type:${carrier.id}:${type}`,
                title: (
                  <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: 12, color: '#8b949e' }}>{label}</span>
                    <Badge count={aircraft.length} style={{ backgroundColor: '#30363d' }} size="small" />
                  </span>
                ),
                children: aircraft.map((ac) => ({
                  key: `platform:${ac.id}`,
                  title: (
                    <span style={{ fontSize: 12 }}>
                      <AimOutlined style={{ color: so.color, marginRight: 4 }} />
                      {ac.name}
                    </span>
                  ),
                  isLeaf: true,
                })),
              });
            }
          }

          children.push({
            key: `platform:${carrier.id}`,
            title: (
              <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>
                  <AimOutlined style={{ color: so.color, marginRight: 4 }} />
                  <strong>{carrier.name}</strong>
                  <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>航母</Tag>
                </span>
                <Badge count={embarked.length} style={{ backgroundColor: '#30363d' }} size="small" />
              </span>
            ),
            children: carrierChildren.length > 0 ? carrierChildren : undefined,
          });
        }

        // Free (non-embarked, non-carrier) platforms
        for (const p of freePlatforms) {
          children.push({
            key: `platform:${p.id}`,
            title: (
              <span style={{ fontSize: 12 }}>
                <AimOutlined style={{ color: so.color, marginRight: 4 }} />
                {p.name}
              </span>
            ),
            isLeaf: true,
          });
        }

        return {
          key: `side:${so.value}`,
          title: (
            <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: so.color,
                    marginRight: 6,
                  }}
                />
                {so.label}
              </span>
              <Badge
                count={sidePlatforms.length}
                style={{ backgroundColor: '#30363d' }}
                size="small"
              />
            </span>
          ),
          children,
        };
      });

    // Formations
    const formationNodes: DataNode[] =
      formations.length > 0
        ? [
            {
              key: 'formations',
              title: (
                <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Text strong style={{ color: '#e0e0e0', fontSize: 12 }}>
                    <ClusterOutlined style={{ marginRight: 6 }} />
                    编队
                  </Text>
                  <Badge count={formations.length} style={{ backgroundColor: '#30363d' }} size="small" />
                </span>
              ),
              children: formations.map((f) => {
                const leader = platforms.find((p) => p.id === f.leaderId);
                const memberCount = f.members.length;
                return {
                  key: `formation:${f.id}`,
                  title: (
                    <span style={{ fontSize: 12 }}>
                      <ClusterOutlined style={{ color: '#c8c83c', marginRight: 4 }} />
                      {f.name}
                      <Tag style={{ marginLeft: 4, fontSize: 10 }}>
                        {FORMATION_TYPE_LABELS[f.type] ?? f.type}
                      </Tag>
                      <span style={{ color: '#5a6a7a', marginLeft: 4 }}>
                        ({memberCount}架)
                      </span>
                    </span>
                  ),
                  children: f.members.map((m) => {
                    const mp = platforms.find((p) => p.id === m.platformId);
                    return {
                      key: `platform:${m.platformId}`,
                      title: (
                        <span style={{ fontSize: 11 }}>
                          <AimOutlined style={{ color: m.role === 'leader' ? '#faad14' : '#5a6a7a', marginRight: 4 }} />
                          {mp?.name ?? m.platformId}
                          {m.role === 'leader' && (
                            <Tag color="gold" style={{ marginLeft: 4, fontSize: 10 }}>长机</Tag>
                          )}
                        </span>
                      ),
                      isLeaf: true,
                    };
                  }),
                };
              }),
            },
          ]
        : [];

    // Missions
    const missionNodes: DataNode[] =
      missions.length > 0
        ? [
            {
              key: 'missions',
              title: (
                <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Text strong style={{ color: '#e0e0e0', fontSize: 12 }}>
                    <RocketOutlined style={{ marginRight: 6 }} />
                    任务
                  </Text>
                  <Badge count={missions.length} style={{ backgroundColor: '#30363d' }} size="small" />
                </span>
              ),
              children: missions.map((m) => {
                const label = MISSION_TYPE_LABELS[m.type] ?? m.type;
                const color = MISSION_TYPE_COLORS[m.type] ?? '#8899aa';
                return {
                  key: `mission:${m.id}`,
                  title: (
                    <span style={{ fontSize: 12 }}>
                      <RocketOutlined style={{ color, marginRight: 4 }} />
                      <Tag color={color} style={{ fontSize: 10 }}>{label}</Tag>
                      {m.name}
                      <span style={{ color: '#5a6a7a', marginLeft: 4 }}>
                        ({m.assignedPlatforms.length}架)
                      </span>
                    </span>
                  ),
                  isLeaf: true,
                };
              }),
            },
          ]
        : [];

    // Routes
    const routeNodes: DataNode[] =
      routes.length > 0
        ? [
            {
              key: 'routes',
              title: (
                <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Text strong style={{ color: '#e0e0e0', fontSize: 12 }}>
                    <BranchesOutlined style={{ marginRight: 6 }} />
                    航线
                  </Text>
                  <Badge count={routes.length} style={{ backgroundColor: '#30363d' }} size="small" />
                </span>
              ),
              children: routes.map((r) => ({
                key: `route:${r.id}`,
                title: (
                  <span style={{ fontSize: 12 }}>
                    <BranchesOutlined style={{ color: '#c8c83c', marginRight: 4 }} />
                    {r.name}
                    <span style={{ color: '#5a6a7a', marginLeft: 4 }}>
                      ({r.waypoints.length}点)
                    </span>
                  </span>
                ),
              })),
            },
          ]
        : [];

    // Zones
    const zoneTypeLabels: Record<string, string> = {
      exclusion: '禁入',
      inclusion: '包含',
      threat: '威胁',
      safe: '安全',
    };

    const zoneNodes: DataNode[] =
      zones.length > 0
        ? [
            {
              key: 'zones',
              title: (
                <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Text strong style={{ color: '#e0e0e0', fontSize: 12 }}>
                    <EnvironmentOutlined style={{ marginRight: 6 }} />
                    区域
                  </Text>
                  <Badge count={zones.length} style={{ backgroundColor: '#30363d' }} size="small" />
                </span>
              ),
              children: zones.map((z) => ({
                key: `zone:${z.id}`,
                title: (
                  <span style={{ fontSize: 12 }}>
                    <EnvironmentOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                    {z.name}
                    <span style={{ color: '#5a6a7a', marginLeft: 4 }}>
                      ({zoneTypeLabels[z.type] ?? z.type})
                    </span>
                  </span>
                ),
              })),
            },
          ]
        : [];

    return [...platformNodes, ...formationNodes, ...missionNodes, ...routeNodes, ...zoneNodes];
  }, [platforms, routes, zones, formations, missions]);

  // Selected keys
  const selectedKeys = useMemo(() => {
    if (selectedPlatformId) return [`platform:${selectedPlatformId}`];
    if (selectedRouteId) return [`route:${selectedRouteId}`];
    if (selectedZoneId) return [`zone:${selectedZoneId}`];
    if (selectedFormationId) return [`formation:${selectedFormationId}`];
    if (selectedMissionId) return [`mission:${selectedMissionId}`];
    return [];
  }, [selectedPlatformId, selectedRouteId, selectedZoneId, selectedFormationId, selectedMissionId]);

  // Expanded keys
  const defaultExpandedKeys = useMemo(() => {
    const keys: string[] = SIDE_OPTIONS
      .filter((so) => platforms.some((p) => p.side === so.value))
      .map((so) => `side:${so.value}`);
    // Expand carriers
    for (const p of platforms) {
      if (isCarrier(p)) keys.push(`platform:${p.id}`);
    }
    if (formations.length > 0) keys.push('formations');
    if (missions.length > 0) keys.push('missions');
    if (routes.length > 0) keys.push('routes');
    if (zones.length > 0) keys.push('zones');
    return keys;
  }, [platforms, routes, zones, formations, missions]);

  // Handle select
  const handleSelect = useCallback(
    (keys: React.Key[]) => {
      if (keys.length === 0) {
        onSelectPlatform(null);
        onSelectRoute(null);
        onSelectZone(null);
        onSelectFormation(null);
        onSelectMission(null);
        return;
      }
      const key = keys[0] as string;

      // Ignore group node clicks
      if (key.startsWith('side:') || key === 'routes' || key === 'zones' || key === 'formations' || key === 'missions') return;
      if (key.startsWith('carrier_type:')) return;

      if (key.startsWith('platform:')) {
        onSelectPlatform(key.slice('platform:'.length));
      } else if (key.startsWith('route:')) {
        onSelectRoute(key.slice('route:'.length));
      } else if (key.startsWith('zone:')) {
        onSelectZone(key.slice('zone:'.length));
      } else if (key.startsWith('formation:')) {
        onSelectFormation(key.slice('formation:'.length));
      } else if (key.startsWith('mission:')) {
        onSelectMission(key.slice('mission:'.length));
      }
    },
    [onSelectPlatform, onSelectRoute, onSelectZone, onSelectFormation, onSelectMission],
  );

  // Handle drop (drag-and-drop)
  const handleDrop = useCallback(
    (info: { dragNode: { key: React.Key }; node: { key: React.Key }; dropToGap: boolean }) => {
      if (!onDrop) return;
      const dragKey = info.dragNode.key as string;
      const dropKey = info.node.key as string;
      const dropToGap = info.dropToGap;
      onDrop(dragKey, dropKey, dropToGap);
    },
    [onDrop],
  );

  const totalEntities = platforms.length + routes.length + zones.length + formations.length + missions.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #2a3a4a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong style={{ color: '#e0e0e0', fontSize: 13 }}>
          实体列表
        </Text>
        <Badge count={totalEntities} style={{ backgroundColor: '#30363d' }} overflowCount={999} />
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 4px' }}>
        {totalEntities === 0 ? (
          <Empty
            description="暂无实体"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '40px 0' }}
          />
        ) : (
          <Tree
            treeData={treeData}
            selectedKeys={selectedKeys}
            defaultExpandedKeys={defaultExpandedKeys}
            onSelect={handleSelect}
            draggable
            onDrop={handleDrop}
            blockNode
            style={{ background: 'transparent' }}
          />
        )}
      </div>
    </div>
  );
};

export default EntityTreePanel;
