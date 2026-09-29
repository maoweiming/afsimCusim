// ============================================================
// Equipment Module - Equipment Detail Component (AFSIM-native)
// 装备详情：直接展示 AfsimEquipment 的 WSF 组件数据
// ============================================================

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Descriptions,
  Tabs,
  Tag,
  Empty,
  Spin,
  Typography,
  Button,
  Space,
  Popconfirm,
  message,
  Card,
  Collapse,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  RadarChartOutlined,
  ThunderboltOutlined,
  WifiOutlined,
  SettingOutlined,
  FileTextOutlined,
  CarOutlined,
  CloudServerOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { EquipmentVersionHistory } from './EquipmentVersionHistory';
import { useEquipmentStore } from '../store/equipmentStore';
import type { AfsimEquipment } from '../afsim/types';
import { DOMAIN_LABELS } from '../afsim/enums';
import { getFieldLabel } from '../afsim/fieldLabels';
import { translateValue } from '../afsim/units';

const { Title, Text, Paragraph } = Typography;

// ============ Helpers ============

const SKIP_KEYS = new Set(['type', 'name', 'on', 'operational', 'debug', 'restorable', 'critical', 'categories']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null || v === '' || v === false) return false;
  if (Array.isArray(v) && v.length === 0) return false;
  if (isPlainObject(v) && Object.keys(v).length === 0) return false;
  return true;
}

// ============ Generic Property Renderer ============

