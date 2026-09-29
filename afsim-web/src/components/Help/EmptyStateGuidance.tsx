/**
 * EmptyStateGuidance - 空状态引导组件
 * 在不同场景下显示上下文相关的空状态提示
 */
import { Empty, Button } from 'antd';
import {
  RocketOutlined,
  TeamOutlined,
  BranchesOutlined,
  AimOutlined,
  HistoryOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

type Scenario = 'no-simulation' | 'no-platforms' | 'no-tracks' | 'no-weapons' | 'no-replays' | 'no-data';

interface EmptyStateGuidanceProps {
  scenario: Scenario;
  onAction?: () => void;
}

const scenarioConfig: Record<Scenario, {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
}> = {
  'no-simulation': {
    icon: <RocketOutlined />,
    title: '未启动仿真',
    description: '从左侧面板选择一个想定，然后点击"启动仿真"开始。',
    actionLabel: '选择想定',
  },
  'no-platforms': {
    icon: <TeamOutlined />,
    title: '无平台数据',
    description: '当前仿真中没有可用平台，请检查想定配置。',
    actionLabel: '查看想定',
  },
  'no-tracks': {
    icon: <BranchesOutlined />,
    title: '无航迹数据',
    description: '尚未接收到航迹信息，确认仿真已启动且传感器正常工作。',
    actionLabel: '查看传感器',
  },
  'no-weapons': {
    icon: <AimOutlined />,
    title: '无武器状态',
    description: '当前没有武器交战记录，请确认想定中配置了武器系统。',
    actionLabel: '查看想定',
  },
  'no-replays': {
    icon: <HistoryOutlined />,
    title: '无回放记录',
    description: '尚未保存任何仿真回放，完成一次仿真后将自动生成回放数据。',
    actionLabel: '开始仿真',
  },
  'no-data': {
    icon: <DatabaseOutlined />,
    title: '暂无数据',
    description: '当前没有可显示的数据，请稍后重试或检查连接状态。',
    actionLabel: '刷新',
  },
};

const EmptyStateGuidance: React.FC<EmptyStateGuidanceProps> = ({ scenario, onAction }) => {
  const config = scenarioConfig[scenario];

  return (
    <Empty
      image={
        <span
          style={{
            fontSize: 48,
            color: '#30363d',
            display: 'block',
            marginBottom: 8,
          }}
        >
          {config.icon}
        </span>
      }
      description={
        <div>
          <div style={{ color: '#e6edf3', fontWeight: 500, marginBottom: 4 }}>
            {config.title}
          </div>
          <div style={{ color: '#8b949e', fontSize: 13 }}>
            {config.description}
          </div>
        </div>
      }
    >
      {onAction && config.actionLabel && (
        <Button type="primary" size="small" onClick={onAction}>
          {config.actionLabel}
        </Button>
      )}
    </Empty>
  );
};

export default EmptyStateGuidance;
