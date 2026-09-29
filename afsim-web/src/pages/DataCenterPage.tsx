import { Suspense, lazy } from 'react';
import { Spin } from 'antd';

const DataDashboard = lazy(() => import('../modules/data-center').then(m => ({ default: m.DataDashboard })));
const DataLifecycle = lazy(() => import('../modules/data-center').then(m => ({ default: m.DataLifecycle })));
const DataVersion = lazy(() => import('../modules/data-center').then(m => ({ default: m.DataVersion })));
const DataExport = lazy(() => import('../modules/data-center').then(m => ({ default: m.DataExport })));

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
);

export default function DataCenterPage() {
  return (
    <main className="module-page">
      <Suspense fallback={<Loading />}>
        <div className="datacenter-layout">
          <DataDashboard />
          <div className="datacenter-panels">
            <DataLifecycle />
            <DataVersion />
            <DataExport />
          </div>
        </div>
      </Suspense>
    </main>
  );
}
