import { useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Progress,
  List,
  Typography,
  Space,
  Button,
  Alert,
} from 'antd';
import {
  DatabaseOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  CloudDownloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  RocketOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDataCenterStore } from '../store/dataCenterStore';
import type { DataItem, ActivityLog, QualityIssue } from '../types';

const { Text, Title } = Typography;

// ============ 辅助函数 ============

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return d.toLocaleDateString('zh-CN');
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

function actionToIcon(action: string) {
  if (action.includes('创建')) return <RocketOutlined style={{ color: '#1890ff' }} />;
  if (action.includes('发布')) return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  if (action.includes('仿真')) return <PlayCircleOutlined style={{ color: '#faad14' }} />;
  if (action.includes('修改')) return <ToolOutlined style={{ color: '#1890ff' }} />;
  if (action.includes('归档')) return <InboxOutlined style={{ color: '#faad14' }} />;
  if (action.includes('导入')) return <CloudDownloadOutlined style={{ color: '#1890ff' }} />;
  if (action.includes('审核')) return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  return <ClockCircleOutlined style={{ color: '#888' }} />;
}

function severityToColor(severity: QualityIssue['severity']) {
  const map: Record<QualityIssue['severity'], string> = {
    high: '#ff4d4f',
    medium: '#faad14',
    low: '#1890ff',
  };
  return map[severity];
}

// ============ 组件 ============

export default function DataDashboard() {
  const stats = useDataCenterStore((s) => s.stats);
  const qualityReport = useDataCenterStore((s) => s.qualityReport);
  const dataItems = useDataCenterStore((s) => s.dataItems);
  const loadItems = useDataCenterStore((s) => s.loadItems);

  // 打开数据中心时从 data-platform 加载（mock 模式下为 no-op）
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // 最近更新的数据条目
  const recentItems = useMemo(() => {
    return [...dataItems]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [dataItems]);

  // 按类型统计
  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    dataItems.forEach((item) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({
      type: type as DataItem['type'],
      count,
      percent: Math.round((count / dataItems.length) * 100),
    }));
  }, [dataItems]);

  // 最近活动表格列
  const recentColumns: ColumnsType<DataItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string) => <Text strong>{name}</Text>,
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
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: string) => <Tag>v{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: statusToTag,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 100,
      render: (t: string) => <Text type="secondary">{formatTime(t)}</Text>,
    },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* 统计卡片 */}
      <Row gutter={[12, 12]}>
        <Col span={6}>
          <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <Statistic
              title="装备总数"
              value={stats.totalEquipment}
              prefix={<DatabaseOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <Statistic
              title="想定总数"
              value={stats.totalScenarios}
              prefix={<FileTextOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <Statistic
              title="仿真总数"
              value={stats.totalSimulations}
              prefix={<PlayCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <Statistic
              title="存储用量"
              value={formatBytes(stats.storageUsed)}
              prefix={<InboxOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        {/* 数据分布 */}
        <Col span={8}>
          <Card
            size="small"
            title="数据分布"
            bordered={false}
            style={{ background: 'var(--bg-secondary)', height: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {typeDistribution.map(({ type, count, percent }) => (
                <div key={type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{typeToLabel(type)}</Text>
                    <Text type="secondary">{count}项 ({percent}%)</Text>
                  </div>
                  <Progress
                    percent={percent}
                    strokeColor={typeToColor(type)}
                    showInfo={false}
                    size="small"
                  />
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        {/* 数据质量 */}
        <Col span={8}>
          <Card
            size="small"
            title="数据质量报告"
            bordered={false}
            style={{ background: 'var(--bg-secondary)', height: '100%' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Progress
                type="dashboard"
                percent={qualityReport.score}
                size={100}
                strokeColor={
                  qualityReport.score >= 80
                    ? '#52c41a'
                    : qualityReport.score >= 60
                      ? '#faad14'
                      : '#ff4d4f'
                }
                format={(percent) => (
                  <span style={{ color: 'var(--text-primary)', fontSize: 18 }}>{percent}分</span>
                )}
              />
            </div>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {qualityReport.issues.map((issue) => (
                <Alert
                  key={issue.id}
                  type={issue.severity === 'high' ? 'error' : issue.severity === 'medium' ? 'warning' : 'info'}
                  message={
                    <Space>
                      <WarningOutlined style={{ color: severityToColor(issue.severity) }} />
                      <Text style={{ fontSize: 12 }}>{issue.description}</Text>
                    </Space>
                  }
                  banner
                  style={{ padding: '4px 8px' }}
                />
              ))}
            </Space>
          </Card>
        </Col>

        {/* 最近活动 */}
        <Col span={8}>
          <Card
            size="small"
            title="最近活动"
            bordered={false}
            style={{ background: 'var(--bg-secondary)', height: '100%' }}
            bodyStyle={{ padding: '0 8px' }}
          >
            <List
              size="small"
              dataSource={stats.recentActivity.slice(0, 6)}
              renderItem={(item: ActivityLog) => (
                <List.Item style={{ padding: '6px 0', border: 'none' }}>
                  <Space size={8} align="start">
                    {actionToIcon(item.action)}
                    <div>
                      <Text style={{ fontSize: 12 }}>
                        <Text strong>{item.userName}</Text>{' '}
                        <Text type="secondary">{item.action}</Text>{' '}
                        <Text>{item.targetName}</Text>
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {formatTime(item.timestamp)}
                      </Text>
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近更新的数据 */}
      <Card
        size="small"
        title="最近更新数据"
        bordered={false}
        style={{ background: 'var(--bg-secondary)' }}
        extra={
          <Space>
            <Button size="small" type="link">
              查看全部
            </Button>
          </Space>
        }
      >
        <Table
          size="small"
          columns={recentColumns}
          dataSource={recentItems}
          rowKey="id"
          pagination={false}
          style={{ background: 'transparent' }}
        />
      </Card>

      {/* 快捷操作 */}
      <Card
        size="small"
        title="快捷操作"
        bordered={false}
        style={{ background: 'var(--bg-secondary)' }}
      >
        <Row gutter={[12, 12]}>
          {[
            { icon: <DatabaseOutlined />, label: '新建装备', color: '#1890ff' },
            { icon: <FileTextOutlined />, label: '新建想定', color: '#52c41a' },
            { icon: <PlayCircleOutlined />, label: '启动仿真', color: '#faad14' },
            { icon: <CloudDownloadOutlined />, label: '导入数据', color: '#722ed1' },
          ].map((action) => (
            <Col span={6} key={action.label}>
              <Card
                hoverable
                size="small"
                style={{ textAlign: 'center', background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
              >
                <Space direction="vertical" size={4}>
                  <span style={{ fontSize: 24, color: action.color }}>{action.icon}</span>
                  <Text style={{ fontSize: 12 }}>{action.label}</Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
