/**
 * CategoryTree - 装备分类树
 * 按空间域/阵营/平台类型分组，点击筛选列表
 */
import { useMemo, useCallback } from 'react';
import { Tree, Badge, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  AimOutlined,
  EnvironmentOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useEquipmentStore } from '../store/equipmentStore';
import { DOMAIN_LABELS, DOMAIN_VALUES } from '../afsim/enums';
import { PLATFORM_TYPE_LABELS, PLATFORM_TYPE_VALUES } from '../afsim/enums';

const { Text } = Typography;

// ============ Types ============

export interface CategoryFilter {
  dimension: 'spatialDomain' | 'side' | 'platformType';
  value: string;
}

interface CategoryTreeProps {
  activeFilter: CategoryFilter | null;
  onSelect: (filter: CategoryFilter | null) => void;
}

// ============ Side config ============

const SIDE_OPTIONS = [
  { value: 'blue', label: '蓝方', color: '#0078d7' },
  { value: 'red', label: '红方', color: '#d72828' },
  { value: 'neutral', label: '中立', color: '#8899aa' },
  { value: 'green', label: '绿方', color: '#28b43c' },
];

// ============ Component ============

export function CategoryTree({ activeFilter, onSelect }: CategoryTreeProps) {
  const equipmentList = useEquipmentStore((s) => s.equipmentList);
  // Count items per category
  const counts = useMemo(() => {
    const domain = new Map<string, number>();
    const side = new Map<string, number>();
    const type = new Map<string, number>();

    for (const eq of equipmentList) {
      // Domain
      const d = eq.platform.spatialDomain;
      if (d) domain.set(d, (domain.get(d) ?? 0) + 1);

      // Side
      const s = eq.platform.side;
      if (s) side.set(s, (side.get(s) ?? 0) + 1);

      // Platform type (from categories array)
      const cats = eq.platform.categories;
      if (cats) {
        for (const cat of cats) {
          if (PLATFORM_TYPE_VALUES.includes(cat as typeof PLATFORM_TYPE_VALUES[number])) {
            type.set(cat, (type.get(cat) ?? 0) + 1);
          }
        }
      }
    }

    return { domain, side, type };
  }, [equipmentList]);

  // Build tree data
  const treeData = useMemo<DataNode[]>(() => {
    const domainChildren: DataNode[] = DOMAIN_VALUES
      .filter((dv) => counts.domain.has(dv))
      .map((dv) => ({
        key: `domain:${dv}`,
        title: (
          <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>{DOMAIN_LABELS[dv]}</span>
            <Badge count={counts.domain.get(dv) ?? 0} style={{ backgroundColor: '#30363d' }} size="small" />
          </span>
        ),
      }));

    const sideChildren: DataNode[] = SIDE_OPTIONS
      .filter((so) => counts.side.has(so.value))
      .map((so) => ({
        key: `side:${so.value}`,
        title: (
          <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: so.color, marginRight: 6 }} />
              {so.label}
            </span>
            <Badge count={counts.side.get(so.value) ?? 0} style={{ backgroundColor: '#30363d' }} size="small" />
          </span>
        ),
      }));

    const typeChildren: DataNode[] = PLATFORM_TYPE_VALUES
      .filter((pt) => counts.type.has(pt))
      .map((pt) => ({
        key: `type:${pt}`,
        title: (
          <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>{PLATFORM_TYPE_LABELS[pt]}</span>
            <Badge count={counts.type.get(pt) ?? 0} style={{ backgroundColor: '#30363d' }} size="small" />
          </span>
        ),
      }));

    return [
      {
        key: 'domain',
        title: (
          <Text strong style={{ color: '#e0e0e0', fontSize: 12 }}>
            <EnvironmentOutlined style={{ marginRight: 6 }} />
            空间域
          </Text>
        ),
        children: domainChildren,
      },
      {
        key: 'side',
        title: (
          <Text strong style={{ color: '#e0e0e0', fontSize: 12 }}>
            <AimOutlined style={{ marginRight: 6 }} />
            阵营
          </Text>
        ),
        children: sideChildren,
      },
      {
        key: 'platformType',
        title: (
          <Text strong style={{ color: '#e0e0e0', fontSize: 12 }}>
            <RocketOutlined style={{ marginRight: 6 }} />
            平台类型
          </Text>
        ),
        children: typeChildren,
      },
    ];
  }, [counts]);

  // Derive selected key from activeFilter
  const selectedKeys = useMemo(() => {
    if (!activeFilter) return [];
    const { dimension, value } = activeFilter;
    const prefix = dimension === 'spatialDomain' ? 'domain' : dimension === 'side' ? 'side' : 'type';
    return [`${prefix}:${value}`];
  }, [activeFilter]);

  // Derive expanded keys (always expand all groups)
  const defaultExpandedKeys = ['domain', 'side', 'platformType'];

  const handleSelect = useCallback(
    (keys: React.Key[]) => {
      if (keys.length === 0) {
        onSelect(null);
        return;
      }
      const key = keys[0] as string;
      // Ignore group node clicks
      if (key === 'domain' || key === 'side' || key === 'platformType') return;

      const [prefix, ...rest] = key.split(':');
      const value = rest.join(':');
      const dimension = prefix === 'domain' ? 'spatialDomain' : prefix === 'side' ? 'side' : 'platformType';

      // Toggle off if clicking same filter
      if (activeFilter?.dimension === dimension && activeFilter?.value === value) {
        onSelect(null);
      } else {
        onSelect({ dimension: dimension as CategoryFilter['dimension'], value });
      }
    },
    [activeFilter, onSelect],
  );

  return (
    <div className="category-tree">
      <div className="category-tree-header">
        <Text strong style={{ color: '#e0e0e0', fontSize: 13 }}>
          分类浏览
        </Text>
        {activeFilter && (
          <div
            style={{ fontSize: 11, color: '#8b949e', cursor: 'pointer', marginTop: 4 }}
            onClick={() => onSelect(null)}
          >
            清除筛选
          </div>
        )}
      </div>
      <div className="category-tree-body">
        <Tree
          treeData={treeData}
          selectedKeys={selectedKeys}
          defaultExpandedKeys={defaultExpandedKeys}
          onSelect={handleSelect}
          blockNode
          style={{ background: 'transparent' }}
        />
      </div>
    </div>
  );
}

export default CategoryTree;
