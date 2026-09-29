/**
 * ComparisonView - 多组仿真对比分析
 * 按当前场景 ID 拉取该场景下所有历史运行的统计数据，并排对比关键指标
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Typography, Empty, Spin, Button, Space, Table, Tag, Alert } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Column, Line } from '@ant-design/charts';
import { useSimStore } from '../../../store/simStore';
import { getScenarioComparison } from '../../../api/replayApi';
import type { ScenarioComparison, ScenarioComparisonEntry } from '../../../api/replayApi';

const { Text } = Typography;

function runLabel(entry: ScenarioComparisonEntry, index: number): string {
  return entry.name?.trim() || `运行 ${index + 1}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

export default function ComparisonView() {
  const scenarioId = useSimStore((s) => s.scenarioId);
  const [data, setData] = useState<ScenarioComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    if (!scenarioId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await getScenarioComparison(scenarioId);
      setData(resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取对比数据失败');
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const runs = useMemo(() => data?.runs ?? [], [data]);

  const metricsRows = useMemo(
    () =>
      runs.map((entry, i) => {
        const stats = entry.stats;
        const totalShots = stats.platform_stats.reduce((sum, p) => sum + p.shots_fired, 0);
        const totalKills = stats.platform_stats.reduce((sum, p) => sum + p.kills, 0);
        const destroyed = stats.platform_stats.filter((p) => p.final_status === 'destroyed').length;
        const successRate = totalShots > 0 ? (totalKills / totalShots) * 100 : null;
        return {
          key: entry.replay_id,
          label: runLabel(entry, i),
          createdAt: entry.created_at,
          duration: stats.duration,
          platformCount: stats.platform_count,
          eventsCount: stats.events_count,
          totalShots,
          totalKills,
          destroyed,
          successRate,
        };
      }),
    [runs]
  );

  const durationChartData = useMemo(
    () => metricsRows.map((r) => ({ run: r.label, value: r.duration, metric: '时长 (s)' })),
    [metricsRows]
  );

  const combatChartData = useMemo(
    () =>
      metricsRows.flatMap((r) => [
        { run: r.label, metric: '武器发射', value: r.totalShots },
        { run: r.label, metric: '命中/击杀', value: r.totalKills },
        { run: r.label, metric: '损失平台', value: r.destroyed },
      ]),
    [metricsRows]
  );

  const successRateChartData = useMemo(
    () =>
      metricsRows
        .filter((r) => r.successRate !== null)
        .map((r) => ({ run: r.label, value: r.successRate as number })),
    [metricsRows]
  );

  if (!scenarioId) {
    return <Empty description="未选择场景，无法进行对比分析" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  if (loading) {
    return <Spin tip="加载对比数据..." style={{ display: 'block', padding: 24 }} />;
  }

  if (error) {
    return (
      <Space direction="vertical" style={{ width: '100%', padding: 16 }}>
        <Text type="danger">{error}</Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchComparison}>重试</Button>
      </Space>
    );
  }

  if (runs.length === 0) {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Empty description="该场景暂无可供对比的历史运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchComparison} style={{ alignSelf: 'center' }}>刷新</Button>
      </Space>
    );
  }

  if (runs.length === 1) {
    return (
      <Space direction="vertical" style={{ width: '100%', padding: '0 4px' }}>
        <Alert
          type="info"
          showIcon
          message="该场景目前只有 1 组运行记录，至少需要 2 组才能进行对比"
          style={{ fontSize: 12 }}
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchComparison}>刷新</Button>
      </Space>
    );
  }

  return (
    <div style={{ padding: '0 4px' }}>
      <Space style={{ marginBottom: 8, justifyContent: 'space-between', width: '100%' }}>
        <Text strong style={{ fontSize: 12 }}>共 {runs.length} 组运行</Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchComparison}>刷新</Button>
      </Space>

      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>仿真时长对比</Text>
      <div style={{ height: 180, marginBottom: 12 }}>
        <Column
          data={durationChartData}
          xField="run"
          yField="value"
          height={180}
          axis={{ x: { labelFontSize: 10 }, y: { labelFontSize: 10 } }}
          theme="dark"
        />
      </div>

      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>交战指标对比</Text>
      <div style={{ height: 200, marginBottom: 12 }}>
        <Column
          data={combatChartData}
          xField="run"
          yField="value"
          colorField="metric"
          group
          height={200}
          axis={{ x: { labelFontSize: 10 }, y: { labelFontSize: 10 } }}
          legend={{ color: { itemLabelFontSize: 10 } }}
          theme="dark"
        />
      </div>

      {successRateChartData.length > 0 && (
        <>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>交互成功率趋势</Text>
          <div style={{ height: 160, marginBottom: 12 }}>
            <Line
              data={successRateChartData}
              xField="run"
              yField="value"
              height={160}
              axis={{ x: { labelFontSize: 10 }, y: { labelFontSize: 10 } }}
              theme="dark"
            />
          </div>
        </>
      )}

      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>明细数据</Text>
      <Table
        dataSource={metricsRows}
        size="small"
        pagination={false}
        scroll={{ x: true, y: 240 }}
        columns={[
          { title: '运行', dataIndex: 'label', width: 90, fixed: 'left', render: (v: string) => <Text style={{ fontSize: 11 }}>{v}</Text> },
          { title: '时长', dataIndex: 'duration', width: 72, render: (v: number) => <Text style={{ fontSize: 11 }}>{formatDuration(v)}</Text> },
          { title: '平台数', dataIndex: 'platformCount', width: 64, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
          { title: '事件数', dataIndex: 'eventsCount', width: 64, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
          { title: '发射', dataIndex: 'totalShots', width: 56, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
          { title: '击杀', dataIndex: 'totalKills', width: 56, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
          {
            title: '损失',
            dataIndex: 'destroyed',
            width: 56,
            render: (v: number) => <Text style={{ fontSize: 11, color: v > 0 ? '#ff4d4f' : undefined }}>{v}</Text>,
          },
          {
            title: '成功率',
            dataIndex: 'successRate',
            width: 72,
            render: (v: number | null) =>
              v !== null ? (
                <Tag color={v >= 50 ? 'green' : v > 0 ? 'orange' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                  {v.toFixed(1)}%
                </Tag>
              ) : (
                <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
              ),
          },
        ]}
      />
    </div>
  );
}
