/**
 * SimControls - Enhanced simulation control panel
 * 对齐 AFSIM 控制能力：时钟速率滑块、步进模式、状态指示器
 */
import { useCallback, useMemo } from 'react';
import { Button, Slider, Space, Tag, Tooltip, Typography, Divider, Segmented } from 'antd';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  StepForwardOutlined,
  StopOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useSimStore } from '../../store/simStore';
import { pauseSim, resumeSim, stepSim, setClockRate, terminateSim } from '../../api/client';
import { getWebSocket } from '../../api/websocket';

const { Text } = Typography;

const CLOCK_RATE_PRESETS = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100];
const QUICK_RATES = [0.5, 1, 2, 5, 10];

type StepMode = 'event' | 'frame';

export default function SimControls() {
  const phase = useSimStore((s) => s.phase);
  const simTime = useSimStore((s) => s.simTime);
  const clockRate = useSimStore((s) => s.clockRate);
  const simulationId = useSimStore((s) => s.simulationId);
  const setClockRateLocal = useSimStore((s) => s.setClockRate);

  const isActive = phase === 'running' || phase === 'paused';
  const isRunning = phase === 'running';
  const isPaused = phase === 'paused';

  const handlePause = useCallback(async () => {
    if (!simulationId) return;
    try { await pauseSim(simulationId); } catch (e) { console.error(e); }
  }, [simulationId]);

  const handleResume = useCallback(async () => {
    if (!simulationId) return;
    try { await resumeSim(simulationId); } catch (e) { console.error(e); }
  }, [simulationId]);

  const handleStep = useCallback(async () => {
    if (!simulationId) return;
    try { await stepSim(simulationId); } catch (e) { console.error(e); }
  }, [simulationId]);

  const handleTerminate = useCallback(async () => {
    if (!simulationId) return;
    try { await terminateSim(simulationId); } catch (e) { console.error(e); }
    // The gateway deletes the simulation on terminate, so the WS connection
    // drops from the server side. Close it intentionally to skip the
    // reconnect-retry loop, and reset local state back to idle.
    getWebSocket()?.close();
    useSimStore.getState().reset();
  }, [simulationId]);

  const handleClockRateChange = useCallback(async (rate: number) => {
    setClockRateLocal(rate);
    if (!simulationId) return;
    try { await setClockRate(simulationId, rate); } catch (e) { console.error(e); }
  }, [simulationId, setClockRateLocal]);

  // Phase status config
  const phaseConfig = useMemo(() => {
    switch (phase) {
      case 'running': return { color: '#4caf50', icon: <PlayCircleOutlined />, label: '运行中' };
      case 'paused': return { color: '#ff9800', icon: <PauseCircleOutlined />, label: '已暂停' };
      case 'complete': return { color: '#666', icon: <StopOutlined />, label: '已完成' };
      default: return { color: '#333', icon: <ClockCircleOutlined />, label: '就绪' };
    }
  }, [phase]);

  // Find nearest preset for slider marks
  const sliderMarks = useMemo(() => {
    const marks: Record<number, string> = {};
    QUICK_RATES.forEach((r) => { marks[r] = `${r}x`; });
    return marks;
  }, []);

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ---- Status + Time ---- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={8}>
          <Tag
            icon={phaseConfig.icon}
            color={phaseConfig.color}
            style={{ margin: 0, fontSize: 12 }}
          >
            {phaseConfig.label}
          </Tag>
          {simulationId && (
            <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace' }}>
              {simulationId.slice(0, 8)}
            </Text>
          )}
        </Space>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 20, color: '#4fc3f7', lineHeight: 1 }}>
            {formatTime(simTime)}
          </div>
          <Text type="secondary" style={{ fontSize: 10 }}>
            仿真时间
          </Text>
        </div>
      </div>

      {/* ---- Playback Controls ---- */}
      <div style={{ display: 'flex', gap: 4 }}>
        {isRunning && (
          <Tooltip title="暂停仿真">
            <Button
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={handlePause}
              style={{ flex: 1 }}
            >
              暂停
            </Button>
          </Tooltip>
        )}
        {isPaused && (
          <Tooltip title="继续仿真">
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleResume}
              style={{ flex: 1 }}
            >
              继续
            </Button>
          </Tooltip>
        )}
        {isActive && (
          <>
            <Tooltip title="单步执行">
              <Button
                size="small"
                icon={<StepForwardOutlined />}
                onClick={handleStep}
              >
                步进
              </Button>
            </Tooltip>
            <Tooltip title="终止仿真">
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={handleTerminate}
              >
                终止
              </Button>
            </Tooltip>
          </>
        )}
        {!isActive && phase === 'idle' && (
          <Text type="secondary" style={{ fontSize: 12, padding: '4px 0' }}>
            请选择场景并启动仿真
          </Text>
        )}
      </div>

      {/* ---- Step Mode ---- */}
      {isActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>步进模式:</Text>
          <Segmented
            size="small"
            options={[
              { label: '事件步进', value: 'event' },
              { label: '帧步进', value: 'frame' },
            ]}
            defaultValue="event"
            style={{ fontSize: 11 }}
          />
        </div>
      )}

      <Divider style={{ margin: '4px 0', borderColor: '#30363d' }} />

      {/* ---- Clock Rate ---- */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Space size={4}>
            <ThunderboltOutlined style={{ color: '#8b949e', fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>时钟速率</Text>
          </Space>
          <Tag color="blue" style={{ margin: 0, fontFamily: 'monospace', fontSize: 11 }}>
            {clockRate}x
          </Tag>
        </div>

        <Slider
          min={0.1}
          max={100}
          step={null}
          value={clockRate}
          onChange={handleClockRateChange}
          marks={sliderMarks}
          tooltip={{ formatter: (v) => `${v}x` }}
          styles={{
            track: { background: '#1668dc' },
            handle: { borderColor: '#1668dc' },
          }}
        />

        {/* Quick rate buttons */}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {QUICK_RATES.map((rate) => (
            <Button
              key={rate}
              size="small"
              type={clockRate === rate ? 'primary' : 'default'}
              onClick={() => handleClockRateChange(rate)}
              style={{
                flex: 1,
                fontSize: 11,
                padding: '0 4px',
                height: 22,
              }}
            >
              {rate}x
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ----

function formatTime(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
