/**
 * EvaluationReport - 自动评估报告生成与导出
 * 汇总仿真参数、统计指标、任务分配与平台明细，渲染为可导出 PDF 的报告模板
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Typography, Empty, Spin, Button, Space, Table, Tag, Row, Col, Statistic, Divider, message } from 'antd';
import { FilePdfOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSimStore } from '../../../store/simStore';
import { usePlatformStore } from '../../../store/platformStore';
import { useEventStore } from '../../../store/eventStore';
import { useSimMetricsStore } from '../../../store/simMetricsStore';
import { getSimulationStats } from '../../../api/replayApi';
import type { SimulationStats, PlatformStats, EngagementSummary } from '../../../api/replayApi';

const { Text, Title } = Typography;

/**
 * 从运行期实时累加的 simMetricsStore（+ sim/event store）构建评估统计——
 * 这是数据中间平台离线时评估报告的"真实数据"来源。
 */
function buildLiveStats(simId: string): SimulationStats {
  const metrics = useSimMetricsStore.getState();
  const sim = useSimStore.getState();
  const events = useEventStore.getState();

  const platform_stats: PlatformStats[] = Array.from(metrics.platforms.values())
    .filter((m) => !m.isWeapon)
    .sort((a, b) => a.index - b.index)
    .map((m) => ({
      platform_id: String(m.index),
      platform_name: m.name || `平台-${m.index}`,
      side: m.side,
      max_speed: m.maxSpeed,
      min_altitude: Number.isFinite(m.minAltitude) ? m.minAltitude : 0,
      max_altitude: Number.isFinite(m.maxAltitude) ? m.maxAltitude : 0,
      total_distance: m.totalDistance,
      shots_fired: m.shotsFired,
      kills: m.kills,
      final_status: m.status,
    }));

  const engagements: EngagementSummary[] = metrics.engagements.map((e) => ({
    id: e.id,
    time: e.time,
    attacker_id: String(e.attacker_index),
    target_id: String(e.target_index),
    weapon_type: e.weapon_name,
    result: e.result,
  }));

  return {
    simulation_id: simId,
    duration: sim.simTime,
    total_frames: metrics.frameCount,
    platform_count: platform_stats.length,
    events_count: events.events.length,
    platform_stats,
    engagements,
  };
}

