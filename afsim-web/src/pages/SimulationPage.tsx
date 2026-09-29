/**
 * SimulationPage - 仿真态势页面
 * 左侧：场景控制 + 仿真组件（指挥链/回放/威胁/AI）
 * 中间：3D 地球
 * 右侧：平台详情 + 传感器/武器/航迹/电子战 + 事件日志 + 图层控制
 */
import { useOutletContext } from 'react-router-dom';
import GlobeView from '../components/Globe/GlobeView';
import SimControls from '../components/ControlPanel/SimControls';
import { ScenarioList } from '../components/ScenarioPanel/ScenarioList';
import { ScenarioUpload } from '../components/ScenarioPanel/ScenarioUpload';
import EventLog from '../components/Timeline/EventLog';
import { Sidebar } from '../components/Layout/Sidebar';
import { useActiveContributions } from '../core/plugin/PluginContext';
import SimulationSidebar from '../modules/simulation/components/SimulationSidebar';

interface LayoutContext {
  leftOpen: boolean;
  rightOpen: boolean;
}

export default function SimulationPage() {
  const context = useOutletContext<LayoutContext | null>();
  const leftOpen = context?.leftOpen ?? true;
  const rightOpen = context?.rightOpen ?? true;
  const contributions = useActiveContributions();

  // 获取插件贡献的侧边栏面板
  const leftPanels = (contributions.sidebarPanels ?? []).filter((p) => p.side === 'left');
  const rightPanels = (contributions.sidebarPanels ?? []).filter((p) => p.side === 'right');

  return (
    <>
      <Sidebar side="left" open={leftOpen}>
        <ScenarioList />
        <ScenarioUpload />
        <SimControls />
        <SimulationSidebar side="left" />
        {/* 插件贡献的左侧面板 */}
        {leftPanels.map((panel) => {
          const PanelComponent = panel.component;
          return (
            <div key={panel.id} style={{ marginTop: 16 }}>
              <PanelComponent />
            </div>
          );
        })}
      </Sidebar>
      <main className="app-main">
        <GlobeView />
      </main>
      <Sidebar side="right" open={rightOpen}>
        <SimulationSidebar side="right" />
        <EventLog />
        {/* 插件贡献的右侧面板（含图层控制） */}
        {rightPanels.map((panel) => {
          const PanelComponent = panel.component;
          return (
            <div key={panel.id} style={{ marginTop: 16 }}>
              <PanelComponent />
            </div>
          );
        })}
      </Sidebar>
    </>
  );
}
