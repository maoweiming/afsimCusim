/**
 * DataCenterPlugin - 数据中心
 * 仿真数据的存储、查询与生命周期管理
 * 仅 admin 和 analyst 角色可访问
 */
import { lazy } from 'react';
import { DatabaseOutlined } from '@ant-design/icons';
import type { PluginContribution } from '../core/plugin/types';
import { BasePlugin } from './BasePlugin';

// ============ Lazy 页面组件 ============

const DataCenterPage = lazy(() => import('../pages/DataCenterPage'));

// ============ 插件定义 ============

export class DataCenterPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'data-center',
      name: '数据中心',
      version: '1.0.0',
      description: '仿真数据的存储、查询与生命周期管理',
      author: 'TrueSim',
      allowedRoles: ['admin', 'analyst'],
      icon: 'DatabaseOutlined',
    });
  }

  protected buildContribution(): PluginContribution {
    return {
      routes: [
        {
          path: '/datacenter',
          component: DataCenterPage,
          requiresAuth: true,
        },
      ],
      navItems: [
        {
          key: 'data-center',
          label: '数据中心',
          icon: <DatabaseOutlined />,
          order: 5,
        },
      ],
    };
  }
}

export default DataCenterPlugin;