const MISSION_TYPE_LABELS: Record<string, string> = {
  patrol: '巡逻', strike: '打击', escort: '护航', recon: '侦察',
  cargo: '运输', cap: '空中巡逻', cas: '近距支援',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m} 分 ${s} 秒`;
  const h = Math.floor(m / 60);
  return `${h} 时 ${m % 60} 分`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
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

export default function EvaluationReport() {
  const scenarioId = useSimStore((s) => s.scenarioId);
  const simulationId = useSimStore((s) => s.simulationId);
  const platforms = usePlatformStore((s) => s.platforms);

  const [stats, setStats] = useState<SimulationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const phase = useSimStore((s) => s.phase);

  const fetchStats = useCallback(async () => {
    if (!simulationId) return;
    // 优先使用运行期实时累加的真实数据（无需数据中间平台）。
    const live = buildLiveStats(simulationId);
    if (live.platform_count > 0 || live.total_frames > 0) {
      setStats(live);
      return;
    }
    // 无实时数据（例如查看已结束仿真的历史回放）→ 回退数据中间平台。
    setLoading(true);
    try {
      const data = await getSimulationStats(simulationId);
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, [simulationId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 仿真运行期间每 2 秒刷新一次，使报告保持"实时"。
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(fetchStats, 2000);
    return () => clearInterval(timer);
  }, [phase, fetchStats]);

  const platformList = useMemo(() => Object.values(platforms), [platforms]);
  const withMission = useMemo(() => platformList.filter((p) => !!p.mission), [platformList]);

  const missionAgg = useMemo(() => {
    const groups = new Map<string, { type: string; count: number; avgProgress: number }>();
    for (const p of withMission) {
      const t = p.mission!.type;
      const g = groups.get(t) ?? { type: t, count: 0, avgProgress: 0 };
      g.count += 1;
      g.avgProgress += p.mission!.progress ?? 0;
      groups.set(t, g);
    }
    return Array.from(groups.values()).map((g) => ({ ...g, avgProgress: g.count > 0 ? g.avgProgress / g.count : 0 }));
  }, [withMission]);

  const handleExportPdf = useCallback(async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const filename = `评估报告_${simulationId ?? 'sim'}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, backgroundColor: '#0d1117' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(reportRef.current)
        .save();
      message.success('报告已导出');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }, [simulationId]);

  if (!simulationId) {
    return <Empty description="未运行仿真，无法生成评估报告" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  if (loading && !stats) {
    return <Spin tip="加载报告数据..." style={{ display: 'block', padding: 24 }} />;
  }

  const totalShots = stats?.platform_stats.reduce((sum, p) => sum + p.shots_fired, 0) ?? 0;
  const totalKills = stats?.platform_stats.reduce((sum, p) => sum + p.kills, 0) ?? 0;
  const totalDistance = stats?.platform_stats.reduce((sum, p) => sum + p.total_distance, 0) ?? 0;
  const destroyed = stats?.platform_stats.filter((p) => p.final_status === 'destroyed').length ?? 0;
  const successRate = totalShots > 0 ? (totalKills / totalShots) * 100 : null;

  return (
    <div style={{ padding: '0 4px' }}>
      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Text strong style={{ fontSize: 12 }}>仿真评估报告</Text>
        <Space size={4}>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchStats}>刷新</Button>
          <Button
            size="small"
            type="primary"
            icon={<FilePdfOutlined />}
            loading={exporting}
            onClick={handleExportPdf}
          >
            生成并导出 PDF
          </Button>
        </Space>
      </Space>

      <div ref={reportRef} style={{ background: '#0d1117', color: '#e6edf3', padding: 16, borderRadius: 6 }}>
        <Title level={4} style={{ color: '#e6edf3', marginTop: 0 }}>仿真评估报告</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          生成时间：{new Date().toLocaleString('zh-CN')}
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          场景 ID：{scenarioId ?? '—'}　仿真 ID：{simulationId}
        </Text>

        <Divider style={{ borderColor: '#21262d' }} />

        <Title level={5} style={{ color: '#e6edf3' }}>一、总体统计</Title>
        {stats ? (
          <Row gutter={[12, 12]}>
            <Col span={6}><Statistic title="仿真时长" value={formatDuration(stats.duration)} valueStyle={{ fontSize: 16, color: '#e6edf3' }} /></Col>
            <Col span={6}><Statistic title="平台总数" value={stats.platform_count} valueStyle={{ fontSize: 16, color: '#e6edf3' }} /></Col>
            <Col span={6}><Statistic title="事件总数" value={stats.events_count} valueStyle={{ fontSize: 16, color: '#e6edf3' }} /></Col>
            <Col span={6}><Statistic title="总帧数" value={stats.total_frames} valueStyle={{ fontSize: 16, color: '#e6edf3' }} /></Col>
            <Col span={6}><Statistic title="武器发射数" value={totalShots} valueStyle={{ fontSize: 16, color: '#e6edf3' }} /></Col>
            <Col span={6}><Statistic title="命中/击杀数" value={totalKills} valueStyle={{ fontSize: 16, color: '#e6edf3' }} /></Col>
            <Col span={6}><Statistic title="损失平台数" value={destroyed} valueStyle={{ fontSize: 16, color: destroyed > 0 ? '#ff4d4f' : '#e6edf3' }} /></Col>
            <Col span={6}>
              <Statistic
                title="交互成功率"
                value={successRate !== null ? successRate.toFixed(1) : '—'}
                suffix={successRate !== null ? '%' : undefined}
                valueStyle={{ fontSize: 16, color: '#e6edf3' }}
              />
            </Col>
            <Col span={12}><Statistic title="总航行距离" value={formatDistance(totalDistance)} valueStyle={{ fontSize: 16, color: '#e6edf3' }} /></Col>
          </Row>
        ) : (
          <Empty description="暂无统计数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        <Divider style={{ borderColor: '#21262d' }} />

        <Title level={5} style={{ color: '#e6edf3' }}>二、任务分配概况</Title>
        {missionAgg.length > 0 ? (
          <Table
            dataSource={missionAgg}
            rowKey="type"
            size="small"
            pagination={false}
            columns={[
              { title: '任务类型', dataIndex: 'type', render: (t: string) => <Text style={{ color: '#e6edf3', fontSize: 12 }}>{MISSION_TYPE_LABELS[t] ?? t}</Text> },
              { title: '分配平台数', dataIndex: 'count', render: (v: number) => <Text style={{ color: '#e6edf3', fontSize: 12 }}>{v}</Text> },
              { title: '平均完成进度', dataIndex: 'avgProgress', render: (v: number) => <Text style={{ color: '#e6edf3', fontSize: 12 }}>{(v * 100).toFixed(0)}%</Text> },
            ]}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>本次仿真未配置任务分配数据</Text>
        )}

        <Divider style={{ borderColor: '#21262d' }} />

        <Title level={5} style={{ color: '#e6edf3' }}>三、平台明细</Title>
        {stats && stats.platform_stats.length > 0 ? (
          <Table<PlatformStats>
            dataSource={stats.platform_stats}
            rowKey="platform_id"
            size="small"
            pagination={false}
            columns={[
              {
                title: '名称',
                dataIndex: 'platform_name',
                render: (name: string, r) => (
                  <Space size={4}>
                    <Tag color={r.side === 'red' ? 'red' : r.side === 'blue' ? 'blue' : 'default'} style={{ fontSize: 10 }}>{r.side}</Tag>
                    <Text style={{ color: '#e6edf3', fontSize: 12 }}>{name || r.platform_id}</Text>
                  </Space>
                ),
              },
              { title: '最大速度', dataIndex: 'max_speed', render: (v: number) => <Text style={{ color: '#e6edf3', fontSize: 12 }}>{v.toFixed(0)} m/s</Text> },
              {
                title: '高度范围',
                render: (_: unknown, r: PlatformStats) => <Text style={{ color: '#e6edf3', fontSize: 12 }}>{r.min_altitude.toFixed(0)}~{r.max_altitude.toFixed(0)} m</Text>,
              },
              { title: '航行距离', dataIndex: 'total_distance', render: (v: number) => <Text style={{ color: '#e6edf3', fontSize: 12 }}>{formatDistance(v)}</Text> },
              { title: '武器发射', dataIndex: 'shots_fired', render: (v: number) => <Text style={{ color: '#e6edf3', fontSize: 12 }}>{v}</Text> },
              { title: '击杀数', dataIndex: 'kills', render: (v: number) => <Text style={{ color: '#e6edf3', fontSize: 12 }}>{v}</Text> },
              {
                title: '最终状态',
                dataIndex: 'final_status',
                render: (s: string) => (
                  <Tag color={s === 'destroyed' ? 'red' : s === 'damaged' ? 'orange' : 'green'} style={{ fontSize: 10 }}>
                    {statusLabel(s)}
                  </Tag>
                ),
              },
            ]}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>暂无平台明细数据</Text>
        )}

        <Divider style={{ borderColor: '#21262d' }} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          本报告由 TrueSim 仿真平台自动生成，数据来源于仿真运行期间采集的时序统计与态势信息。
        </Text>
      </div>
    </div>
  );
}
