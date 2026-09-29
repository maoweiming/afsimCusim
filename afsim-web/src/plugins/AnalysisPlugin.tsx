/**
 * AnalysisPlugin - 地形分析
 * 地形剖面、通视分析、坡度坡向等空间分析工具
 * 仅 admin 和 analyst 角色可访问
 */
import { type ComponentType } from 'react';
import { AreaChartOutlined } from '@ant-design/icons';
import type { PluginContribution } from '../core/plugin/types';
import { BasePlugin } from './BasePlugin';

// ============ 分析工具面板（占位组件，待 Phase 4 实现） ============

const AnalysisPanel: ComponentType = () => (
  <div style={{ padding: 16 }}>
    <h4>地形分析工具</h4>
    <p style={{ color: '#999', fontSize: 12 }}>剖面分析 / 通视分析 / 坡度分析</p>
  </div>
);

// ============ 插件定义 ============

export class AnalysisPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'analysis',
      name: '地形分析',
      version: '1.0.0',
      description: '地形剖面、通视分析、坡度坡向等空间分析工具',
      author: 'TrueSim',
      allowedRoles: ['admin', 'analyst'],
      icon: 'AreaChartOutlined',
    });
  }

  protected buildContribution(): PluginContribution {
    return {
      navItems: [
        {
          key: 'analysis',
          label: '地形分析',
          icon: <AreaChartOutlined />,
          order: 6,
        },
      ],
      sidebarPanels: [
        {
          id: 'analysis-panel',
          title: '分析工具',
          side: 'left',
          order: 1,
          component: AnalysisPanel,
          collapsible: true,
          defaultCollapsed: true,
        },
      ],
    };
  }
}

export default AnalysisPlugin;
