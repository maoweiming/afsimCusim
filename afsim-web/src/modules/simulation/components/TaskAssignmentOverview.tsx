/**
 * TaskAssignmentOverview - 场景级任务分配总览
 * 汇总当前仿真中所有平台的任务类型/状态/阵营分布
 */
import { useMemo } from 'react';
import { Typography, Empty, Row, Col, Statistic, Tag, Table, Space } from 'antd';
import { Pie, Column } from '@ant-design/charts';
import { usePlatformStore } from '../../../store/platformStore';
import type { PlatformInfo } from '../../../store/platformStore';

const { Text } = Typography;

const MISSION_TYPE_LABELS: Record<string, string> = {
  patrol: '巡逻', strike: '打击', escort: '护航', recon: '侦察',
  cargo: '运输', cap: '空中巡逻', cas: '近距支援',
};

const MISSION_STATUS_LABELS: Record<string, string> = {
  en_route: '途中', on_station: '到位', engaging: '交战中',
  rtb: '返航', completed: '完成', aborted: '中止',
};

const SIDE_COLOR: Record<string, string> = { red: '#ff4d4f', blue: '#1677ff' };

interface AggRow {
  missionType: string;
  side: string;
  count: number;
  avgProgress: number;
  statuses: Record<string, number>;
}

function aggregateMissions(platforms: PlatformInfo[]): AggRow[] {
  const groups = new Map<string, AggRow>();
  for (const p of platforms) {
    const m = p.mission;
    if (!m) continue;
    const key = `${m.type}__${p.side}`;
    let row = groups.get(key);
    if (!row) {
      row = { missionType: m.type, side: p.side, count: 0, avgProgress: 0, statuses: {} };
      groups.set(key, row);
    }
    row.count += 1;
    row.avgProgress += m.progress ?? 0;
    row.statuses[m.status] = (row.statuses[m.status] ?? 0) + 1;
  }
  return Array.from(groups.values()).map((r) => ({ ...r, avgProgress: r.count > 0 ? r.avgProgress / r.count : 0 }));
}

export default function TaskAssignmentOverview() {
  const platforms = usePlatformStore((s) => s.platforms);

  const platformList = useMemo(() => Object.values(platforms), [platforms]);
  const withMission = useMemo(() => platformList.filter((p) => !!p.mission), [platformList]);
  const aggRows = useMemo(() => aggregateMissions(platformList), [platformList]);

  if (platformList.length === 0) {
    return <Empty description="暂无平台数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  if (withMission.length === 0) {
    return <Empty description="当前平台均未分配任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  // 按任务类型聚合（用于饼图）
  const typeCounts = new Map<string, number>();
  for (const p of withMission) {
    const t = p.mission!.type;
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const pieData = Array.from(typeCounts.entries()).map(([type, count]) => ({
    type: MISSION_TYPE_LABELS[type] ?? type,
    count,
  }));

  // 按"任务类型 x 阵营"聚合（用于分组柱状图）
  const columnData = aggRows.flatMap((r) => [
    { type: MISSION_TYPE_LABELS[r.missionType] ?? r.missionType, side: r.side, count: r.count },
  ]);

  // 按状态聚合
  const statusCounts = new Map<string, number>();
  for (const p of withMission) {
    const s = p.mission!.status;
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  }

  const completed = statusCounts.get('completed') ?? 0;
  const aborted = statusCounts.get('aborted') ?? 0;
  const engaging = statusCounts.get('engaging') ?? 0;
  const avgProgressOverall =
    withMission.reduce((sum, p) => sum + (p.mission?.progress ?? 0), 0) / withMission.length;

  return (
    <div style={{ padding: '0 4px' }}>
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}>已分配任务平台</Text>}
            value={`${withMission.length} / ${platformList.length}`}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}>平均完成进度</Text>}
            value={(avgProgressOverall * 100).toFixed(0)}
            suffix="%"
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}>交战中</Text>}
            value={engaging}
            valueStyle={{ fontSize: 16, color: engaging > 0 ? '#ff4d4f' : undefined }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}>已完成</Text>}
            value={completed}
            valueStyle={{ fontSize: 16, color: '#52c41a' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<Text style={{ fontSize: 11 }}>已中止</Text>}
            value={aborted}
            valueStyle={{ fontSize: 16, color: aborted > 0 ? '#faad14' : undefined }}
          />
        </Col>
      </Row>

      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>任务类型分布</Text>
      <div style={{ height: 200, marginBottom: 12 }}>
        <Pie
          data={pieData}
          angleField="count"
          colorField="type"
          height={200}
          label={{ text: 'count', style: { fontSize: 10 } }}
          legend={{ color: { itemLabelFontSize: 10 } }}
          theme="dark"
        />
      </div>

      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>任务类型 × 阵营</Text>
      <div style={{ height: 220, marginBottom: 12 }}>
        <Column
          data={columnData}
          xField="type"
          yField="count"
          colorField="side"
          group
          height={220}
          scale={{ color: { range: columnData.map((d) => SIDE_COLOR[d.side] ?? '#8c8c8c') } }}
          axis={{ x: { labelFontSize: 10 }, y: { labelFontSize: 10 } }}
          legend={{ color: { itemLabelFontSize: 10 } }}
          theme="dark"
        />
      </div>

      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>分组明细</Text>
      <Table<AggRow>
        dataSource={aggRows}
        rowKey={(r) => `${r.missionType}__${r.side}`}
        size="small"
        pagination={false}
        scroll={{ y: 220 }}
        columns={[
          {
            title: '任务类型',
            dataIndex: 'missionType',
            width: 90,
            render: (t: string) => <Text style={{ fontSize: 11 }}>{MISSION_TYPE_LABELS[t] ?? t}</Text>,
          },
          {
            title: '阵营',
            dataIndex: 'side',
            width: 60,
            render: (side: string) => (
              <Tag color={side === 'red' ? 'red' : side === 'blue' ? 'blue' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                {side}
              </Tag>
            ),
          },
          {
            title: '数量',
            dataIndex: 'count',
            width: 56,
            render: (c: number) => <Text style={{ fontSize: 11 }}>{c}</Text>,
          },
          {
            title: '平均进度',
            dataIndex: 'avgProgress',
            width: 72,
            render: (p: number) => <Text style={{ fontSize: 11 }}>{(p * 100).toFixed(0)}%</Text>,
          },
          {
            title: '状态分布',
            dataIndex: 'statuses',
            render: (statuses: Record<string, number>) => (
              <Space size={4} wrap>
                {Object.entries(statuses).map(([s, n]) => (
                  <Tag key={s} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                    {MISSION_STATUS_LABELS[s] ?? s} × {n}
                  </Tag>
                ))}
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
