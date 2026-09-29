/**
 * PortalPage - 门户首页，按角色展示可访问模块
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DatabaseOutlined,
  GlobalOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { Button, Space, Tag, Typography } from 'antd';
import { useAuthStore } from '../modules/user/store/userStore';
import { DEFAULT_PERMISSIONS, SYSTEM_ROLE_COLORS, SYSTEM_ROLE_LABELS } from '../modules/user/types';

const MODULE_CARDS = [
  {
    id: 'equipment',
    title: '装备数据管理',
    description: '装备 CRUD、版本管理与分类维护',
    path: '/module/equipment',
    icon: <DatabaseOutlined />,
    features: ['装备库维护', '版本锁定', '分类树浏览'],
  },
  {
    id: 'simulation',
    title: '仿真运行',
    description: '3D 态势显示、仿真控制与实时事件流',
    path: '/module/simulation',
    icon: <GlobalOutlined />,
    features: ['CesiumJS 三维地球', 'WebSocket 实时数据', '仿真控制面板'],
  },
  {
    id: 'scenario',
    title: '想定编辑',
    description: '想定创建、地图编辑与平台部署',
    path: '/module/scenario',
    icon: <FileTextOutlined />,
    features: ['想定 CRUD', '地图编辑器', '装备引用锁定'],
  },
  {
    id: 'analysis',
    title: '数据分析',
    description: '仿真回放、统计分析与数据生命周期',
    path: '/module/analysis',
    icon: <BarChartOutlined />,
    features: ['回放控制', '武器统计', '数据导出'],
  },
  {
    id: 'admin-setting',
    title: '系统管理',
    description: '用户管理、角色权限与系统配置',
    path: '/module/admin',
    icon: <SettingOutlined />,
    features: ['用户 CRUD', '分组管理', '权限配置'],
  },
] as const;

export default function PortalPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const allowedModules = useMemo(() => {
    if (!currentUser) return new Set<string>();
    const perm = DEFAULT_PERMISSIONS.find((p) => p.role === currentUser.role);
    return new Set(perm?.modules ?? []);
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="portal-page">
      <div className="portal-header">
        <Typography.Title className="portal-title">TrueSim</Typography.Title>
        <Typography.Paragraph className="portal-subtitle">
          欢迎，{currentUser?.displayName ?? '用户'}
          {currentUser && (
            <Tag color={SYSTEM_ROLE_COLORS[currentUser.role]} style={{ marginLeft: 8 }}>
              {SYSTEM_ROLE_LABELS[currentUser.role]}
            </Tag>
          )}
        </Typography.Paragraph>
        <Space style={{ marginTop: 16 }}>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </Space>
      </div>

      <div className="portal-grid">
        {MODULE_CARDS.map((card) => {
          const enabled = allowedModules.has(card.id);
          return (
            <div
              key={card.id}
              className={`portal-card${enabled ? '' : ' portal-card--disabled'}`}
              onClick={() => enabled && navigate(card.path)}
              role="button"
              tabIndex={enabled ? 0 : -1}
              onKeyDown={(e) => e.key === 'Enter' && enabled && navigate(card.path)}
            >
              <div className="portal-card-icon">{card.icon}</div>
              <h3 className="portal-card-title">{card.title}</h3>
              <p className="portal-card-desc">{card.description}</p>
              <ul className="portal-card-features">
                {card.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {!enabled && (
                <div className="portal-card-lock-hint">
                  <LockOutlined /> 当前角色无访问权限
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
