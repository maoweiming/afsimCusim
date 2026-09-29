/**
 * SimulationSidebar - Collapsible sidebar panels for the simulation page
 * Organizes simulation components into expandable sections
 */
import { useMemo } from 'react';
import { Collapse, Typography } from 'antd';
import {
  ApartmentOutlined,
  HistoryOutlined,
  UserOutlined,
  RadarChartOutlined,
  ThunderboltOutlined,
  AlertOutlined,
  AimOutlined,
  ExperimentOutlined,
  WifiOutlined,
  FireOutlined,
  BarChartOutlined,
  PieChartOutlined,
  SwapOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import CommandChainView from './CommandChainView';
import ReplayControl from './ReplayControl';
import PlatformInfoPanel from './PlatformInfoPanel';
import TrackHistory from './TrackHistory';
import SensorControl from './SensorControl';
import WeaponBrowser from './WeaponBrowser';
import ThreatPanel from './ThreatPanel';
import AiDecisionPanel from './AiDecisionPanel';
import EwStatusPanel from './EwStatusPanel';
import EngagementTimeline from './EngagementTimeline';
import SimulationStats from './SimulationStats';
import TaskAssignmentOverview from './TaskAssignmentOverview';
import ComparisonView from './ComparisonView';
import EvaluationReport from './EvaluationReport';

const { Text } = Typography;

interface SimulationSidebarProps {
  side: 'left' | 'right';
}

const LEFT_DEFAULT_ACTIVE = ['cmd-chain'];
const RIGHT_DEFAULT_ACTIVE = ['platform-info', 'event-log'];

export default function SimulationSidebar({ side }: SimulationSidebarProps) {
  const items = useMemo(() => {
    if (side === 'left') {
      return [
        {
          key: 'cmd-chain',
          label: (
            <span>
              <ApartmentOutlined style={{ marginRight: 6 }} />
              指挥链
            </span>
          ),
          children: <CommandChainView />,
        },
        {
          key: 'replay',
          label: (
            <span>
              <HistoryOutlined style={{ marginRight: 6 }} />
              回放控制
            </span>
          ),
          children: <ReplayControl />,
        },
        {
          key: 'threat',
          label: (
            <span>
              <AlertOutlined style={{ marginRight: 6 }} />
              威胁评估
            </span>
          ),
          children: <ThreatPanel />,
        },
        {
          key: 'sim-stats',
          label: (
            <span>
              <BarChartOutlined style={{ marginRight: 6 }} />
              仿真统计
            </span>
          ),
          children: <SimulationStats />,
        },
        {
          key: 'task-overview',
          label: (
            <span>
              <PieChartOutlined style={{ marginRight: 6 }} />
              任务分配总览
            </span>
          ),
          children: <TaskAssignmentOverview />,
        },
        {
          key: 'comparison',
          label: (
            <span>
              <SwapOutlined style={{ marginRight: 6 }} />
              多组对比分析
            </span>
          ),
          children: <ComparisonView />,
        },
        {
          key: 'evaluation-report',
          label: (
            <span>
              <FilePdfOutlined style={{ marginRight: 6 }} />
              评估报告
            </span>
          ),
          children: <EvaluationReport />,
        },
        {
          key: 'ai-decision',
          label: (
            <span>
              <ExperimentOutlined style={{ marginRight: 6 }} />
              AI 决策
            </span>
          ),
          children: <AiDecisionPanel />,
        },
      ];
    }

    return [
      {
        key: 'platform-info',
        label: (
          <span>
            <UserOutlined style={{ marginRight: 6 }} />
            平台详情
          </span>
        ),
        children: <PlatformInfoPanel />,
      },
      {
        key: 'track-history',
        label: (
          <span>
            <RadarChartOutlined style={{ marginRight: 6 }} />
            航迹历史
          </span>
        ),
        children: <TrackHistory />,
      },
      {
        key: 'sensor-ctrl',
        label: (
          <span>
            <AimOutlined style={{ marginRight: 6 }} />
            传感器控制
          </span>
        ),
        children: <SensorControl />,
      },
      {
        key: 'weapon-browser',
        label: (
          <span>
            <ThunderboltOutlined style={{ marginRight: 6 }} />
            武器浏览
          </span>
        ),
        children: <WeaponBrowser />,
      },
      {
        key: 'engagement-timeline',
        label: (
          <span>
            <FireOutlined style={{ marginRight: 6 }} />
            交战时序
          </span>
        ),
        children: <EngagementTimeline />,
      },
      {
        key: 'ew-status',
        label: (
          <span>
            <WifiOutlined style={{ marginRight: 6 }} />
            电子战
          </span>
        ),
        children: <EwStatusPanel />,
      },
    ];
  }, [side]);

  const defaultActive = side === 'left' ? LEFT_DEFAULT_ACTIVE : RIGHT_DEFAULT_ACTIVE;

  return (
    <Collapse
      defaultActiveKey={defaultActive}
      ghost
      items={items}
      style={{ background: 'transparent' }}
      size="small"
    />
  );
}
