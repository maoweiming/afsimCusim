import { useMemo, useState } from 'react';
import {
  Card,
  Timeline,
  Descriptions,
  Tag,
  Button,
  Space,
  Select,
  Typography,
  Table,
  Modal,
  message,
  Empty,
  Tooltip,
  Popconfirm,
  Divider,
} from 'antd';
import {
  HistoryOutlined,
  RollbackOutlined,
  DiffOutlined,
  UserOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  FileTextOutlined,
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDataCenterStore } from '../store/dataCenterStore';
import type { DataItem, VersionRecord, VersionChange } from '../types';

const { Text, Title } = Typography;

// ============ 辅助函数 ============

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function typeToLabel(type: DataItem['type']): string {
  const map: Record<DataItem['type'], string> = {
    equipment: '装备',
    scenario: '想定',
    simulation: '仿真',
    replay: '回放',
  };
  return map[type];
}

function typeToColor(type: DataItem['type']): string {
  const map: Record<DataItem['type'], string> = {
    equipment: '#1890ff',
    scenario: '#52c41a',
    simulation: '#faad14',
    replay: '#722ed1',
  };
  return map[type];
}

// ============ 版本对比组件 ============

function VersionDiffView({
  changes,
  oldVersion,
  newVersion,
}: {
  changes: VersionChange[];
  oldVersion: string;
  newVersion: string;
}) {
  if (changes.length === 0) {
    return <Empty description="无变更记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <Tag color="red" style={{ flex: 1, textAlign: 'center', padding: '4px 0' }}>
          v{oldVersion} (旧)
        </Tag>
        <Tag color="green" style={{ flex: 1, textAlign: 'center', padding: '4px 0' }}>
          v{newVersion} (新)
        </Tag>
      </div>
      <Table
        size="small"
        dataSource={changes}
        rowKey="field"
        pagination={false}
        columns={[
          {
            title: '字段',
            dataIndex: 'field',
            key: 'field',
            width: 120,
            render: (f: string) => <Text code>{f}</Text>,
          },
          {
            title: '旧值',
            dataIndex: 'oldValue',
            key: 'oldValue',
            render: (v: string) => (
              <div
                style={{
                  background: '#2d1515',
                  padding: '2px 6px',
                  borderRadius: 3,
                  borderLeft: '3px solid #ff4d4f',
                }}
              >
                <Text delete type="secondary" style={{ fontSize: 12 }}>
                  {v}
                </Text>
              </div>
            ),
          },
          {
            title: '新值',
            dataIndex: 'newValue',
            key: 'newValue',
            render: (v: string) => (
              <div
                style={{
                  background: '#152d15',
                  padding: '2px 6px',
                  borderRadius: 3,
                  borderLeft: '3px solid #52c41a',
                }}
              >
                <Text style={{ fontSize: 12, color: '#52c41a' }}>{v}</Text>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

// ============ 主组件 ============

export default function DataVersion() {
  const dataItems = useDataCenterStore((s) => s.dataItems);
  const versions = useDataCenterStore((s) => s.versions);
  const getItemVersions = useDataCenterStore((s) => s.getItemVersions);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [diffModalVisible, setDiffModalVisible] = useState(false);
  const [diffVersions, setDiffVersions] = useState<[VersionRecord, VersionRecord] | null>(null);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<VersionRecord | null>(null);

  // 可选的数据条目（有版本记录的）
  const itemsWithVersions = useMemo(() => {
    const versionedIds = new Set(versions.map((v) => v.dataItemId));
    return dataItems.filter((item) => versionedIds.has(item.id));
  }, [dataItems, versions]);

  // 当前选中条目的版本列表
  const itemVersions = useMemo(() => {
    if (!selectedItemId) return [];
    return versions
      .filter((v) => v.dataItemId === selectedItemId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [versions, selectedItemId]);

  const selectedItem = useMemo(
    () => dataItems.find((i) => i.id === selectedItemId) ?? null,
    [dataItems, selectedItemId]
  );

  const handleCompare = (v1: VersionRecord, v2: VersionRecord) => {
    // Ensure v1 is older
    const [older, newer] =
      new Date(v1.createdAt).getTime() < new Date(v2.createdAt).getTime() ? [v1, v2] : [v2, v1];
    setDiffVersions([older, newer]);
    setDiffModalVisible(true);
  };

  const handleRollback = (version: VersionRecord) => {
    setRollbackTarget(version);
    setRollbackModalVisible(true);
  };

  const confirmRollback = () => {
    if (rollbackTarget) {
      message.success(`已回滚到 v${rollbackTarget.version}`);
      setRollbackModalVisible(false);
      setRollbackTarget(null);
    }
  };

  // 版本列表列定义
  const versionColumns: ColumnsType<VersionRecord> = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 90,
      render: (v: string, _record, idx) => (
        <Space>
          <Tag color={idx === 0 ? 'green' : 'default'}>v{v}</Tag>
          {idx === 0 && <Tag color="blue">最新</Tag>}
        </Space>
      ),
    },
    {
      title: '说明',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 80,
      render: (a: string) => (
        <Space size={4}>
          <UserOutlined style={{ color: 'var(--text-secondary)' }} />
          <Text>{a}</Text>
        </Space>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (t: string) => (
        <Space size={4}>
          <ClockCircleOutlined style={{ color: 'var(--text-secondary)' }} />
          <Text type="secondary">{formatTime(t)}</Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 80,
      render: (s: number) => <Text type="secondary">{formatBytes(s)}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: VersionRecord, idx: number) => (
        <Space size={4}>
          {idx < itemVersions.length - 1 && (
            <Tooltip title="与上一版本对比">
              <Button
                size="small"
                type="link"
                icon={<DiffOutlined />}
                onClick={() => handleCompare(record, itemVersions[idx + 1])}
              >
                对比
              </Button>
            </Tooltip>
          )}
          {idx > 0 && (
            <Popconfirm
              title="确认回滚"
              description={`回滚到 v${record.version}？当前版本将被覆盖。`}
              onConfirm={() => handleRollback(record)}
              okText="确认"
              cancelText="取消"
            >
              <Tooltip title="回滚到此版本">
                <Button size="small" type="link" icon={<RollbackOutlined />} danger>
                  回滚
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* 选择数据条目 */}
      <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
        <Space style={{ width: '100%' }}>
          <Text>选择数据条目：</Text>
          <Select
            style={{ width: 300 }}
            placeholder="选择要查看版本的数据"
            value={selectedItemId}
            onChange={setSelectedItemId}
            allowClear
            options={itemsWithVersions.map((item) => ({
              value: item.id,
              label: (
                <Space>
                  <Tag color={typeToColor(item.type)} style={{ marginRight: 0 }}>
                    {typeToLabel(item.type)}
                  </Tag>
                  {item.name}
                </Space>
              ),
            }))}
          />
          {selectedItem && (
            <Text type="secondary">
              当前版本：<Tag color="green">v{selectedItem.version}</Tag>
            </Text>
          )}
        </Space>
      </Card>

      {selectedItem ? (
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* 左侧：版本列表 */}
          <Card
            size="small"
            title={
              <Space>
                <HistoryOutlined />
                <span>版本历史</span>
                <Tag>{itemVersions.length} 个版本</Tag>
              </Space>
            }
            bordered={false}
            style={{ background: 'var(--bg-secondary)', flex: 1, overflow: 'auto' }}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              size="small"
              columns={versionColumns}
              dataSource={itemVersions}
              rowKey="id"
              pagination={false}
            />
          </Card>

          {/* 右侧：版本时间线 */}
          <Card
            size="small"
            title="版本演进时间线"
            bordered={false}
            style={{ background: 'var(--bg-secondary)', width: 320, overflow: 'auto' }}
          >
            <Timeline
              items={itemVersions.map((version, idx) => ({
                color: idx === 0 ? 'green' : 'blue',
                dot: idx === 0 ? (
                  <FileTextOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <HistoryOutlined />
                ),
                children: (
                  <div>
                    <Space size={4}>
                      <Tag color={idx === 0 ? 'green' : 'default'} style={{ marginRight: 0 }}>
                        v{version.version}
                      </Tag>
                      {idx === 0 && (
                        <Tag color="blue" style={{ marginRight: 0 }}>
                          最新
                        </Tag>
                      )}
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 12 }}>{version.message}</Text>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {version.author} · {formatTime(version.createdAt)}
                      </Text>
                    </div>
                    {version.changes.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {version.changes.map((change, ci) => (
                          <div key={ci} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            <EditOutlined style={{ marginRight: 4, fontSize: 10 }} />
                            {change.field}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>
        </div>
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
        >
          <Empty description="请先选择一个数据条目查看版本历史" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      )}

      {/* 版本对比弹窗 */}
      <Modal
        title={
          diffVersions
            ? `版本对比：v${diffVersions[0].version} → v${diffVersions[1].version}`
            : '版本对比'
        }
        open={diffModalVisible}
        onCancel={() => {
          setDiffModalVisible(false);
          setDiffVersions(null);
        }}
        footer={null}
        width={700}
      >
        {diffVersions && (
          <VersionDiffView
            changes={diffVersions[1].changes}
            oldVersion={diffVersions[0].version}
            newVersion={diffVersions[1].version}
          />
        )}
      </Modal>

      {/* 回滚确认弹窗 */}
      <Modal
        title="确认回滚"
        open={rollbackModalVisible}
        onOk={confirmRollback}
        onCancel={() => {
          setRollbackModalVisible(false);
          setRollbackTarget(null);
        }}
        okText="确认回滚"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        {rollbackTarget && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div
              style={{
                background: '#2d1515',
                border: '1px solid #ff4d4f33',
                borderRadius: 6,
                padding: 12,
              }}
            >
              <Space>
                <RollbackOutlined style={{ color: '#ff4d4f' }} />
                <Text>
                  回滚到 <Text strong>v{rollbackTarget.version}</Text>
                </Text>
              </Space>
            </div>
            <Descriptions column={1} size="small" labelStyle={{ color: 'var(--text-secondary)' }}>
              <Descriptions.Item label="目标版本">v{rollbackTarget.version}</Descriptions.Item>
              <Descriptions.Item label="版本说明">{rollbackTarget.message}</Descriptions.Item>
              <Descriptions.Item label="作者">{rollbackTarget.author}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatTime(rollbackTarget.createdAt)}
              </Descriptions.Item>
            </Descriptions>
            <Text type="warning">
              回滚操作将覆盖当前版本数据，此操作不可撤销。建议先备份当前版本。
            </Text>
          </Space>
        )}
      </Modal>
    </div>
  );
}
