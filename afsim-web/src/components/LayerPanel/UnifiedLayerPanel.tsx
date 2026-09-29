/**
 * UnifiedLayerPanel - 统一图层控制面板
 * 显示图层树，支持可见性开关、透明度调节
 */
import { useMemo, useCallback } from 'react';
import { Tree, Switch, Slider, Space, Typography, Tooltip, Divider } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useLayerStore } from '../../store/layerStore';
import type { LayerTreeNode } from '../../core/layer/types';

const { Text } = Typography;

interface TreeNodeData {
  key: string;
  title: React.ReactNode;
  children?: TreeNodeData[];
  isLeaf?: boolean;
  layerId?: string;
}

export default function UnifiedLayerPanel() {
  const { tree, layers, nodeOverrides, toggleLayer, setLayerOpacity } = useLayerStore();

  // 构建 Ant Design Tree 数据
  const treeData = useMemo<TreeNodeData[]>(() => {
    return tree.map((node) => convertNode(node, nodeOverrides, layers));
  }, [tree, nodeOverrides, layers]);

  // 计算选中的叶子节点 key（可见的图层）
  const checkedKeys = useMemo(() => {
    const keys: string[] = [];
    collectVisibleKeys(tree, nodeOverrides, keys);
    return keys;
  }, [tree, nodeOverrides]);

  const handleCheck = useCallback((checked: any, info: any) => {
    const layerId = info.node?.layerId;
    if (layerId) {
      toggleLayer(layerId);
    }
  }, [toggleLayer]);

  // 找到当前选中图层的透明度
  const selectedOpacity = useMemo(() => {
    // 默认取第一个可见图层
    for (const node of tree) {
      const layerId = findFirstLayerId(node);
      if (layerId) {
        const override = nodeOverrides[layerId];
        return override?.opacity ?? 1;
      }
    }
    return 1;
  }, [tree, nodeOverrides]);

  return (
    <div style={{ padding: 12, color: '#e6edf3' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Text strong style={{ color: '#e6edf3', fontSize: 14 }}>图层控制</Text>

        <Tree
          checkable
          defaultExpandAll
          treeData={treeData}
          checkedKeys={checkedKeys}
          onCheck={handleCheck}
          selectable={false}
          style={{
            background: 'transparent',
            color: '#e6edf3',
          }}
        />

        <Divider style={{ margin: '8px 0', borderColor: '#30363d' }} />

        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>全局透明度</Text>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={selectedOpacity}
            onChange={(val) => {
              // 对所有图层设置透明度
              for (const node of tree) {
                applyOpacityToNode(node, val, setLayerOpacity);
              }
            }}
            styles={{ track: { background: '#1668dc' } }}
          />
        </Space>
      </Space>
    </div>
  );
}

// ============ 辅助函数 ============

function convertNode(
  node: LayerTreeNode,
  overrides: Record<string, { visible?: boolean; opacity?: number }>,
  layers: Record<string, any>,
): TreeNodeData {
  const override = node.layerId ? overrides[node.layerId] : undefined;
  const visible = override?.visible ?? node.visible;
  const isGroup = !!node.children?.length;

  const icon = node.locked ? (
    <LockOutlined style={{ color: '#8b949e', fontSize: 12, marginRight: 4 }} />
  ) : visible ? (
    <EyeOutlined style={{ color: '#3fb950', fontSize: 12, marginRight: 4 }} />
  ) : (
    <EyeInvisibleOutlined style={{ color: '#8b949e', fontSize: 12, marginRight: 4 }} />
  );

  return {
    key: node.key,
    title: (
      <span style={{ color: visible ? '#e6edf3' : '#6e7681', fontSize: 13 }}>
        {icon}
        {node.title}
      </span>
    ),
    layerId: node.layerId,
    children: node.children?.map((child) => convertNode(child, overrides, layers)),
  };
}

function collectVisibleKeys(
  nodes: LayerTreeNode[],
  overrides: Record<string, { visible?: boolean }>,
  keys: string[],
): void {
  for (const node of nodes) {
    const override = node.layerId ? overrides[node.layerId] : undefined;
    const visible = override?.visible ?? node.visible;
    if (visible) {
      keys.push(node.key);
    }
    if (node.children) {
      collectVisibleKeys(node.children, overrides, keys);
    }
  }
}

function findFirstLayerId(node: LayerTreeNode): string | null {
  if (node.layerId) return node.layerId;
  if (node.children) {
    for (const child of node.children) {
      const id = findFirstLayerId(child);
      if (id) return id;
    }
  }
  return null;
}

function applyOpacityToNode(
  node: LayerTreeNode,
  opacity: number,
  setOpacity: (id: string, val: number) => void,
): void {
  if (node.layerId) {
    setOpacity(node.layerId, opacity);
  }
  if (node.children) {
    for (const child of node.children) {
      applyOpacityToNode(child, opacity, setOpacity);
    }
  }
}