function PropertyList({ data, skipKeys = SKIP_KEYS, columns = 2 }: { data: Record<string, unknown>; skipKeys?: Set<string>; columns?: number }) {
  const entries = Object.entries(data).filter(([k, v]) => !skipKeys.has(k) && hasValue(v));
  if (entries.length === 0) return null;

  return (
    <Descriptions size="small" column={columns} bordered>
      {entries.map(([key, value]) => (
        <Descriptions.Item key={key} label={getFieldLabel(key)}>
          <PropertyValue value={value} />
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

function PropertyValue({ value }: { value: unknown }): ReactNode {
  if (value === undefined || value === null) return <Text type="secondary">—</Text>;
  if (typeof value === 'boolean') return value ? '是' : '否';

  if (Array.isArray(value)) {
    if (value.length === 0) return <Text type="secondary">—</Text>;
    if (typeof value[0] !== 'object') {
      return (
        <Space size={2} wrap>
          {value.map((v, i) => <Tag key={i}>{String(v)}</Tag>)}
        </Space>
      );
    }
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {value.map((item, i) => (
          <Card key={i} size="small" style={{ background: '#1a1f27' }}>
            <PropertyList data={item as Record<string, unknown>} columns={2} />
          </Card>
        ))}
      </Space>
    );
  }

  if (isPlainObject(value)) {
    return <PropertyList data={value} columns={2} />;
  }

  return <Text code>{translateValue(value)}</Text>;
}

// ============ WSF Component Card ============

function WsfComponentCard({
  name,
  config,
  defaultOpen = false,
}: {
  name: string;
  config: Record<string, unknown>;
  defaultOpen?: boolean;
}) {
  const componentType = config.type as string | undefined;
  const isOn = config.on !== false;

  const subComponents: Array<{ key: string; data: Record<string, unknown> }> = [];
  const scalarProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (SKIP_KEYS.has(key)) continue;
    if (isPlainObject(value) && Object.keys(value).length > 0) {
      subComponents.push({ key, data: value as Record<string, unknown> });
    } else if (hasValue(value)) {
      scalarProps[key] = value;
    }
  }

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <Text strong style={{ color: '#e6edf3' }}>{name}</Text>
      {componentType && (
        <Tag color="blue" style={{ fontSize: 11, fontFamily: 'monospace' }}>{componentType}</Tag>
      )}
      <Tag color={isOn ? 'green' : 'default'} style={{ fontSize: 11 }}>
        {isOn ? 'ON' : 'OFF'}
      </Tag>
    </div>
  );

  return (
    <Card
      size="small"
      style={{ marginBottom: 8, background: '#0d1117', border: '1px solid #21262d' }}
    >
      <Collapse
        defaultActiveKey={defaultOpen ? ['props'] : []}
        ghost
        size="small"
        items={[{
          key: 'props',
          label: header,
          children: (
            <div>
              {Object.keys(scalarProps).length > 0 && (
                <PropertyList data={scalarProps} columns={3} />
              )}
              {subComponents.map((sub) => (
                <div key={sub.key} style={{ marginTop: 12 }}>
                  <Text strong style={{ display: 'block', marginBottom: 4, color: '#8b949e', fontSize: 12 }}>
                    {getFieldLabel(sub.key)}
                  </Text>
                  <PropertyList data={sub.data} columns={2} />
                </div>
              ))}
            </div>
          ),
        }]}
      />
    </Card>
  );
}

// ============ Component Map Tab ============

function ComponentMapTab({
  components,
  emptyText,
}: {
  components: Record<string, Record<string, unknown>> | undefined;
  emptyText: string;
}) {
  if (!components || Object.keys(components).length === 0) {
    return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div>
      {Object.entries(components).map(([name, config]) => (
        <WsfComponentCard key={name} name={name} config={config} defaultOpen={false} />
      ))}
    </div>
  );
}

// ============ Main Component ============

interface EquipmentDetailProps {
  onEdit?: () => void;
}

export function EquipmentDetail({ onEdit }: EquipmentDetailProps) {
  const selectedEquipment = useEquipmentStore((s) => s.selectedEquipment);
  const detailLoading = useEquipmentStore((s) => s.detailLoading);
  const openEditor = useEquipmentStore((s) => s.openEditor);
  const deleteEquipment = useEquipmentStore((s) => s.deleteEquipment);

  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const handleDelete = async () => {
    if (!selectedEquipment) return;
    try {
      await deleteEquipment(selectedEquipment.name);
      message.success('装备已删除');
    } catch {
      message.error('删除失败');
    }
  };

  if (detailLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  if (!selectedEquipment) {
    return (
      <Empty
        description="选择装备查看详情"
        style={{ padding: '60px 0' }}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  const eq = selectedEquipment;
  const platform = eq.platform;
  const sensorCount = Object.keys(platform.sensors || {}).length;
  const weaponCount = Object.keys(platform.weapons || {}).length;
  const commCount = Object.keys(platform.comms || {}).length;
  const processorCount = Object.keys(platform.processors || {}).length;
  const moverCount = Object.keys(platform.movers || {}).length;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* ---- Header ---- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            {eq.name}
          </Title>
          <Space size="small">
            {eq.parentType && (
              <Tag color="default" style={{ fontSize: 11 }}>
                继承: {eq.parentType}
              </Tag>
            )}
            {platform.spatialDomain && (
              <Tag color="blue">
                {DOMAIN_LABELS[platform.spatialDomain as keyof typeof DOMAIN_LABELS] ?? platform.spatialDomain}
              </Tag>
            )}
            {platform.side && (
              <Tag color={platform.side === 'blue' ? 'blue' : platform.side === 'red' ? 'red' : 'default'}>
                {platform.side}
              </Tag>
            )}
          </Space>
        </div>
        <Space>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => setShowVersionHistory(true)}
          >
            版本历史
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => { openEditor(eq); onEdit?.(); }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除该装备？" onConfirm={handleDelete}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* ---- Tabs ---- */}
      <Tabs
        size="small"
        items={[
          {
            key: 'basic',
            label: (
              <span>
                <FileTextOutlined /> 基本信息
              </span>
            ),
            children: <BasicInfoTab eq={eq} />,
          },
          {
            key: 'platform',
            label: (
              <span>
                <SettingOutlined /> 平台
              </span>
            ),
            children: <PlatformTab platform={platform} />,
          },
          {
            key: 'sensors',
            label: (
              <span>
                <RadarChartOutlined /> 传感器 ({sensorCount})
              </span>
            ),
            children: (
              <ComponentMapTab
                components={platform.sensors as unknown as Record<string, Record<string, unknown>>}
                emptyText="暂无传感器配置"
              />
            ),
          },
          {
            key: 'weapons',
            label: (
              <span>
                <ThunderboltOutlined /> 武器 ({weaponCount})
              </span>
            ),
            children: (
              <ComponentMapTab
                components={platform.weapons as unknown as Record<string, Record<string, unknown>>}
                emptyText="暂无武器配置"
              />
            ),
          },
          {
            key: 'comms',
            label: (
              <span>
                <WifiOutlined /> 通信 ({commCount})
              </span>
            ),
            children: (
              <ComponentMapTab
                components={platform.comms as unknown as Record<string, Record<string, unknown>>}
                emptyText="暂无通信配置"
              />
            ),
          },
          {
            key: 'processors',
            label: (
              <span>
                <CloudServerOutlined /> 处理器 ({processorCount})
              </span>
            ),
            children: (
              <ComponentMapTab
                components={platform.processors as unknown as Record<string, Record<string, unknown>>}
                emptyText="暂无处理器配置"
              />
            ),
          },
          {
            key: 'movers',
            label: (
              <span>
                <CarOutlined /> 动力/燃料 ({moverCount})
              </span>
            ),
            children: <MoversFuelsTab platform={platform} />,
          },
        ]}
      />

      {/* ---- Version history dialog ---- */}
      <EquipmentVersionHistory
        open={showVersionHistory}
        equipmentId={eq.name}
        equipmentName={eq.name}
        onClose={() => setShowVersionHistory(false)}
      />
    </div>
  );
}

// ============ Sub-tabs ============

function BasicInfoTab({ eq }: { eq: AfsimEquipment }) {
  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="装备名称">{eq.name}</Descriptions.Item>
      {eq.parentType && (
        <Descriptions.Item label="父类型">
          <Tag color="default">{eq.parentType}</Tag>
        </Descriptions.Item>
      )}
      {eq.platform.side && (
        <Descriptions.Item label="阵营">
          <Tag color={eq.platform.side === 'blue' ? 'blue' : eq.platform.side === 'red' ? 'red' : 'default'}>
            {eq.platform.side}
          </Tag>
        </Descriptions.Item>
      )}
      {eq.platform.spatialDomain && (
        <Descriptions.Item label="空间域">
          <Tag color="blue">
            {DOMAIN_LABELS[eq.platform.spatialDomain as keyof typeof DOMAIN_LABELS] ?? eq.platform.spatialDomain}
          </Tag>
        </Descriptions.Item>
      )}
      {eq.platform.icon && (
        <Descriptions.Item label="图标">{eq.platform.icon}</Descriptions.Item>
      )}
      {eq.platform.categories && eq.platform.categories.length > 0 && (
        <Descriptions.Item label="分类">
          <Space size={2} wrap>
            {eq.platform.categories.map((c) => <Tag key={c}>{c}</Tag>)}
          </Space>
        </Descriptions.Item>
      )}
      {eq.platform.destructible !== undefined && (
        <Descriptions.Item label="可摧毁">
          {eq.platform.destructible ? '是' : '否'}
        </Descriptions.Item>
      )}
    </Descriptions>
  );
}

function PlatformTab({ platform }: { platform: AfsimEquipment['platform'] }) {
  const skipKeys = new Set(['sensors', 'weapons', 'comms', 'processors', 'movers', 'fuels', 'zones', 'routers', 'commandChains', 'categories', 'side', 'icon', 'marking', 'spatialDomain', 'destructible', 'position']);

  const entries = Object.entries(platform).filter(([k, v]) => !skipKeys.has(k) && hasValue(v));
  if (entries.length === 0) {
    return <Empty description="暂无平台参数" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Descriptions size="small" column={2} bordered>
      {entries.map(([key, value]) => (
        <Descriptions.Item key={key} label={getFieldLabel(key)}>
          <PropertyValue value={value} />
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

function MoversFuelsTab({ platform }: { platform: AfsimEquipment['platform'] }) {
  const movers = platform.movers || {};
  const fuels = platform.fuels || {};
  const hasMovers = Object.keys(movers).length > 0;
  const hasFuels = Object.keys(fuels).length > 0;

  if (!hasMovers && !hasFuels) {
    return <Empty description="暂无动力/燃料配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div>
      {hasMovers && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            <CarOutlined style={{ marginRight: 4 }} /> 动力系统
          </Text>
          {Object.entries(movers).map(([name, config]) => (
            <WsfComponentCard key={name} name={name} config={config as unknown as Record<string, unknown>} defaultOpen />
          ))}
        </>
      )}
      {hasFuels && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8, marginTop: hasMovers ? 16 : 0 }}>
            <DashboardOutlined style={{ marginRight: 4 }} /> 燃料系统
          </Text>
          {Object.entries(fuels).map(([name, config]) => (
            <WsfComponentCard key={name} name={name} config={config as unknown as Record<string, unknown>} defaultOpen />
          ))}
        </>
      )}
    </div>
  );
}
