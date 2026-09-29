/**
 * AppLayout - 模块内布局
 * Header（自适应）+ Outlet（各模块自定义内容）
 */
import { useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Space, Tag, Dropdown, Avatar, message } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Header } from './Header';
import { useAuthStore } from '../../modules/user/store/userStore';
import { useHelpStore } from '../../store/helpStore';
import { SYSTEM_ROLE_LABELS, SYSTEM_ROLE_COLORS } from '../../modules/user/types';

const OnboardingTour = lazy(() => import('../Help/OnboardingTour').then((m) => ({ default: m.OnboardingTour })));
const KeyboardShortcuts = lazy(() => import('../Help/KeyboardShortcuts').then((m) => ({ default: m.KeyboardShortcuts })));
const HelpDrawer = lazy(() => import('../Help/HelpDrawer').then((m) => ({ default: m.HelpDrawer })));

const MODULE_TITLE_MAP: Record<string, string> = {
  '/module/equipment': '装备数据管理',
  '/module/simulation': '仿真运行',
  '/module/scenario': '想定编辑',
  '/module/analysis': '数据分析',
  '/module/admin': '系统管理',
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  // Detect module title from current path
  const moduleTitle = useMemo(() => {
    const path = location.pathname;
    for (const [prefix, title] of Object.entries(MODULE_TITLE_MAP)) {
      if (path.startsWith(prefix)) return title;
    }
    return undefined;
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    await logout();
    message.success('已退出登录');
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Global keyboard shortcuts
  const hasCompletedOnboarding = useHelpStore((s) => s.hasCompletedOnboarding);
  const toggleKeyboardShortcuts = useHelpStore((s) => s.toggleKeyboardShortcuts);
  const toggleHelpDrawer = useHelpStore((s) => s.toggleHelpDrawer);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      switch (e.key) {
        case '?':
          e.preventDefault();
          toggleKeyboardShortcuts();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          toggleHelpDrawer();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleKeyboardShortcuts, toggleHelpDrawer]);

  // User menu
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'info',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600 }}>{currentUser?.displayName}</div>
          <div style={{ fontSize: 11, color: '#8b949e' }}>{currentUser?.email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    ...(currentUser?.role === 'admin' ? [{
      key: 'admin',
      label: '用户管理',
      icon: <SettingOutlined />,
      onClick: () => navigate('/module/admin'),
    }] : []),
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  // User info as header action
  const userActions = (
    <Space size={12}>
      {currentUser && (
        <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
          <Space size={8} style={{ cursor: 'pointer' }}>
            <Avatar size={24} icon={<UserOutlined />} style={{ backgroundColor: '#0078d7' }} />
            <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{currentUser.displayName}</span>
            <Tag color={SYSTEM_ROLE_COLORS[currentUser.role]} style={{ margin: 0, fontSize: 11 }}>
              {SYSTEM_ROLE_LABELS[currentUser.role]}
            </Tag>
          </Space>
        </Dropdown>
      )}
    </Space>
  );

  return (
    <div className="app">
      <Header moduleTitle={moduleTitle} moduleActions={userActions} />
      <div className="app-body">
        <Outlet />
      </div>

      {/* Help system components */}
      <Suspense fallback={null}>
        {!hasCompletedOnboarding && <OnboardingTour />}
        <KeyboardShortcuts />
        <HelpDrawer />
      </Suspense>
    </div>
  );
}
