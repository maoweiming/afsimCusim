/**
 * EwStatusPanel - Displays electronic warfare state for the selected platform
 * Reads from useAiStore (ewStates) and usePlatformStore
 */
import { useMemo } from 'react';
import { Card, Table, Tag, Typography, Space, Empty, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { WifiOutlined } from '@ant-design/icons';
import { useAiStore } from '../../../store/aiStore';
import { usePlatformStore } from '../../../store/platformStore';
import type { EwState } from '../../../store/aiStore';

const { Text } = Typography;

// ============ Emitter table columns ============

const emitterColumns: ColumnsType<EwState['emitters'][number]> = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    render: (name: string) => (
      <Text style={{ color: '#e6edf3', fontSize: 12 }}>{name}</Text>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 60,
    ellipsis: true,
    render: (type: string) => (
      <Text type="secondary" style={{ fontSize: 11 }}>{type}</Text>
    ),
  },
  {
    title: '状态',
    dataIndex: 'isOn',
    key: 'isOn',
    width: 50,
    render: (isOn: boolean) => (
      <Badge
        status={isOn ? 'success' : 'default'}
        text={
          <Text style={{ fontSize: 11, color: isOn ? '#52c41a' : '#6b7280' }}>
            {isOn ? '开' : '关'}
          </Text>
        }
      />
    ),
  },
  {
    title: '频率',
    dataIndex: 'frequency',
    key: 'frequency',
    width: 70,
    render: (freq?: number) => (
      <Text style={{ color: '#e6edf3', fontSize: 11 }}>
        {freq != null ? `${freq.toFixed(1)} MHz` : '--'}
      </Text>
    ),
  },
  {
    title: '功率',
    dataIndex: 'power',
    key: 'power',
    width: 60,
    render: (power?: number) => (
      <Text style={{ color: '#e6edf3', fontSize: 11 }}>
        {power != null ? `${power.toFixed(1)} W` : '--'}
      </Text>
    ),
  },
];

// ============ Main Component ============

export default function EwStatusPanel() {
  const ewStates = useAiStore((s) => s.ewStates);
  const selectedPlatformIndex = usePlatformStore((s) => s.selectedPlatformIndex);
  const platforms = usePlatformStore((s) => s.platforms);

  const ewState = useMemo(() => {
    if (selectedPlatformIndex === null) return null;
    return ewStates.get(selectedPlatformIndex) ?? null;
  }, [ewStates, selectedPlatformIndex]);

  // No data
  if (!ewState) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Empty
          description="无电子战数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const jammingTargetName = ewState.jammingTarget != null
    ? platforms[ewState.jammingTarget]?.name ?? `#${ewState.jammingTarget}`
    : null;

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {/* Jamming Status */}
      <Card
        size="small"
        bordered={false}
        style={{ background: '#111820' }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={8}>
            <WifiOutlined style={{ color: ewState.isJamming ? '#ff4d4f' : '#52c41a' }} />
            <Text style={{ color: '#e6edf3', fontSize: 13 }}>干扰状态</Text>
          </Space>
          {ewState.isJamming ? (
            <Tag color="red">干扰中</Tag>
          ) : (
            <Tag color="green">静默</Tag>
          )}
        </div>
        {ewState.isJamming && (
          <div style={{ marginTop: 8 }}>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                类型: <Tag style={{ fontSize: 11 }}>{ewState.jammingType || '未知'}</Tag>
              </Text>
              {jammingTargetName && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  目标: <Text style={{ color: '#e6edf3', fontSize: 11 }}>{jammingTargetName}</Text>
                </Text>
              )}
            </Space>
          </div>
        )}
      </Card>

      {/* Emitter Table */}
      <Card
        size="small"
        title={
          <Space size={6}>
            <Text style={{ color: '#e6edf3', fontSize: 13 }}>辐射源</Text>
            <Tag style={{ fontSize: 10, background: '#1f2937', border: '1px solid #374151', color: '#9ca3af' }}>
              {ewState.emitters.length}
            </Tag>
          </Space>
        }
        bordered={false}
        style={{ background: '#111820' }}
        bodyStyle={{ padding: '0 4px' }}
      >
        {ewState.emitters.length > 0 ? (
          <Table
            size="small"
            columns={emitterColumns}
            dataSource={ewState.emitters.map((e, i) => ({ ...e, key: i }))}
            pagination={false}
            scroll={{ y: 200 }}
          />
        ) : (
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>无辐射源数据</Text>
          </div>
        )}
      </Card>
    </Space>
  );
}
