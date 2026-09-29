/**
 * SimulationStats - Displays post-simulation statistics
 * Fetches stats from GET /api/v1/timeseries/stats/:simId
 */
import { useState, useEffect, useCallback } from 'react';
import { Typography, Statistic, Row, Col, Table, Tag, Empty, Spin, Button, Space, Progress, Alert } from 'antd';
import {
  ReloadOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  PercentageOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { useSimStore } from '../../../store/simStore';
import { getSimulationStats } from '../../../api/replayApi';
import type { SimulationStats as StatsType, PlatformStats } from '../../../api/replayApi';

const { Text } = Typography;

export default function SimulationStats() {
  const simulationId = useSimStore((s) => s.simulationId);
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!simulationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSimulationStats(simulationId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [simulationId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (!simulationId) {
    return <Empty description="未运行仿真" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  if (loading) {
    return <Spin tip="加载统计数据..." style={{ display: 'block', padding: 24 }} />;
  }

  if (error) {
    return (
      <Space direction="vertical" style={{ width: '100%', padding: 16 }}>
        <Text type="danger">{error}</Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchStats}>
          重试
        </Button>
      </Space>
    );
  }

  if (!stats) {
    return <Empty description="暂无统计数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  if (stats._unavailable) {
    return (
      <Space direction="vertical" style={{ width: '100%', padding: 16 }}>
        <Alert
          type="warning"
          showIcon
          icon={<DisconnectOutlined />}
          message="数据平台未连接"
          description="无法获取仿真统计数据，请检查数据中间平台（data-gateway）服务是否已启动。"
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchStats}>
          重试
        </Button>
      </Space>
    );
  }

  // 汇总统计
  const totalShots = stats.platform_stats.reduce((sum, p) => sum + p.shots_fired, 0);
  const totalKills = stats.platform_stats.reduce((sum, p) => sum + p.kills, 0);
  const totalDistance = stats.platform_stats.reduce((sum, p) => sum + p.total_distance, 0);
  const successRate = totalShots > 0 ? (totalKills / totalShots) * 100 : null;
  const sideGroups = groupBySide(stats.platform_stats);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* 概览指标 */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}><ClockCircleOutlined /> 时长</Text>}
            value={formatDuration(stats.duration)}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}><TeamOutlined /> 平台数</Text>}
            value={stats.platform_count}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}><ThunderboltOutlined /> 武器发射</Text>}
            value={totalShots}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}><DashboardOutlined /> 总帧数</Text>}
            value={stats.total_frames}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}><PercentageOutlined /> 交互成功率</Text>}
            value={successRate !== null ? successRate.toFixed(1) : '—'}
            suffix={successRate !== null ? '%' : undefined}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
      </Row>

      {/* 双方态势 */}
      {Object.entries(sideGroups).map(([side, platforms]) => (
        <div key={side} style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12 }}>
            <Tag color={side === 'red' ? 'red' : side === 'blue' ? 'blue' : 'default'}>{side}</Tag>
            {platforms.length} 个平台
          </Text>
          <SideSummary platforms={platforms} />
        </div>
      ))}

      {/* 平台明细表 */}
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>平台明细</Text>
      <Table<PlatformStats>
        dataSource={stats.platform_stats}
        rowKey="platform_id"
        size="small"
        pagination={false}
        scroll={{ y: 240 }}
        columns={[
          {
            title: '名称',
            dataIndex: 'platform_name',
            width: 100,
            ellipsis: true,
            render: (name: string, r) => (
              <Space size={4}>
                <Tag color={r.side === 'red' ? 'red' : r.side === 'blue' ? 'blue' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                  {r.side}
                </Tag>
                <Text style={{ fontSize: 11 }}>{name || r.platform_id}</Text>
              </Space>
            ),
          },
          {
            title: '最大速度',
            dataIndex: 'max_speed',
            width: 72,
            render: (v: number) => <Text style={{ fontSize: 11 }}>{v.toFixed(0)} m/s</Text>,
          },
          {
            title: '高度范围',
            width: 100,
            render: (_: unknown, r: PlatformStats) => (
              <Text style={{ fontSize: 11 }}>
                {r.min_altitude.toFixed(0)}~{r.max_altitude.toFixed(0)} m
              </Text>
            ),
          },
          {
            title: '距离',
            dataIndex: 'total_distance',
            width: 72,
            render: (v: number) => <Text style={{ fontSize: 11 }}>{formatDistance(v)}</Text>,
          },
          {
            title: '发射',
            dataIndex: 'shots_fired',
            width: 48,
            render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text>,
          },
          {
            title: '状态',
            dataIndex: 'final_status',
            width: 56,
            render: (s: string) => (
              <Tag
                color={s === 'destroyed' ? 'red' : s === 'damaged' ? 'orange' : 'green'}
                style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
              >
                {statusLabel(s)}
              </Tag>
            ),
          },
        ]}
      />
    </div>
  );
}

// ============ Helper sub-components ============

function SideSummary({ platforms }: { platforms: PlatformStats[] }) {
  const alive = platforms.filter((p) => p.final_status !== 'destroyed').length;
  const destroyed = platforms.length - alive;
  const shots = platforms.reduce((sum, p) => sum + p.shots_fired, 0);
  const dist = platforms.reduce((sum, p) => sum + p.total_distance, 0);

  return (
    <Row gutter={4} style={{ marginTop: 4 }}>
      <Col span={6}>
        <Text type="secondary" style={{ fontSize: 10 }}>存活</Text>
        <br />
        <Text style={{ fontSize: 12 }}>{alive}/{platforms.length}</Text>
        {destroyed > 0 && (
          <Progress
            percent={Math.round((alive / platforms.length) * 100)}
            size="small"
            showInfo={false}
            strokeColor={alive > destroyed ? '#52c41a' : '#ff4d4f'}
            style={{ marginTop: 2 }}
          />
        )}
      </Col>
      <Col span={6}>
        <Text type="secondary" style={{ fontSize: 10 }}>发射</Text>
        <br />
        <Text style={{ fontSize: 12 }}>{shots}</Text>
      </Col>
      <Col span={6}>
        <Text type="secondary" style={{ fontSize: 10 }}>总距离</Text>
        <br />
        <Text style={{ fontSize: 12 }}>{formatDistance(dist)}</Text>
      </Col>
      <Col span={6}>
        <Text type="secondary" style={{ fontSize: 10 }}>损失</Text>
        <br />
        <Text style={{ fontSize: 12, color: destroyed > 0 ? '#ff4d4f' : undefined }}>{destroyed}</Text>
      </Col>
    </Row>
  );
}

// ============ Helpers ============

function groupBySide(platforms: PlatformStats[]): Record<string, PlatformStats[]> {
  const groups: Record<string, PlatformStats[]> = {};
  for (const p of platforms) {
    const side = p.side || 'unknown';
    if (!groups[side]) groups[side] = [];
    groups[side].push(p);
  }
  return groups;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)}m`;
  if (meters < 100000) return `${(meters / 1000).toFixed(1)}km`;
  return `${(meters / 1000).toFixed(0)}km`;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'active': return '正常';
    case 'damaged': return '受损';
    case 'destroyed': return '击毁';
    case 'retreating': return '撤退';
    default: return s || '未知';
  }
}
