import { useMemo, useCallback } from 'react';
import { Tree, Typography, Tag, Space, Empty, Card, Tooltip } from 'antd';
import {
  ApartmentOutlined,
  TeamOutlined,
  UserOutlined,
  AimOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { usePlatformStore } from '../../../store/platformStore';
import type { PlatformInfo } from '../../../store/platformStore';

const { Text } = Typography;

// ============ Side helpers ============

function sideColor(side: string): string {
  const s = side.toLowerCase();
  if (s === 'blue' || s === 'friendly') return '#1890ff';
  if (s === 'red' || s === 'hostile') return '#ff4d4f';
  return 'var(--text-secondary)';
}

function sideLabel(side: string): string {
  const s = side.toLowerCase();
  if (s === 'blue' || s === 'friendly') return '蓝方';
  if (s === 'red' || s === 'hostile') return '红方';
  if (s === 'neutral') return '中立';
  return side || '未知';
}

function sideTag(side: string) {
  return (
    <Tag
      color={sideColor(side)}
      style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px' }}
    >
      {sideLabel(side)}
    </Tag>
  );
}

// ============ Tree building logic ============

/**
 * Build a command-chain tree from platform data.
 *
 * Each platform may carry a `commander` field (name of the commanding platform).
 * Platforms without a commander (or whose commander is not found) become top-level roots.
 * If no commander relationships exist at all, platforms are grouped by side as a flat tree.
 */
function buildCommandTree(
  platforms: Record<number, PlatformInfo>,
  onSelect: (index: number) => void,
): DataNode[] {
  const list = Object.values(platforms);
  if (list.length === 0) return [];

  // Check if any platform has a commander relationship
  const hasCommander = list.some(
    (p) => (p as PlatformInfo & { commander?: string }).commander,
  );

  // Map: platformName -> platform (for commander lookup)
  const nameMap = new Map<string, PlatformInfo>();
  for (const p of list) {
    if (p.name) nameMap.set(p.name, p);
  }

  // Map: commanderName -> subordinate platforms
  const childrenMap = new Map<string, PlatformInfo[]>();
  const roots: PlatformInfo[] = [];

  if (hasCommander) {
    for (const p of list) {
      const cmdName = (p as PlatformInfo & { commander?: string }).commander;
      if (cmdName && nameMap.has(cmdName) && cmdName !== p.name) {
        const arr = childrenMap.get(cmdName) ?? [];
        arr.push(p);
        childrenMap.set(cmdName, arr);
      } else {
        roots.push(p);
      }
    }
  } else {
    // No commander data — group by side
    roots.push(...list);
  }

  // Sort roots by side for visual grouping
  const sideOrder: Record<string, number> = { blue: 0, friendly: 0, red: 1, hostile: 1 };
  roots.sort(
    (a, b) =>
      (sideOrder[a.side.toLowerCase()] ?? 2) - (sideOrder[b.side.toLowerCase()] ?? 2),
  );

  // Recursively build tree nodes
  const toNode = (p: PlatformInfo): DataNode => {
    const subs = childrenMap.get(p.name) ?? [];
    const isSelected = false; // highlight is handled via onSelect callback

    const title = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          padding: '2px 0',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(p.index);
        }}
      >
        {subs.length > 0 ? (
          <CrownOutlined style={{ color: '#faad14', fontSize: 13 }} />
        ) : (
          <AimOutlined style={{ color: sideColor(p.side), fontSize: 13 }} />
        )}
        <Text
          strong
          style={{
            color: '#e6edf3',
            fontSize: 13,
          }}
        >
          {p.name || `平台-${p.index}`}
        </Text>
        {sideTag(p.side)}
        <Text type="secondary" style={{ fontSize: 11 }}>
          {p.typeId || ''}
        </Text>
        {subs.length > 0 && (
          <Tooltip title={`${subs.length} 个下属`}>
            <Tag
              style={{
                fontSize: 10,
                lineHeight: '16px',
                padding: '0 4px',
                background: 'var(--bg-tertiary)',
                border: '1px solid #374151',
                color: '#9ca3af',
              }}
            >
              {subs.length}
            </Tag>
          </Tooltip>
        )}
      </div>
    );

    return {
      key: p.index,
      title,
      icon: undefined,
      children: subs.length > 0 ? subs.map(toNode) : undefined,
    };
  };

  return roots.map(toNode);
}

// ============ Main Component ============

export default function CommandChainView() {
  const platforms = usePlatformStore((s) => s.platforms);
  const selectPlatform = usePlatformStore((s) => s.selectPlatform);
  const selectedPlatformIndex = usePlatformStore((s) => s.selectedPlatformIndex);

  const handleSelect = useCallback(
    (index: number) => {
      selectPlatform(index);
    },
    [selectPlatform],
  );

  const treeData = useMemo(
    () => buildCommandTree(platforms, handleSelect),
    [platforms, handleSelect],
  );

  const platformCount = Object.keys(platforms).length;

  // Selected keys for the Tree component
  const selectedKeys = useMemo(
    () => (selectedPlatformIndex !== null ? [selectedPlatformIndex] : []),
    [selectedPlatformIndex],
  );

  return (
    <div
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
        overflow: 'auto',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Header */}
      <Card
        size="small"
        bordered={false}
        style={{ background: 'var(--bg-secondary)' }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={8}>
            <ApartmentOutlined style={{ color: '#1890ff', fontSize: 16 }} />
            <Text strong style={{ color: '#e6edf3' }}>
              指挥链
            </Text>
          </Space>
          <Space size={6}>
            <Tag
              icon={<TeamOutlined />}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid #374151',
                color: '#9ca3af',
              }}
            >
              {platformCount} 平台
            </Tag>
          </Space>
        </div>
      </Card>

      {/* Tree */}
      {treeData.length > 0 ? (
        <Card
          size="small"
          bordered={false}
          style={{ background: 'var(--bg-secondary)', flex: 1, overflow: 'auto' }}
          bodyStyle={{ padding: '8px 4px' }}
        >
          <Tree
            showIcon
            defaultExpandAll
            treeData={treeData}
            selectedKeys={selectedKeys}
            style={{
              background: 'transparent',
              color: '#e6edf3',
            }}
          />
        </Card>
      ) : (
        <Card
          size="small"
          bordered={false}
          style={{
            background: 'var(--bg-secondary)',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          bodyStyle={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <Empty
            description={
              <Text type="secondary">暂无平台数据</Text>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}

      {/* Legend */}
      <Card
        size="small"
        bordered={false}
        style={{ background: 'var(--bg-secondary)' }}
        bodyStyle={{ padding: '6px 12px' }}
      >
        <Space size={12}>
          <Space size={4}>
            <CrownOutlined style={{ color: '#faad14', fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              指挥官
            </Text>
          </Space>
          <Space size={4}>
            <AimOutlined style={{ color: '#1890ff', fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              下属单元
            </Text>
          </Space>
          <Space size={4}>
            {sideTag('blue')}
            {sideTag('red')}
            {sideTag('neutral')}
          </Space>
        </Space>
      </Card>
    </div>
  );
}
