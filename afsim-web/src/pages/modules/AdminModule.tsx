/**
 * AdminModule - 系统管理模块
 */
import { Suspense } from 'react';
import { Spin } from 'antd';
import { UserManagement } from '../../modules/user';

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
);

export default function AdminModule() {
  return (
    <div className="module-container">
      <div className="module-body">
        <Suspense fallback={<Loading />}>
          <UserManagement />
        </Suspense>
      </div>
    </div>
  );
}
