import { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';

const ScenarioList = lazy(() => import('../modules/scenario').then(m => ({ default: m.ScenarioList })));

export default function ScenarioListPage() {
  const navigate = useNavigate();

  return (
    <div className="module-container">
      <div className="module-body">
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>}>
          <ScenarioList onEditScenario={(id) => navigate(`/module/scenario/${id}`)} />
        </Suspense>
      </div>
    </div>
  );
}
