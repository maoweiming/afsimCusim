/**
 * 想定列表组件
 * 支持卡片/列表视图、状态筛选、标签筛选
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Avatar,
  Tooltip,
  Modal,
  Form,
  message,
  Spin,
  Empty,
  Popconfirm,
  Segmented,
  Tabs,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  TeamOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  InboxOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useScenarioListStore } from '../store/scenarioStore';
import type { Scenario, ScenarioStatus } from '../types';
import { SCENARIO_TEMPLATE_OPTIONS } from '../data/scenarioTemplates';

const { TextArea } = Input;

// ============ 状态颜色映射 ============

const STATUS_CONFIG: Record<
  ScenarioStatus,
  { label: string; color: string }
> = {
  draft: { label: '草稿', color: 'default' },
  in_review: { label: '审核中', color: 'processing' },
  approved: { label: '已批准', color: 'success' },
  archived: { label: '已归档', color: 'warning' },
};

const SIDE_COLORS: Record<string, string> = {
  blue: '#0078d7',
  red: '#d72828',
  neutral: '#8899aa',
  green: '#28b43c',
};

interface ScenarioListProps {
  onSelectScenario?: (id: string) => void;
  onEditScenario?: (id: string) => void;
}

export const ScenarioList: React.FC<ScenarioListProps> = ({
  onSelectScenario,
  onEditScenario,
}) => {
  const {
    scenarios,
    loading,
    error,
    viewMode,
    statusFilter,
    searchText,
    fetchScenarios,
    createScenario,
    deleteScenario,
    updateScenarioStatus,
    setViewMode,
    setStatusFilter,
    setSearchText,
    getFilteredScenarios,
  } = useScenarioListStore();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const templateId = Form.useWatch('templateId', createForm);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const handleCreate = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      const tags = values.tags
        ? values.tags.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean)
        : [];
      const scenario = await createScenario({
        name: values.name,
        description: values.description || '',
        tags,
        classification: values.classification || '内部',
        templateId: values.templateId,
      });
      message.success('想定创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      onEditScenario?.(scenario.id);
    } catch {
      // validation error
    }
  }, [createForm, createScenario, onEditScenario]);

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await deleteScenario(id);
      if (ok) message.success('想定已删除');
      else message.error('删除失败');
    },
    [deleteScenario]
  );

  const filteredScenarios = getFilteredScenarios();

  // 各状态数量（用于 Tab 徽标）
  const statusCounts = {
    all: scenarios.length,
    draft: scenarios.filter((s) => s.status === 'draft').length,
    in_review: scenarios.filter((s) => s.status === 'in_review').length,
    approved: scenarios.filter((s) => s.status === 'approved').length,
    archived: scenarios.filter((s) => s.status === 'archived').length,
  };

  // 状态流转操作
  const handleStatusTransition = useCallback(
    async (id: string, targetStatus: ScenarioStatus, label: string) => {
      const ok = await updateScenarioStatus(id, targetStatus);
      if (ok) message.success(`想定已${label}`);
      else message.error('状态变更失败');
    },
    [updateScenarioStatus]
  );

  // 收集所有标签
  const allTags = Array.from(
    new Set(scenarios.flatMap((s) => s.tags))
  );

  // ============ 卡片视图 ============

  const renderCardView = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16,
        padding: '0 4px',
      }}
    >
      {filteredScenarios.map((scenario) => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          onSelect={onSelectScenario}
          onEdit={onEditScenario}
          onDelete={handleDelete}
          onStatusTransition={handleStatusTransition}
        />
      ))}
      {filteredScenarios.length === 0 && !loading && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Empty description="暂无想定数据" />
        </div>
      )}
    </div>
  );

  // ============ 表格列定义 ============

  const columns: ColumnsType<Scenario> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: 250,
      render: (name: string, record) => (
        <a onClick={() => onEditScenario?.(record.id)} style={{ color: '#0078d7' }}>
          {name}
        </a>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: string) => (
        <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: ScenarioStatus) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '密级',
      dataIndex: 'classification',
      key: 'classification',
      width: 70,
      render: (cls: string) => (
        <Tag
          color={
            cls === '绝密' ? 'red' : cls === '机密' ? 'orange' : cls === '秘密' ? 'gold' : 'default'
          }
          style={{ fontSize: 11 }}
        >
          {cls}
        </Tag>
      ),
    },
    {
      title: '平台数',
      key: 'platformCount',
      width: 70,
      align: 'center',
      render: (_, record) => record.platforms.length,
    },
    {
      title: '协作者',
      key: 'collaborators',
      width: 120,
      render: (_, record) => (
        <Avatar.Group maxCount={4} size="small">
          {record.collaborators.map((c) => (
            <Tooltip key={c.userId} title={`${c.userName} (${c.role})`}>
              <Avatar
                size="small"
                style={{
                  backgroundColor: c.color,
                  fontSize: 10,
                  border: c.online ? '2px solid #28b43c' : '2px solid transparent',
                }}
              >
                {c.userName.charAt(0)}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 100,
      render: (t: string) => new Date(t).toLocaleDateString('zh-CN'),
    },
    {
      title: '流转',
      key: 'transition',
      width: 160,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.status === 'draft' && (
            <Tooltip title="提交进入审核流程">
              <Button
                size="small"
                type="default"
                icon={<SendOutlined />}
                onClick={() => handleStatusTransition(record.id, 'in_review', '提交审核')}
              >
                提交审核
              </Button>
            </Tooltip>
          )}
          {record.status === 'in_review' && (
            <>
              <Tooltip title="审核通过，发布为已批准状态">
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  style={{ background: '#28b43c', borderColor: '#28b43c' }}
                  onClick={() => handleStatusTransition(record.id, 'approved', '批准')}
                >
                  批准
                </Button>
              </Tooltip>
              <Tooltip title="退回修改，状态重置为草稿">
                <Button
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => handleStatusTransition(record.id, 'draft', '退回草稿')}
                >
                  退回
                </Button>
              </Tooltip>
            </>
          )}
          {record.status === 'approved' && (
            <Tooltip title="归档，停止编辑">
              <Button
                size="small"
                icon={<InboxOutlined />}
                onClick={() => handleStatusTransition(record.id, 'archived', '归档')}
              >
                归档
              </Button>
            </Tooltip>
          )}
          {record.status === 'archived' && (
            <Tooltip title="重启为草稿继续编辑">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleStatusTransition(record.id, 'draft', '重启')}
              >
                重启
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={record.status === 'archived' ? '已归档，仅可查看' : '编辑'}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              disabled={record.status === 'archived'}
              onClick={() => onEditScenario?.(record.id)}
            />
          </Tooltip>
          <Tooltip title="查看">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onSelectScenario?.(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`删除想定「${record.name}」？`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============ 主渲染 ============

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #2a3a4a',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>
            想定管理
          </span>
          <Input
            placeholder="搜索想定..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ maxWidth: 240 }}
            allowClear
            size="small"
          />
          <Select
            placeholder="标签筛选"
            style={{ width: 120 }}
            size="small"
            allowClear
            onChange={(val) => useScenarioListStore.getState().setTagFilter(val || '')}
            options={allTags.map((t) => ({ value: t, label: t }))}
          />
        </div>

        <Space>
          <Segmented
            size="small"
            value={viewMode}
            onChange={(val) => setViewMode(val as 'card' | 'table')}
            options={[
              { value: 'card', icon: <AppstoreOutlined /> },
              { value: 'table', icon: <UnorderedListOutlined /> },
            ]}
          />
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建想定
          </Button>
        </Space>
      </div>

      {/* 状态 Tab 筛选栏 */}
      <div style={{ padding: '0 16px', borderBottom: '1px solid #2a3a4a' }}>
        <Tabs
          size="small"
          activeKey={statusFilter}
          onChange={(key) => setStatusFilter(key as ScenarioStatus | 'all')}
          tabBarStyle={{ marginBottom: 0 }}
          items={[
            {
              key: 'all',
              label: (
                <span>
                  全部&nbsp;
                  <Badge count={statusCounts.all} size="small" style={{ backgroundColor: '#4a5a6a' }} />
                </span>
              ),
            },
            {
              key: 'draft',
              label: (
                <span>
                  草稿&nbsp;
                  <Badge count={statusCounts.draft} size="small" style={{ backgroundColor: '#4a5a6a' }} />
                </span>
              ),
            },
            {
              key: 'in_review',
              label: (
                <span>
                  审核中&nbsp;
                  <Badge count={statusCounts.in_review} size="small" style={{ backgroundColor: '#0078d7' }} />
                </span>
              ),
            },
            {
              key: 'approved',
              label: (
                <span>
                  已批准&nbsp;
                  <Badge count={statusCounts.approved} size="small" style={{ backgroundColor: '#28b43c' }} />
                </span>
              ),
            },
            {
              key: 'archived',
              label: (
                <span>
                  已归档&nbsp;
                  <Badge count={statusCounts.archived} size="small" style={{ backgroundColor: '#c8963c' }} />
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <Spin spinning={loading}>
          {viewMode === 'card' ? (
            renderCardView()
          ) : (
            <Table<Scenario>
              dataSource={filteredScenarios}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: <Empty description="暂无想定数据" /> }}
              onRow={(record) => ({
                onDoubleClick: () => onEditScenario?.(record.id),
                style: { cursor: 'pointer' },
              })}
            />
          )}
        </Spin>

        {error && (
          <div style={{ color: '#d72828', padding: '8px 0', fontSize: 12 }}>
            错误: {error}
          </div>
        )}
      </div>

      {/* 新建想定弹窗 */}
      <Modal
        title="新建想定"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="想定名称"
            rules={[{ required: true, message: '请输入想定名称' }]}
          >
            <Input placeholder="例：台海防御作战想定" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="输入想定描述..." />
          </Form.Item>
          <Form.Item name="classification" label="密级" initialValue="内部">
            <Select
              options={[
                { value: '公开', label: '公开' },
                { value: '内部', label: '内部' },
                { value: '秘密', label: '秘密' },
                { value: '机密', label: '机密' },
                { value: '绝密', label: '绝密' },
              ]}
            />
          </Form.Item>
          <Form.Item name="tags" label="标签" extra="多个标签用逗号分隔">
            <Input placeholder="例：台海, 防空, 海空联合" />
          </Form.Item>
          <Form.Item
            name="templateId"
            label="想定模板"
            initialValue="blank"
            extra={
              SCENARIO_TEMPLATE_OPTIONS.find((t) => t.id === templateId)?.description
            }
          >
            <Select
              options={SCENARIO_TEMPLATE_OPTIONS.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============ 想定卡片子组件 ============

interface ScenarioCardProps {
  scenario: Scenario;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onStatusTransition?: (id: string, status: ScenarioStatus, label: string) => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  onSelect,
  onEdit,
  onDelete,
  onStatusTransition,
}) => {
  const statusConfig = STATUS_CONFIG[scenario.status];
  const onlineCount = scenario.collaborators.filter((c) => c.online).length;

  return (
    <Card
      hoverable
      size="small"
      style={{
        background: '#111820',
        border: '1px solid #2a3a4a',
        borderRadius: 6,
      }}
      styles={{
        body: { padding: '12px 16px' },
      }}
      actions={[
        <Tooltip key="edit" title={scenario.status === 'archived' ? '已归档，仅可查看' : '编辑'}>
          <EditOutlined
            style={{ opacity: scenario.status === 'archived' ? 0.35 : 1 }}
            onClick={() => scenario.status !== 'archived' && onEdit?.(scenario.id)}
          />
        </Tooltip>,
        <Tooltip key="view" title="查看">
          <EyeOutlined onClick={() => onSelect?.(scenario.id)} />
        </Tooltip>,
        <Popconfirm
          key="delete"
          title="确认删除"
          description={`删除想定「${scenario.name}」？`}
          onConfirm={() => onDelete?.(scenario.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Tooltip title="删除">
            <DeleteOutlined style={{ color: '#d72828' }} />
          </Tooltip>
        </Popconfirm>,
      ]}
    >
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#e0e0e0',
              cursor: 'pointer',
            }}
            onClick={() => onEdit?.(scenario.id)}
          >
            {scenario.name}
          </span>
          <Tag color={statusConfig.color} style={{ marginLeft: 8, flexShrink: 0 }}>
            {statusConfig.label}
          </Tag>
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#8899aa',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '18px',
            marginBottom: 8,
          }}
        >
          {scenario.description}
        </div>
      </div>

      {/* 标签 */}
      <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <Tag
          color={
            scenario.classification === '绝密'
              ? 'red'
              : scenario.classification === '机密'
              ? 'orange'
              : scenario.classification === '秘密'
              ? 'gold'
              : 'default'
          }
          style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}
        >
          <SafetyCertificateOutlined /> {scenario.classification}
        </Tag>
        {scenario.tags.slice(0, 3).map((tag) => (
          <Tag key={tag} style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>
            {tag}
          </Tag>
        ))}
        {scenario.tags.length > 3 && (
          <Tag style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>
            +{scenario.tags.length - 3}
          </Tag>
        )}
      </div>

      {/* 状态流转操作行 */}
      {onStatusTransition && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 6 }}>
          {scenario.status === 'draft' && (
            <Button
              size="small"
              type="default"
              icon={<SendOutlined />}
              style={{ fontSize: 11 }}
              onClick={(e) => { e.stopPropagation(); onStatusTransition(scenario.id, 'in_review', '提交审核'); }}
            >
              提交审核
            </Button>
          )}
          {scenario.status === 'in_review' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ fontSize: 11, background: '#28b43c', borderColor: '#28b43c' }}
                onClick={(e) => { e.stopPropagation(); onStatusTransition(scenario.id, 'approved', '批准'); }}
              >
                批准
              </Button>
              <Button
                size="small"
                icon={<RollbackOutlined />}
                style={{ fontSize: 11 }}
                onClick={(e) => { e.stopPropagation(); onStatusTransition(scenario.id, 'draft', '退回草稿'); }}
              >
                退回
              </Button>
            </>
          )}
          {scenario.status === 'approved' && (
            <Button
              size="small"
              icon={<InboxOutlined />}
              style={{ fontSize: 11 }}
              onClick={(e) => { e.stopPropagation(); onStatusTransition(scenario.id, 'archived', '归档'); }}
            >
              归档
            </Button>
          )}
          {scenario.status === 'archived' && (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              style={{ fontSize: 11 }}
              onClick={(e) => { e.stopPropagation(); onStatusTransition(scenario.id, 'draft', '重启'); }}
            >
              重启
            </Button>
          )}
        </div>
      )}

      {/* 元信息行 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#5a6a7a',
        }}
      >
        <Space size={12}>
          <span>
            <AppstoreOutlined style={{ marginRight: 3 }} />
            {scenario.platforms.length} 平台
          </span>
          <span>
            <CalendarOutlined style={{ marginRight: 3 }} />
            v{scenario.version}
          </span>
        </Space>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Avatar.Group maxCount={3} size={18}>
            {scenario.collaborators.map((c) => (
              <Tooltip key={c.userId} title={`${c.userName} (${c.role})`}>
                <Avatar
                  size={18}
                  style={{
                    backgroundColor: c.color,
                    fontSize: 9,
                    lineHeight: '18px',
                    border: c.online ? '1.5px solid #28b43c' : '1.5px solid transparent',
                  }}
                >
                  {c.userName.charAt(0)}
                </Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
          {onlineCount > 0 && (
            <span style={{ color: '#28b43c', fontSize: 10 }}>
              <TeamOutlined /> {onlineCount}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ScenarioList;
