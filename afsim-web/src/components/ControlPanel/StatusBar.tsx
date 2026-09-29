import { useSimStore } from '../../store/simStore';

export function StatusBar() {
  const connected = useSimStore((s) => s.connected);
  const phase = useSimStore((s) => s.phase);
  const simulationId = useSimStore((s) => s.simulationId);

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
        <span className="status-text">
          {connected ? '已连接' : '未连接'}
        </span>
      </div>
      <div className="status-item">
        <span className={`status-dot state-${phase}`} />
        <span className="status-text">
          {simulationId ? `仿真: ${simulationId.slice(0, 8)}` : '无仿真任务'}
        </span>
      </div>
    </div>
  );
}
