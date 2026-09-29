import { useSimStore } from '../../store/simStore';
import { formatSimTime } from '../../utils/cesiumUtils';

const PHASE_LABELS: Record<string, string> = {
  running: '运行中',
  paused: '已暂停',
  complete: '已完成',
  idle: '空闲',
};

export function TimeDisplay() {
  const simTime = useSimStore((s) => s.simTime);
  const clockRate = useSimStore((s) => s.clockRate);
  const phase = useSimStore((s) => s.phase);

  return (
    <div className="time-display">
      <div className="time-row">
        <span className="time-label">仿真时间</span>
        <span className="time-value">{formatSimTime(simTime)}</span>
      </div>
      <div className="time-row">
        <span className="time-label">时钟速率</span>
        <span className="time-value">
          {clockRate < 0 ? '最大速率' : `${clockRate}x`}
        </span>
      </div>
      <div className="time-row">
        <span className="time-label">仿真状态</span>
        <span className={`time-value state-${phase}`}>
          {PHASE_LABELS[phase] ?? phase}
        </span>
      </div>
    </div>
  );
}
