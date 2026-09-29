/**
 * OnboardingTour - 新手引导 Tour
 * 使用 antd Tour 组件，5 步引导新用户了解界面布局
 */
import { Tour } from 'antd';
import { useHelpStore } from '../../store/helpStore';

export const OnboardingTour: React.FC = () => {
  const hasCompletedOnboarding = useHelpStore((s) => s.hasCompletedOnboarding);
  const completeOnboarding = useHelpStore((s) => s.completeOnboarding);

  const steps = [
    {
      title: '导航栏',
      description: '在仿真态势、装备管理、想定编辑等页面之间切换。右上角可切换角色。',
      target: () => document.querySelector('.app-nav') as HTMLElement,
    },
    {
      title: '左侧面板',
      description: '选择想定、控制仿真播放、查看指挥链和回放数据。',
      target: () => document.querySelector('.sidebar-left') as HTMLElement,
    },
    {
      title: '3D 地球',
      description: '实时显示平台位置、航迹、传感器波束和武器交战。',
      target: () => document.querySelector('.app-main') as HTMLElement,
    },
    {
      title: '右侧面板',
      description: '监控平台状态、传感器/武器、电子战和事件日志。',
      target: () => document.querySelector('.sidebar-right') as HTMLElement,
    },
    {
      title: '状态栏',
      description: '显示 WebSocket 连接状态和仿真时间。绿色表示已连接。',
      target: () => document.querySelector('.app-header') as HTMLElement,
    },
  ];

  return (
    <Tour
      steps={steps}
      open={!hasCompletedOnboarding}
      onClose={completeOnboarding}
      indicatorsRender={(current, total) => (
        <span style={{ color: '#e6edf3', fontSize: 12 }}>
          {current + 1} / {total}
        </span>
      )}
      styles={{
        description: { color: '#8b949e' },
      }}
    />
  );
};

export default OnboardingTour;
