import { Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';

const ScenarioEditor = lazy(() => import('../modules/scenario').then(m => ({ default: m.ScenarioEditor })));

export default function ScenarioEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <Result
        status="404"
        title="未指定想定"
        subTitle="请从想定列表中选择一个想定"
        extra={<Button type="primary" onClick={() => navigate('/module/scenario')}>返回列表</Button>}
      />
    );
  }

  return (
    <div className="module-container">
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>}>
        <ScenarioEditor scenarioId={id} onBack={() => navigate('/module/scenario')} />
      </Suspense>
    </div>
  );
}
