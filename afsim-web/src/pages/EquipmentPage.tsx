import { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const EquipmentList = lazy(() => import('../modules/equipment').then(m => ({ default: m.EquipmentList })));
const EquipmentDetail = lazy(() => import('../modules/equipment').then(m => ({ default: m.EquipmentDetail })));
const EquipmentEditor = lazy(() => import('../modules/equipment').then(m => ({ default: m.EquipmentEditor })));

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
);

export default function EquipmentPage() {
  return (
    <main className="module-page">
      <Suspense fallback={<Loading />}>
        <div className="module-sidebar">
          <EquipmentList />
        </div>
        <div className="module-content">
          <EquipmentDetail />
          <EquipmentEditor />
        </div>
      </Suspense>
    </main>
  );
}
