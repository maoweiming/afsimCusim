/**
 * App - 应用根组件
 * 门户化路由：/login（登录）+ /portal（门户首页）+ /module/*（功能模块）
 */
import { lazy, Suspense, useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppLayout } from './components/Layout/AppLayout';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { PageErrorBoundary } from './components/Monitoring/PageErrorBoundary';
import { PluginProvider } from './core/plugin/PluginContext';
import { ThemeApplier } from './shared/components/ThemeApplier';
import { useThemeStore } from './store/themeStore';
import { getThemeById } from './shared/theme/themes';
import { useAuthStore } from './modules/user/store/userStore';

const PageLoading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0d1117' }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

// 登录页
const LoginPage = lazy(() => import('./pages/LoginPage'));

// 门户首页
const PortalPage = lazy(() => import('./pages/PortalPage'));

// 模块页面
const EquipmentModule = lazy(() => import('./pages/modules/EquipmentModule'));
const SimulationModule = lazy(() => import('./pages/modules/SimulationModule'));
const ScenarioModule = lazy(() => import('./pages/modules/ScenarioModule'));
const AnalysisModule = lazy(() => import('./pages/modules/AnalysisModule'));
const AdminModule = lazy(() => import('./pages/modules/AdminModule'));

// ============ 路由守卫 ============

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);

  if (loading) return <PageLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ============ 路由 ============

function AppRoutes() {
  return (
    <Routes>
      {/* 登录页 */}
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageLoading />}>
            <LoginPage />
          </Suspense>
        }
      />

      {/* 门户首页 */}
      <Route
        path="/portal"
        element={
          <RequireAuth>
            <Suspense fallback={<PageLoading />}>
              <PortalPage />
            </Suspense>
          </RequireAuth>
        }
      />

      {/* 功能模块 */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route
          path="/module/equipment"
          element={
            <PageErrorBoundary page="装备数据管理">
              <Suspense fallback={<PageLoading />}>
                <EquipmentModule />
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="/module/simulation"
          element={
            <PageErrorBoundary page="仿真运行">
              <Suspense fallback={<PageLoading />}>
                <SimulationModule />
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="/module/scenario/*"
          element={
            <PageErrorBoundary page="想定编辑">
              <Suspense fallback={<PageLoading />}>
                <ScenarioModule />
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="/module/analysis"
          element={
            <PageErrorBoundary page="数据分析">
              <Suspense fallback={<PageLoading />}>
                <AnalysisModule />
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="/module/admin/*"
          element={
            <PageErrorBoundary page="系统管理">
              <Suspense fallback={<PageLoading />}>
                <AdminModule />
              </Suspense>
            </PageErrorBoundary>
          }
        />
      </Route>

      {/* 默认重定向 */}
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}

// ============ App Root ============

export default function App() {
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const antdTheme = useMemo(() => getThemeById(activeThemeId).antdTheme, [activeThemeId]);

  // Restore auth session on mount
  const restoreSession = useAuthStore((s) => s.restoreSession);
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <ConfigProvider theme={antdTheme} locale={zhCN}>
      <AntApp>
        <ThemeApplier />
        <ErrorBoundary>
          <PluginProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </PluginProvider>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}
