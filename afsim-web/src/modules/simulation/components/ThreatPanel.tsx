/**
 * ThreatPanel - Displays active threat assessments in a sortable table
 * Reads from useThreatStore and usePlatformStore
 */
import { useMemo } from 'react';
import { Table, Tag, Progress, Typography, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThreatStore } from '../../../store/threatStore';
import { usePlatformStore } from '../../../store/platformStore';
import type { ThreatAssessment } from '../../../store/threatStore';

const { Text } = Typography;

// ============ Threat level helpers ============

const THREAT_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const THREAT_COLOR: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

const THREAT_LABEL: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

const STATUS_COLOR: Record<string, string> = {
  tracking: 'default',
  engaging: 'red',
  defending: 'blue',
  evading: 'orange',
};

const STATUS_LABEL: Record<string, string> = {
  tracking: '跟踪',
  engaging: '交战',
  defending: '防御',
  evading: '规避',
};

// ============ Table row type ============

interface ThreatRow {
  key: string;
  platformIndex: number;
  targetIndex: number;
  platformName: string;
  targetName: string;
  threatLevel: ThreatAssessment['threatLevel'];
  engagementStatus: ThreatAssessment['engagementStatus'];
  riskPercent: number;
}

// ============ Column definitions ============

const columns: ColumnsType<ThreatRow> = [
  {
    title: '平台',
    dataIndex: 'platformName',
    key: 'platformName',
    width: 70,
    ellipsis: true,
    render: (name: string) => (
      <Text style={{ color: '#e6edf3', fontSize: 12 }}>{name}</Text>
    ),
  },
  {
    title: '目标',
    dataIndex: 'targetName',
    key: 'targetName',
    width: 70,
    ellipsis: true,
    render: (name: string) => (
      <Text style={{ color: '#e6edf3', fontSize: 12 }}>{name}</Text>
    ),
  },
  {
    title: '威胁',
    dataIndex: 'threatLevel',
    key: 'threatLevel',
    width: 60,
    sorter: (a, b) => THREAT_ORDER[a.threatLevel] - THREAT_ORDER[b.threatLevel],
    defaultSortOrder: 'ascend',
    render: (level: ThreatAssessment['threatLevel']) => (
      <Tag color={THREAT_COLOR[level]} style={{ fontSize: 11, lineHeight: '18px' }}>
        {THREAT_LABEL[level]}
      </Tag>
    ),
  },
  {
    title: '状态',
    dataIndex: 'engagementStatus',
    key: 'engagementStatus',
    width: 60,
    render: (status: ThreatAssessment['engagementStatus']) => (
      <Tag color={STATUS_COLOR[status]} style={{ fontSize: 11, lineHeight: '18px' }}>
        {STATUS_LABEL[status]}
      </Tag>
    ),
  },
  {
    title: '风险',
    dataIndex: 'riskPercent',
    key: 'riskPercent',
    width: 80,
    render: (pct: number) => (
      <Progress
        percent={pct}
        size="small"
        showInfo={false}
        strokeColor={pct >= 80 ? '#ff4d4f' : pct >= 50 ? '#faad14' : '#52c41a'}
        trailColor="#1f2937"
      />
    ),
  },
];

// ============ Main Component ============

export default function ThreatPanel() {
  const assessments = useThreatStore((s) => s.assessments);
  const platforms = usePlatformStore((s) => s.platforms);

  const dataSource = useMemo<ThreatRow[]>(() => {
    const rows: ThreatRow[] = [];
    assessments.forEach((a) => {
      const pName =
        platforms[a.platformIndex]?.name || `#${a.platformIndex}`;
      const tName =
        platforms[a.targetIndex]?.name || `#${a.targetIndex}`;
      const riskPercent =
        a.riskScore <= 1 ? Math.round(a.riskScore * 100) : Math.round(Math.min(a.riskScore, 100));
      rows.push({
        key: `${a.platformIndex}:${a.targetIndex}`,
        platformIndex: a.platformIndex,
        targetIndex: a.targetIndex,
        platformName: pName,
        targetName: tName,
        threatLevel: a.threatLevel,
        engagementStatus: a.engagementStatus,
        riskPercent,
      });
    });
    return rows;
  }, [assessments, platforms]);

  return (
    <Table<ThreatRow>
      size="small"
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{ y: 240 }}
      locale={{ emptyText: <Empty description="暂无威胁数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      style={{ background: 'transparent' }}
    />
  );
}
