/**
 * AiDecisionPanel - Displays AI decision state for the selected platform
 * Reads from useAiStore and usePlatformStore
 */
import { useMemo } from 'react';
import { Card, Steps, Progress, Tag, Typography, Space, Empty } from 'antd';
import {
  EyeOutlined,
  NodeIndexOutlined,
  ThunderboltOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { useAiStore } from '../../../store/aiStore';
import { usePlatformStore } from '../../../store/platformStore';
import type { OodaPhase } from '../../../store/aiStore';

const { Text } = Typography;

// ============ OODA phase config ============

const OODA_STEPS: Array<{
  key: OodaPhase;
  label: string;
  icon: React.ReactNode;
  color: string;
}> = [
  { key: 'observe', label: '观察', icon: <EyeOutlined />, color: '#1890ff' },
  { key: 'orient', label: '判断', icon: <NodeIndexOutlined />, color: '#13c2c2' },
  { key: 'decide', label: '决策', icon: <ThunderboltOutlined />, color: '#faad14' },
  { key: 'act', label: '行动', icon: <AimOutlined />, color: '#ff4d4f' },
];

const OODA_INDEX: Record<OodaPhase, number> = {
  observe: 0,
  orient: 1,
  decide: 2,
  act: 3,
};

// ============ Behavior mode color ============

const BEHAVIOR_COLOR: Record<string, string> = {
  aggressive: 'red',
  defensive: 'blue',
  patrol: 'green',
  cap: 'orange',
};

function behaviorColor(mode: string): string {
  const lower = mode.toLowerCase();
  for (const [key, color] of Object.entries(BEHAVIOR_COLOR)) {
    if (lower.includes(key)) return color;
  }
  return 'default';
}

// ============ Engagement decision color ============

const DECISION_COLOR: Record<string, string> = {
  hold: 'default',
  engage: 'red',
  evade: 'orange',
  rtb: 'blue',
};

const DECISION_LABEL: Record<string, string> = {
  hold: '待命',
  engage: '交战',
  evade: '规避',
  rtb: '返航',
};

// ============ Threat score color ============

function threatScoreColor(score: number): string {
  if (score >= 80) return '#ff4d4f';
  if (score >= 60) return '#fa8c16';
  if (score >= 30) return '#faad14';
  return '#52c41a';
}

// ============ Main Component ============

export default function AiDecisionPanel() {
  const platformAi = useAiStore((s) => s.platformAi);
  const selectedPlatformIndex = usePlatformStore((s) => s.selectedPlatformIndex);

  const aiState = useMemo(() => {
    if (selectedPlatformIndex === null) return null;
    return platformAi.get(selectedPlatformIndex) ?? null;
  }, [platformAi, selectedPlatformIndex]);

  // No platform selected
  if (selectedPlatformIndex === null) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Empty
          description="请选择平台查看 AI 状态"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  // No AI state for selected platform
  if (!aiState) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Empty
          description="该平台无 AI 决策数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const currentStep = OODA_INDEX[aiState.oodaPhase];
  const threatPct = aiState.threatScore <= 1
    ? Math.round(aiState.threatScore * 100)
    : Math.round(Math.min(aiState.threatScore, 100));

  return (
    <Card
      size="small"
      bordered={false}
      style={{ background: '#111820' }}
      bodyStyle={{ padding: '8px 12px' }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* OODA Phase Indicator */}
        <div>
          <Text style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 6 }}>
            OODA 阶段
          </Text>
          <Steps
            current={currentStep}
            size="small"
            items={OODA_STEPS.map((step) => ({
              title: (
                <span style={{ fontSize: 11, color: '#e6edf3' }}>{step.label}</span>
              ),
              icon: (
                <span style={{ color: step.color, fontSize: 14 }}>{step.icon}</span>
              ),
            }))}
          />
        </div>

        {/* Threat Score */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: '#8b949e', fontSize: 11 }}>威胁评分</Text>
            <Text style={{ color: threatScoreColor(threatPct), fontSize: 11, fontWeight: 600 }}>
              {threatPct}
            </Text>
          </div>
          <Progress
            type="dashboard"
            percent={threatPct}
            size={80}
            strokeColor={threatScoreColor(threatPct)}
            trailColor="#1f2937"
            format={(pct) => (
              <span style={{ color: '#e6edf3', fontSize: 16, fontWeight: 600 }}>{pct}</span>
            )}
          />
        </div>

        {/* Behavior Mode */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#8b949e', fontSize: 11 }}>行为模式</Text>
          <Tag color={behaviorColor(aiState.aiBehaviorMode)}>
            {aiState.aiBehaviorMode || '未知'}
          </Tag>
        </div>

        {/* Decision */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#8b949e', fontSize: 11 }}>交战决策</Text>
          <Tag color={DECISION_COLOR[aiState.engagementDecision] ?? 'default'}>
            {DECISION_LABEL[aiState.engagementDecision] ?? aiState.engagementDecision}
          </Tag>
        </div>
      </Space>
    </Card>
  );
}
