// ============================================================
// Equipment Module - Version History Component
// 装备版本历史：时间线展示 + 版本对比 + 回滚
// ============================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Timeline,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Descriptions,
  Select,
  Spin,
  Popconfirm,
  Empty,
  Divider,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HistoryOutlined,
  RollbackOutlined,
  SwapOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useEquipmentStore } from '../store/equipmentStore';
import type { VersionRecord, VersionDiff } from '../api/equipmentApi';

const { Text, Title, Paragraph } = Typography;

// ============ Diff value renderer ============

function DiffValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <Text type="secondary">null</Text>;
  }
  if (typeof value === 'object') {
    return (
      <Text code style={{ fontSize: 12 }}>
        {JSON.stringify(value)}
      </Text>
    );
  }
  return <Text>{String(value)}</Text>;
}

// ============ Component ============

interface EquipmentVersionHistoryProps {
  open: boolean;
  equipmentId: string;
  equipmentName?: string;
  onClose: () => void;
}

export function EquipmentVersionHistory({
  open,
  equipmentId,
  equipmentName,
  onClose,
}: EquipmentVersionHistoryProps) {
  // ---- Store ----
  const versionHistory = useEquipmentStore((s) => s.versionHistory);
  const versionLoading = useEquipmentStore((s) => s.versionLoading);
  const saving = useEquipmentStore((s) => s.saving);
  const fetchVersionHistory = useEquipmentStore((s) => s.fetchVersionHistory);
  const compareVersions = useEquipmentStore((s) => s.compareVersions);
  const rollbackVersion = useEquipmentStore((s) => s.rollbackVersion);

  // ---- Local state ----
  const [selectedV1, setSelectedV1] = useState<number | null>(null);
  const [selectedV2, setSelectedV2] = useState<number | null>(null);
  const [diffs, setDiffs] = useState<VersionDiff[]>([]);
  const [comparing, setComparing] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'compare'>('timeline');

  // ---- Load version history ----
  useEffect(() => {
    if (open && equipmentId) {
      fetchVersionHistory(equipmentId);
      setSelectedV1(null);
      setSelectedV2(null);
      setDiffs([]);
      setActiveTab('timeline');
    }
  }, [open, equipmentId, fetchVersionHistory]);

  // ---- Compare versions ----
  const handleCompare = useCallback(async () => {
    if (selectedV1 === null || selectedV2 === null) {
      message.warning('请选择两个要对比的版本');
      return;
    }
    if (selectedV1 === selectedV2) {
      message.warning('请选择不同的版本进行对比');
      return;
    }
    setComparing(true);
    try {
      const result = await compareVersions(equipmentId, selectedV1, selectedV2);
      setDiffs(result);
      setActiveTab('compare');
    } catch {
      message.error('版本对比失败');
    } finally {
      setComparing(false);
    }
  }, [selectedV1, selectedV2, equipmentId, compareVersions]);

  // ---- Rollback ----
  const handleRollback = useCallback(
    async (version: number) => {
      try {
        await rollbackVersion(equipmentId, version);
        message.success(`已回滚到版本 v${version}`);
        // Refresh history after rollback
        fetchVersionHistory(equipmentId);
      } catch {
        message.error('回滚失败');
      }
    },
    [equipmentId, rollbackVersion, fetchVersionHistory],
  );

  // ---- Close ----
  const handleClose = useCallback(() => {
    setSelectedV1(null);
    setSelectedV2(null);
    setDiffs([]);
    setActiveTab('timeline');
    onClose();
  }, [onClose]);

  // ---- Version options for selects ----
  const versionOptions = useMemo(
    () =>
      versionHistory.map((v) => ({
        value: v.version,
        label: `v${v.version} — ${v.author}`,
      })),
    [versionHistory],
  );

  // ---- Diff table columns ----
  const diffColumns = useMemo<ColumnsType<VersionDiff>>(
    () => [
      {
        title: '字段',
        dataIndex: 'label',
        key: 'label',
        width: 160,
        render: (label: string, record) => (
          <Space direction="vertical" size={0}>
            <Text style={{ color: '#e6edf3' }}>{label}</Text>
            <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
              {record.field}
            </Text>
          </Space>
        ),
      },
      {
        title: `v${selectedV1 ?? '?'} (旧)`,
        dataIndex: 'oldValue',
        key: 'oldValue',
        width: 200,
        render: (value: unknown) => (
          <div
            style={{
              background: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid rgba(248, 81, 73, 0.3)',
              borderRadius: 4,
              padding: '4px 8px',
              wordBreak: 'break-all',
            }}
          >
            <DiffValue value={value} />
          </div>
        ),
      },
      {
        title: '',
        key: 'arrow',
        width: 30,
        align: 'center',
        render: () => <ArrowRightOutlined style={{ color: '#8b949e' }} />,
      },
      {
        title: `v${selectedV2 ?? '?'} (新)`,
        dataIndex: 'newValue',
        key: 'newValue',
        width: 200,
        render: (value: unknown) => (
          <div
            style={{
              background: 'rgba(63, 185, 80, 0.1)',
              border: '1px solid rgba(63, 185, 80, 0.3)',
              borderRadius: 4,
              padding: '4px 8px',
              wordBreak: 'break-all',
            }}
          >
            <DiffValue value={value} />
          </div>
        ),
      },
    ],
    [selectedV1, selectedV2],
  );

  // ---- Timeline color based on index ----
  const getTimelineColor = (index: number, total: number) => {
    if (index === 0) return 'green'; // latest
    if (index === total - 1) return 'gray'; // oldest
    return 'blue';
  };

  return (
    <Modal
      title={
        <Space>
          <HistoryOutlined />
          <span>版本历史 — {equipmentName ?? equipmentId}</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={820}
      destroyOnClose
      styles={{
        body: { padding: '16px 24px', maxHeight: '70vh', overflow: 'auto' },
        header: { background: '#161b22', borderBottom: '1px solid #30363d' },
        root: { background: '#0d1117', border: '1px solid #30363d' },
      }}
      footer={
        <Space>
          <Button onClick={handleClose}>关闭</Button>
        </Space>
      }
    >
      {/* ---- Tab navigation ---- */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          padding: '0 0 12px',
          borderBottom: '1px solid #30363d',
        }}
      >
        <Button
          type={activeTab === 'timeline' ? 'primary' : 'default'}
          icon={<ClockCircleOutlined />}
          size="small"
          onClick={() => setActiveTab('timeline')}
        >
          版本时间线
        </Button>
        <Button
          type={activeTab === 'compare' ? 'primary' : 'default'}
          icon={<SwapOutlined />}
          size="small"
          onClick={() => setActiveTab('compare')}
        >
          版本对比
        </Button>
      </div>

      {/* ---- Loading ---- */}
      {versionLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Spin tip="加载版本历史..." />
        </div>
      )}

      {/* ---- Tab: Timeline ---- */}
      {activeTab === 'timeline' && !versionLoading && (
        <>
          {versionHistory.length === 0 ? (
            <Empty description="暂无版本历史" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Timeline
              mode="left"
              items={versionHistory.map((record, index) => ({
                color: getTimelineColor(index, versionHistory.length),
                label: (
                  <div style={{ minWidth: 140 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(record.createdAt).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                ),
                children: (
                  <div
                    style={{
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: 6,
                      padding: '10px 14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 4,
                      }}
                    >
                      <Space size="small">
                        <Tag color={index === 0 ? 'green' : 'default'}>
                          v{record.version}
                        </Tag>
                        {index === 0 && <Tag color="green">当前版本</Tag>}
                      </Space>
                      {index > 0 && (
                        <Popconfirm
                          title={`确认回滚到 v${record.version}?`}
                          description="回滚将覆盖当前版本数据"
                          onConfirm={() => handleRollback(record.version)}
                          okText="确认回滚"
                          cancelText="取消"
                        >
                          <Button
                            type="link"
                            size="small"
                            icon={<RollbackOutlined />}
                            loading={saving}
                            style={{ padding: 0 }}
                          >
                            回滚
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                    <Paragraph
                      style={{ color: '#e6edf3', marginBottom: 4, fontSize: 13 }}
                    >
                      {record.message}
                    </Paragraph>
                    <Space size="small">
                      <UserOutlined style={{ color: '#8b949e' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.author}
                      </Text>
                      {record.changes > 0 && (
                        <>
                          <Text type="secondary" style={{ fontSize: 12 }}>·</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.changes} 项变更
                          </Text>
                        </>
                      )}
                    </Space>
                  </div>
                ),
              }))}
            />
          )}
        </>
      )}

      {/* ---- Tab: Compare ---- */}
      {activeTab === 'compare' && !versionLoading && (
        <>
          {/* Version selectors */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <Text style={{ color: '#e6edf3' }}>对比版本：</Text>
            <Select
              placeholder="旧版本"
              value={selectedV1}
              onChange={setSelectedV1}
              options={versionOptions}
              style={{ width: 200 }}
              size="small"
            />
            <ArrowRightOutlined style={{ color: '#8b949e' }} />
            <Select
              placeholder="新版本"
              value={selectedV2}
              onChange={setSelectedV2}
              options={versionOptions}
              style={{ width: 200 }}
              size="small"
            />
            <Button
              type="primary"
              icon={<SwapOutlined />}
              size="small"
              loading={comparing}
              onClick={handleCompare}
              disabled={selectedV1 === null || selectedV2 === null}
            >
              对比
            </Button>
          </div>

          {/* Diff results */}
          {diffs.length > 0 ? (
            <>
              <Divider titlePlacement="left" style={{ borderColor: '#30363d', margin: '12px 0' }}>
                <Text style={{ color: '#e6edf3' }}>
                  差异字段: {diffs.length} 项
                </Text>
              </Divider>
              <Table<VersionDiff>
                columns={diffColumns}
                dataSource={diffs}
                rowKey="field"
                size="small"
                pagination={false}
                scroll={{ y: 360 }}
              />
            </>
          ) : (
            !comparing &&
            selectedV1 !== null &&
            selectedV2 !== null && (
              <Empty
                description="两个版本之间没有差异"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '40px 0' }}
              />
            )
          )}

          {/* Quick rollback from compare view */}
          {selectedV1 !== null && selectedV2 !== null && diffs.length > 0 && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 16px',
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text type="secondary" style={{ fontSize: 13 }}>
                需要回滚到某个版本？
              </Text>
              <Space>
                <Popconfirm
                  title={`确认回滚到 v${selectedV1}?`}
                  description="回滚将覆盖当前版本数据"
                  onConfirm={() => handleRollback(selectedV1)}
                  okText="确认回滚"
                  cancelText="取消"
                >
                  <Button
                    size="small"
                    icon={<RollbackOutlined />}
                    loading={saving}
                  >
                    回滚到 v{selectedV1}
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title={`确认回滚到 v${selectedV2}?`}
                  description="回滚将覆盖当前版本数据"
                  onConfirm={() => handleRollback(selectedV2)}
                  okText="确认回滚"
                  cancelText="取消"
                >
                  <Button
                    size="small"
                    icon={<RollbackOutlined />}
                    loading={saving}
                  >
                    回滚到 v{selectedV2}
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
