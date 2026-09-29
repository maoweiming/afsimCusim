/**
 * ScenarioPlugin - 想定管理
 * 想定文件的浏览、上传、编辑
 * 仅 admin 和 operator 角色可访问
 */
import { lazy } from 'react';
import { FileTextOutlined } from '@ant-design/icons';
import type { PluginContribution } from '../core/plugin/types';
import { BasePlugin } from './BasePlugin';

// ============ Lazy 页面组件 ============

const ScenarioListPage = lazy(() => import('../pages/ScenarioListPage'));
const ScenarioEditorPage = lazy(() => import('../pages/ScenarioEditorPage'));

// ============ 插件定义 ============

export class ScenarioPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'scenario',
      name: '想定管理',
      version: '1.0.0',
      description: '想定文件的浏览、上传、编辑',
      author: 'TrueSim',
      allowedRoles: ['admin', 'operator'],
      icon: 'FileTextOutlined',
    });
  }

  protected buildContribution(): PluginContribution {
    return {
      routes: [
        {
          path: '/scenarios',
          component: ScenarioListPage,
          requiresAuth: true,
        },
        {
          path: '/scenario/:id',
          component: ScenarioEditorPage,
          requiresAuth: true,
        },
      ],
      navItems: [
        {
          key: 'scenario',
          label: '想定管理',
          icon: <FileTextOutlined />,
          order: 3,
        },
      ],
    };
  }
}

export default ScenarioPlugin;
