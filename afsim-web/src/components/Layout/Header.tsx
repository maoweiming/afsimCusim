import { useState, lazy, Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, Dropdown, Button } from 'antd';
import { QuestionCircleOutlined, BgColorsOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { WsHealthIndicator } from '../Monitoring/WsHealthIndicator';
import { useHelpStore } from '../../store/helpStore';
import { useThemeStore } from '../../store/themeStore';
import { THEME_PRESETS, getThemeById } from '../../shared/theme/themes';

const ErrorDashboard = lazy(() =>
  import('../Monitoring/ErrorDashboard').then((m) => ({ default: m.ErrorDashboard }))
);

interface HeaderProps {
  moduleTitle?: string;
  moduleActions?: React.ReactNode;
}

export function Header({ moduleTitle, moduleActions }: HeaderProps) {
  const navigate = useNavigate();
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const toggleHelpDrawer = useHelpStore((s) => s.toggleHelpDrawer);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const activePreset = useMemo(() => getThemeById(activeThemeId), [activeThemeId]);

  const themeItems: MenuProps['items'] = THEME_PRESETS.map((t) => ({
    key: t.id,
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: t.accentColor,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />
        <span>{t.name}</span>
        <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 4 }}>{t.description}</span>
      </span>
    ),
    onClick: () => setTheme(t.id),
  }));

  return (
    <header className="app-header">
      <div className="header-left">
        {moduleTitle ? (
          <>
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/portal')}
              style={{ color: 'var(--text-secondary)' }}
            >
              门户
            </Button>
            <span className="header-divider" />
            <h1 className="app-title">{moduleTitle}</h1>
          </>
        ) : (
          <h1 className="app-title">TrueSim 仿真平台</h1>
        )}
      </div>

      <div className="header-center">
        {moduleActions}
      </div>

      <div className="header-right">
        <WsHealthIndicator onClick={() => setDashboardOpen(true)} />
        <Dropdown menu={{ items: themeItems }} trigger={['click']} placement="bottomRight">
          <Tooltip title="界面主题">
            <button className="btn btn-icon" title="界面主题" style={{ fontSize: 14, position: 'relative' }}>
              <BgColorsOutlined />
              <span
                style={{
                  position: 'absolute',
                  bottom: 3,
                  right: 3,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: activePreset?.accentColor ?? '#0078d7',
                }}
              />
            </button>
          </Tooltip>
        </Dropdown>
        <Tooltip title="帮助 (H)">
          <button
            className="btn btn-icon"
            onClick={toggleHelpDrawer}
            title="帮助"
            style={{ fontSize: 16 }}
          >
            <QuestionCircleOutlined />
          </button>
        </Tooltip>
      </div>

      <Suspense fallback={null}>
        <ErrorDashboard open={dashboardOpen} onClose={() => setDashboardOpen(false)} />
      </Suspense>
    </header>
  );
}
