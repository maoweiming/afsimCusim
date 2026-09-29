import React, { useState, useCallback } from 'react';
import {
  Tree,
  Switch,
  Slider,
  Dropdown,
  Typography,
  Space,
  Tooltip,
  Badge,
  Empty,
  Divider,
} from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  ZoomInOutlined,
  SettingOutlined,
  LockOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  BlockOutlined,
} from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { useMapDataStore } from '../store/mapDataStore';
import type { LayerTreeNode, LayerGroup } from '../types';

const { Text } = Typography;

const GROUP_ICONS: Record<LayerGroup, React.ReactNode> = {
  basemap: <GlobalOutlined />,
  terrain: <EnvironmentOutlined />,
  vector: <ApartmentOutlined />,
  overlay: <BlockOutlined />,
};

const GROUP_COLORS: Record<LayerGroup, string> = {
  basemap: '#1677ff',
  terrain: '#52c41a',
  vector: '#faad14',
  overlay: '#722ed1',
};

const STATUS_COLORS: Record<string, string> = {
  ready: '#52c41a',
  processing: '#faad14',
  uploading: '#1677ff',
  error: '#ff4d4f',
};

const MapLayerPanel: React.FC = () => {
  const {
    layerTree,
    activeLayers,
    toggleLayer,
    setLayerOpacity,
    updateTreeNode,
    dataSources,
  } = useMapDataStore();

  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    'group-basemap',
    'group-terrain',
    'group-vector',
    'group-overlay',
  ]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingOpacity, setEditingOpacity] = useState<string | null>(null);

  const isLayerVisible = useCallback(
    (key: string) => activeLayers.includes(key),
    [activeLayers]
  );

  const getDataSourceStatus = useCallback(
    (dataSourceId?: string) => {
      if (!dataSourceId) return null;
      return dataSources.find((d) => d.id === dataSourceId)?.status;
    },
    [dataSources]
  );

  const handleContextMenu = (key: string, action: string) => {
    switch (action) {
      case 'zoom':
        console.log('Zoom to layer:', key);
        break;
      case 'delete':
        console.log('Delete layer:', key);
        break;
      case 'properties':
        setSelectedKey(key);
        break;
    }
  };

  const buildTreeData = (nodes: LayerTreeNode[]): DataNode[] =>
    nodes.map((node) => {
      const isGroup = !!node.children;
      const status = getDataSourceStatus(node.dataSourceId);
      const isVisible = isLayerVisible(node.key);
      const isLocked = node.locked;

      const title = (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingRight: 4,
          }}
        >
          <Space size={6} style={{ flex: 1, minWidth: 0 }}>
            {isGroup && (
              <span style={{ color: GROUP_COLORS[node.group] }}>
                {GROUP_ICONS[node.group]}
              </span>
            )}
            <Text
              ellipsis
              style={{
                color: isVisible ? '#fff' : '#888',
                fontSize: 13,
                maxWidth: isGroup ? 120 : 100,
              }}
            >
              {node.title}
            </Text>
            {status && status !== 'ready' && (
              <Badge
                color={STATUS_COLORS[status]}
                size="small"
                title={status === 'error' ? '错误' : status === 'processing' ? '处理中' : '上传中'}
              />
            )}
            {isLocked && (
              <LockOutlined style={{ color: '#666', fontSize: 11 }} />
            )}
          </Space>
          {!isGroup && (
            <Space size={4}>
              {editingOpacity === node.key ? (
                <Slider
                  min={0}
                  max={100}
                  value={Math.round((node.opacity ?? 1) * 100)}
                  onChange={(v) => updateTreeNode(node.key, { opacity: v / 100 })}
                  style={{ width: 60 }}
                  tooltip={{ formatter: (v) => `${v}%` }}
                />
              ) : null}
              <Switch
                size="small"
                checked={isVisible}
                onChange={() => toggleLayer(node.key)}
                disabled={isLocked}
              />
            </Space>
          )}
        </div>
      );

      const contextMenu = isGroup
        ? undefined
        : {
            items: [
              {
                key: 'zoom',
                icon: <ZoomInOutlined />,
                label: '缩放到图层',
                onClick: () => handleContextMenu(node.key, 'zoom'),
              },
              {
                key: 'opacity',
                icon: <EyeOutlined />,
                label: editingOpacity === node.key ? '收起透明度' : '调整透明度',
                onClick: () =>
                  setEditingOpacity(editingOpacity === node.key ? null : node.key),
              },
              {
                key: 'properties',
                icon: <SettingOutlined />,
                label: '属性',
                onClick: () => handleContextMenu(node.key, 'properties'),
              },
              { type: 'divider' as const },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: '删除',
                danger: true,
                onClick: () => handleContextMenu(node.key, 'delete'),
              },
            ],
          };

      const nodeContent = contextMenu ? (
        <Dropdown menu={contextMenu} trigger={['contextMenu']}>
          <div style={{ width: '100%' }}>{title}</div>
        </Dropdown>
      ) : (
        title
      );

      return {
        key: node.key,
        title: nodeContent,
        children: node.children ? buildTreeData(node.children) : undefined,
        isLeaf: !isGroup,
        selectable: !isGroup,
      };
    });

  const treeData = buildTreeData(layerTree);

  const onDrop: TreeProps['onDrop'] = (info) => {
    const dropKey = info.node.key as string;
    const dragKey = info.dragNode.key as string;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

    // 简单的同层排序
    console.log('Reorder:', { dragKey, dropKey, dropPosition });
  };

  return (
    <div style={{ padding: 12 }}>
      <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
        <Text strong style={{ color: '#fff' }}>
          图层管理
        </Text>
        <Tooltip title="图层总数">
          <Badge
            count={dataSources.length}
            style={{ backgroundColor: '#1677ff' }}
            size="small"
          />
        </Tooltip>
      </Space>

      <Divider style={{ margin: '8px 0', borderColor: '#303030' }} />

      {treeData.length > 0 ? (
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys as string[])}
          selectedKeys={selectedKey ? [selectedKey] : []}
          onSelect={(keys) => setSelectedKey(keys[0] as string || null)}
          draggable
          onDrop={onDrop}
          showLine={{ showLeafIcon: false }}
          blockNode
          style={{
            backgroundColor: 'transparent',
            color: '#fff',
          }}
          className="map-layer-tree"
        />
      ) : (
        <Empty
          description="暂无图层"
          style={{ color: '#888' }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      <style>{`
        .map-layer-tree .ant-tree-node-content-wrapper {
          background: transparent !important;
          color: #d9d9d9;
        }
        .map-layer-tree .ant-tree-node-content-wrapper:hover {
          background: rgba(255,255,255,0.06) !important;
        }
        .map-layer-tree .ant-tree-node-selected .ant-tree-node-content-wrapper {
          background: rgba(22,119,255,0.15) !important;
        }
        .map-layer-tree .ant-tree-switcher {
          color: #888;
        }
        .map-layer-tree .ant-tree-title {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default MapLayerPanel;
