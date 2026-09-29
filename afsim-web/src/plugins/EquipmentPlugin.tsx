/**
 * EquipmentPlugin - 装备管理
 * 装备型号库的维护与查询
 * 仅 admin 和 operator 角色可访问
 */
import { lazy } from 'react';
import { ToolOutlined } from '@ant-design/icons';
import type { PluginContribution } from '../core/plugin/types';
import { BasePlugin } from './BasePlugin';

// ============ Lazy 页面组件 ============

const EquipmentPage = lazy(() => import('../pages/EquipmentPage'));

// ============ 插件定义 ============

export class EquipmentPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'equipment',
      name: '装备管理',
      version: '1.0.0',
      description: '装备型号库的维护与查询',
      author: 'TrueSim',
      allowedRoles: ['admin', 'operator'],
      icon: 'ToolOutlined',
    });
  }

  protected buildContribution(): PluginContribution {
    return {
      routes: [
        {
          path: '/equipment',
          component: EquipmentPage,
          requiresAuth: true,
        },
      ],
      navItems: [
        {
          key: 'equipment',
          label: '装备管理',
          icon: <ToolOutlined />,
          order: 4,
        },
      ],
    };
  }
}

export default EquipmentPlugin;
