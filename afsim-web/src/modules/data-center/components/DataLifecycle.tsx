import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Steps,
  Timeline,
  Table,
  Tag,
  Button,
  Space,
  Select,
  Typography,
  Modal,
  Input,
  message,
  Popconfirm,
  Tooltip,
  Descriptions,
  Empty,
  Alert,
} from 'antd';
import {
  EditOutlined,
  AuditOutlined,
  SendOutlined,
  PlayCircleOutlined,
  InboxOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDataCenterStore } from '../store/dataCenterStore';
import type { DataItem, LifecycleEvent } from '../types';

const { Text, Title } = Typography;
const { TextArea } = Input;

// ============ 辅助函数 ============

function statusToLabel(status: DataItem['status']): string {
  const map: Record<DataItem['status'], string> = {
    draft: '草稿',
    review: '审核中',
    published: '已发布',
    archived: '已归档',
  };
  return map[status];
}

function statusToStepIndex(status: DataItem['status']): number {
  const map: Record<DataItem['status'], number> = {
    draft: 0,
    review: 1,
    published: 2,
    archived: 3,
  };
  return map[status];
}

function statusToTag(status: DataItem['status']) {
  const map: Record<DataItem['status'], { color: string; label: string }> = {
    draft: { color: 'default', label: '草稿' },
    review: { color: 'processing', label: '审核中' },
    published: { color: 'success', label: '已发布' },
    archived: { color: 'warning', label: '已归档' },
  };
  const { color, label } = map[status];
  return <Tag color={color}>{label}</Tag>;
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

function timelineColor(toStatus: DataItem['status']): string {
  const map: Record<DataItem['status'], string> = {
    draft: '#888',
    review: '#1890ff',
    published: '#52c41a',
    archived: '#faad14',
  };
  return map[toStatus];
}

function timelineIcon(toStatus: DataItem['status']) {
  const map: Record<DataItem['status'], React.ReactNode> = {
    draft: <EditOutlined />,
    review: <AuditOutlined />,
    published: <CheckCircleOutlined />,
    archived: <InboxOutlined />,
  };
  return map[toStatus];
}

// ============ 生命周期步骤组件 ============

function LifecycleSteps({ currentStatus }: { currentStatus: DataItem['status'] }) {
  const current = statusToStepIndex(currentStatus);

  const items = [
    {
      title: '创建',
      icon: <EditOutlined />,
      description: '数据草稿创建',
    },
    {
      title: '编辑',
      icon: <EditOutlined />,
      description: '内容编辑完善',
    },
    {
      title: '审核',
      icon: <AuditOutlined />,
      description: '提交审核流程',
    },
    {
      title: '发布',
      icon: <SendOutlined />,
      description: '正式发布使用',
    },
    {
      title: '使用',
      icon: <PlayCircleOutlined />,
      description: '投入仿真使用',
    },
    {
      title: '归档',
      icon: <InboxOutlined />,
      description: '历史归档保存',
    },
  ];

  // Map status to step index (draft=0, review=2, published=3, archived=5)
  const stepIndex = currentStatus === 'draft' ? 0
    : currentStatus === 'review' ? 2
    : currentStatus === 'published' ? 3
    : 5;

  return (
    <Steps
      current={stepIndex}
      size="small"
      items={items.map((item, idx) => ({
        ...item,
        status: idx < stepIndex ? 'finish' : idx === stepIndex ? 'process' : 'wait',
      }))}
    />
  );
}

// ============ 主组件 ============

export default function DataLifecycle() {
  const dataItems = useDataCenterStore((s) => s.dataItems);
  const lifecycleEvents = useDataCenterStore((s) => s.lifecycleEvents);
  const batchPublish = useDataCenterStore((s) => s.batchPublish);
  const batchArchive = useDataCenterStore((s) => s.batchArchive);
  const batchDelete = useDataCenterStore((s) => s.batchDelete);
  const selectedItems = useDataCenterStore((s) => s.selectedItems);
  const toggleItemSelection = useDataCenterStore((s) => s.toggleItemSelection);
  const selectAllItems = useDataCenterStore((s) => s.selectAllItems);
  const clearSelection = useDataCenterStore((s) => s.clearSelection);

  // 数据加载（对接 data-platform）
  const loading = useDataCenterStore((s) => s.loading);
  const loadError = useDataCenterStore((s) => s.loadError);
  const loadItems = useDataCenterStore((s) => s.loadItems);

  // 过滤条件（client 端，基于已加载数据）
  const typeFilter = useDataCenterStore((s) => s.typeFilter);
  const statusFilter = useDataCenterStore((s) => s.statusFilter);
  const searchQuery = useDataCenterStore((s) => s.searchQuery);
  const setTypeFilter = useDataCenterStore((s) => s.setTypeFilter);
  const setStatusFilter = useDataCenterStore((s) => s.setStatusFilter);
  const setSearchQuery = useDataCenterStore((s) => s.setSearchQuery);
  const getFilteredItems = useDataCenterStore((s) => s.getFilteredItems);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // 过滤后的列表数据；依赖过滤条件与原始数据变化触发重算
  const filteredItems = useMemo(
    () => getFilteredItems(),
    [getFilteredItems, dataItems, typeFilter, statusFilter, searchQuery]
  );

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'publish' | 'archive' | null>(null);
  const [comment, setComment] = useState('');

  const selectedItem = useMemo(
    () => dataItems.find((i) => i.id === selectedItemId) ?? null,
    [dataItems, selectedItemId]
  );

  const itemLifecycleEvents = useMemo(
    () => lifecycleEvents.filter((e) => e.dataItemId === selectedItemId),
    [lifecycleEvents, selectedItemId]
  );

  const handleBatchAction = (action: 'publish' | 'archive') => {
    if (selectedItems.length === 0) {
      message.warning('请先选择数据条目');
      return;
    }
    setPendingAction(action);
    setCommentModalVisible(true);
  };

  const handleConfirmAction = () => {
    if (pendingAction === 'publish') {
      batchPublish();
      message.success(`已发布 ${selectedItems.length} 条数据`);
    } else if (pendingAction === 'archive') {
      batchArchive();
      message.success(`已归档 ${selectedItems.length} 条数据`);
    }
    setCommentModalVisible(false);
    setComment('');
    setPendingAction(null);
  };

  const handleBatchDelete = () => {
    batchDelete();
    message.success('已删除选中数据');
  };

  // 数据列表列定义
  const columns: ColumnsType<DataItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, color: selectedItemId === record.id ? '#4da0e8' : '#e0e0e0' }}
          onClick={() => setSelectedItemId(record.id)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: DataItem['type']) => (
        <Tag color={typeToColor(type)}>{typeToLabel(type)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: statusToTag,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: string) => <Tag>v{v}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (t: string) => formatTime(t),
    },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {loadError && (
        <Alert
          type="warning"
          showIcon
          message={`数据平台加载失败，已回退到本地数据：${loadError}`}
          closable
        />
      )}

      {/* 过滤工具栏 */}
      <Card size="small" bordered={false} style={{ background: '#111820' }}>
        <Space wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>类型</Text>
          <Select
            size="small"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'equipment', label: '装备' },
              { value: 'scenario', label: '想定' },
              { value: 'simulation', label: '仿真' },
              { value: 'replay', label: '回放' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
          <Select
            size="small"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'draft', label: '草稿' },
              { value: 'review', label: '审核中' },
              { value: 'published', label: '已发布' },
              { value: 'archived', label: '已归档' },
            ]}
          />
          <Input
            size="small"
            allowClear
            placeholder="搜索名称 / 标签"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {filteredItems.length} 条
          </Text>
        </Space>
      </Card>

      {/* 批量操作栏 */}
      <Card size="small" bordered={false} style={{ background: '#111820' }}>
        <Space>
          <Button
            size="small"
            onClick={selectAllItems}
            disabled={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
          >
            全选
          </Button>
          <Button size="small" onClick={clearSelection} disabled={selectedItems.length === 0}>
            取消选择
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            已选 {selectedItems.length} 项
          </Text>
          <div style={{ flex: 1 }} />
          <Tooltip title="批量发布选中数据">
            <Button
              size="small"
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleBatchAction('publish')}
              disabled={selectedItems.length === 0}
            >
              批量发布
            </Button>
          </Tooltip>
          <Tooltip title="批量归档选中数据">
            <Button
              size="small"
              icon={<InboxOutlined />}
              onClick={() => handleBatchAction('archive')}
              disabled={selectedItems.length === 0}
            >
              批量归档
            </Button>
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除选中的 ${selectedItems.length} 条数据吗？`}
            onConfirm={handleBatchDelete}
            okText="确认"
            cancelText="取消"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={selectedItems.length === 0}
            >
              批量删除
            </Button>
          </Popconfirm>
        </Space>
      </Card>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* 左侧：数据列表 */}
        <Card
          size="small"
          title="数据列表"
          bordered={false}
          style={{ background: '#111820', flex: 1, overflow: 'auto' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table
            size="small"
            loading={loading}
            columns={columns}
            dataSource={filteredItems}
            rowKey="id"
            pagination={{ pageSize: 10, size: 'small' }}
            rowSelection={{
              selectedRowKeys: selectedItems,
              onChange: (keys) => {
                clearSelection();
                keys.forEach((k) => toggleItemSelection(k as string));
              },
            }}
            onRow={(record) => ({
              onClick: () => setSelectedItemId(record.id),
              style: {
                cursor: 'pointer',
                background: selectedItemId === record.id ? '#1e2a3a' : undefined,
              },
            })}
          />
        </Card>

        {/* 右侧：生命周期详情 */}
        <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedItem ? (
            <>
              {/* 当前状态步骤 */}
              <Card
                size="small"
                title="生命周期阶段"
                bordered={false}
                style={{ background: '#111820' }}
              >
                <LifecycleSteps currentStatus={selectedItem.status} />
              </Card>

              {/* 条目详情 */}
              <Card
                size="small"
                title="条目详情"
                bordered={false}
                style={{ background: '#111820' }}
              >
                <Descriptions column={1} size="small" labelStyle={{ color: '#8899aa' }}>
                  <Descriptions.Item label="名称">{selectedItem.name}</Descriptions.Item>
                  <Descriptions.Item label="类型">
                    <Tag color={typeToColor(selectedItem.type)}>
                      {typeToLabel(selectedItem.type)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="版本">v{selectedItem.version}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    {statusToTag(selectedItem.status)}
                  </Descriptions.Item>
                  <Descriptions.Item label="创建者">{selectedItem.createdBy}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {formatTime(selectedItem.createdAt)}
                  </Descriptions.Item>
                  <Descriptions.Item label="更新时间">
                    {formatTime(selectedItem.updatedAt)}
                  </Descriptions.Item>
                  <Descriptions.Item label="标签">
                    {selectedItem.tags.map((tag) => (
                      <Tag key={tag} style={{ marginBottom: 2 }}>
                        {tag}
                      </Tag>
                    ))}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 状态流转历史 */}
              <Card
                size="small"
                title="状态流转历史"
                bordered={false}
                style={{ background: '#111820', flex: 1, overflow: 'auto' }}
              >
                {itemLifecycleEvents.length > 0 ? (
                  <Timeline
                    items={itemLifecycleEvents.map((event) => ({
                      color: timelineColor(event.toStatus),
                      dot: timelineIcon(event.toStatus),
                      children: (
                        <div>
                          <Text style={{ fontSize: 12 }}>
                            <Text strong>{event.operatorName}</Text>{' '}
                            <Text type="secondary">
                              {event.fromStatus
                                ? `${statusToLabel(event.fromStatus)} → ${statusToLabel(event.toStatus)}`
                                : `创建 → ${statusToLabel(event.toStatus)}`}
                            </Text>
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {event.comment}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {formatTime(event.timestamp)}
                          </Text>
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Empty description="暂无流转记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </>
          ) : (
            <Card
              size="small"
              bordered={false}
              style={{
                background: '#111820',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Empty description="请从左侧选择数据条目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          )}
        </div>
      </div>

      {/* 操作确认弹窗 */}
      <Modal
        title={pendingAction === 'publish' ? '确认批量发布' : '确认批量归档'}
        open={commentModalVisible}
        onOk={handleConfirmAction}
        onCancel={() => {
          setCommentModalVisible(false);
          setComment('');
          setPendingAction(null);
        }}
        okText="确认"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Text>
            即将{pendingAction === 'publish' ? '发布' : '归档'}{' '}
            <Text strong>{selectedItems.length}</Text> 条数据。
          </Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              操作备注（可选）：
            </Text>
            <TextArea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入操作备注..."
              style={{ marginTop: 4 }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
