import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Card,
  Slider,
  Button,
  Space,
  Typography,
  Tag,
  Select,
  DatePicker,
  Tooltip,
  Divider,
  List,
  Badge,
  Spin,
  Alert,
  message,
  Descriptions,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  FastForwardOutlined,
  FastBackwardOutlined,
  StepForwardOutlined,
  StepBackwardOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  AimOutlined,
  WarningOutlined,
  FileTextOutlined,
  HistoryOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { listReplays, type ReplaySession as ApiReplaySession } from '../../../api/replayApi';

const { Text, Title } = Typography;

// ============ 类型定义 ============

type PlaybackSpeed = 0.5 | 1 | 2 | 5 | 10;

interface KeyEvent {
  id: string;
  time: number; // 仿真秒
  type: 'weapon_fired' | 'weapon_hit' | 'detection' | 'damage' | 'state_change' | 'custom';
  label: string;
  description: string;
}

// UI-level replay session (derived from API data)
interface ReplaySessionUI {
  id: string;
  name: string;
  scenarioName: string;
  startTime: string;
  duration: number; // 仿真秒
  eventCount: number;
}

/** Convert an API ReplaySession to the UI shape */
function toUISession(api: ApiReplaySession): ReplaySessionUI {
  const durationSec = Math.max(0, (api.end_time - api.start_time) / 1000);
  return {
    id: api.id,
    name: api.simulation_id || api.id,
    scenarioName: api.scenario_id || '未知想定',
    startTime: api.created_at || new Date(api.start_time).toISOString(),
    duration: durationSec > 0 ? durationSec : 0,
    eventCount: api.frame_count ?? 0,
  };
}

const mockKeyEvents: KeyEvent[] = [
  {
    id: 'ke-001',
    time: 120,
    type: 'detection',
    label: '首次检测',
    description: '蓝方雷达首次检测到红方编队',
  },
  {
    id: 'ke-002',
    time: 300,
    type: 'weapon_fired',
    label: '首轮发射',
    description: 'F-22 Alpha 发射 AIM-120 x2',
  },
  {
    id: 'ke-003',
    time: 450,
    type: 'weapon_hit',
    label: '首次命中',
    description: 'AIM-120 命中 Su-35 Red-2',
  },
  {
    id: 'ke-004',
    time: 600,
    type: 'damage',
    label: '平台损伤',
    description: 'USS Arleigh Burke 损伤 15%',
  },
  {
    id: 'ke-005',
    time: 900,
    type: 'state_change',
    label: '阶段转换',
    description: '仿真进入第二阶段：远程打击',
  },
  {
    id: 'ke-006',
    time: 1200,
    type: 'weapon_fired',
    label: '导弹齐射',
    description: 'H-6K 发射 YJ-12 x6',
  },
  {
    id: 'ke-007',
    time: 1800,
    type: 'weapon_hit',
    label: '目标摧毁',
    description: 'YJ-12 命中目标，目标损毁',
  },
  {
    id: 'ke-008',
    time: 2400,
    type: 'state_change',
    label: '阶段转换',
    description: '仿真进入第三阶段：近距格斗',
  },
  {
    id: 'ke-009',
    time: 3000,
    type: 'detection',
    label: '新目标出现',
    description: '检测到红方增援编队',
  },
  {
    id: 'ke-010',
    time: 3600,
    type: 'state_change',
    label: '仿真结束',
    description: '仿真运行结束',
  },
];

// ============ 辅助函数 ============

function formatSimTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function eventIcon(type: KeyEvent['type']) {
  const map: Record<KeyEvent['type'], React.ReactNode> = {
    weapon_fired: <RocketOutlined style={{ color: '#ff4d4f' }} />,
    weapon_hit: <ThunderboltOutlined style={{ color: '#faad14' }} />,
    detection: <AimOutlined style={{ color: '#1890ff' }} />,
    damage: <WarningOutlined style={{ color: '#ff4d4f' }} />,
    state_change: <FileTextOutlined style={{ color: '#722ed1' }} />,
    custom: <ClockCircleOutlined style={{ color: '#888' }} />,
  };
  return map[type];
}

function eventColor(type: KeyEvent['type']): string {
  const map: Record<KeyEvent['type'], string> = {
    weapon_fired: '#ff4d4f',
    weapon_hit: '#faad14',
    detection: '#1890ff',
    damage: '#ff4d4f',
    state_change: '#722ed1',
    custom: '#888',
  };
  return map[type];
}

// ============ 主组件 ============

export default function ReplayControl() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // API-driven replay sessions
  const [replaySessions, setReplaySessions] = useState<ReplaySessionUI[]>([]);
  const [loadingReplays, setLoadingReplays] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  // Fetch replay sessions on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingReplays(true);
    setReplayError(null);
    listReplays()
      .then((apiSessions) => {
        if (cancelled) return;
        const uiSessions = apiSessions.map(toUISession);
        setReplaySessions(uiSessions);
        if (uiSessions.length === 0) {
          setReplayError('暂无回放数据');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setReplayError(`加载回放列表失败: ${msg}`);
        // Fall back to empty list — UI still works
        setReplaySessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingReplays(false);
      });
    return () => { cancelled = true; };
  }, []);

  const session = useMemo(
    () => replaySessions.find((s) => s.id === selectedSession) ?? null,
    [replaySessions, selectedSession]
  );

  const totalDuration = session?.duration ?? 0;

  // 播放控制
  const startPlayback = useCallback(() => {
    if (!session) return;
    setIsPlaying(true);
    playIntervalRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + playbackSpeed;
        if (next >= totalDuration) {
          setIsPlaying(false);
          if (playIntervalRef.current) clearInterval(playIntervalRef.current);
          return totalDuration;
        }
        return next;
      });
    }, 1000);
  }, [session, playbackSpeed, totalDuration]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, startPlayback, stopPlayback]);

  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      setPlaybackSpeed(speed);
      if (isPlaying) {
        stopPlayback();
        // Restart with new speed after a tick
        setTimeout(() => startPlayback(), 50);
      }
    },
    [isPlaying, stopPlayback, startPlayback]
  );

  const stepForward = useCallback(() => {
    stopPlayback();
    setCurrentTime((prev) => Math.min(prev + 10, totalDuration));
  }, [stopPlayback, totalDuration]);

  const stepBackward = useCallback(() => {
    stopPlayback();
    setCurrentTime((prev) => Math.max(prev - 10, 0));
  }, [stopPlayback]);

  const handleReset = useCallback(() => {
    stopPlayback();
    setCurrentTime(0);
  }, [stopPlayback]);

  const handleGoToEvent = useCallback(
    (time: number) => {
      stopPlayback();
      setCurrentTime(time);
    },
    [stopPlayback]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, []);

  // 速度选项
  const speedOptions: PlaybackSpeed[] = [0.5, 1, 2, 5, 10];

  // 当前时间标记的关键事件
  const nearbyEvents = useMemo(() => {
    return mockKeyEvents.filter(
      (e) => Math.abs(e.time - currentTime) < 30
    );
  }, [currentTime]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* 回放数据选择 */}
      <Card size="small" title="回放数据" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
        {replayError && (
          <Alert
            message={replayError}
            type="warning"
            showIcon
            closable
            onClose={() => setReplayError(null)}
            style={{ marginBottom: 8 }}
          />
        )}
        <Select
          style={{ width: '100%' }}
          placeholder={loadingReplays ? '加载中...' : '选择回放数据'}
          value={selectedSession}
          onChange={(v) => {
            setSelectedSession(v);
            setCurrentTime(0);
            stopPlayback();
          }}
          allowClear
          loading={loadingReplays}
          notFoundContent={loadingReplays ? <Spin size="small" /> : '暂无回放数据'}
          options={replaySessions.map((s) => ({
            value: s.id,
            label: (
              <Space>
                <HistoryOutlined />
                <span>{s.name}</span>
                <Tag>{formatSimTime(s.duration)}</Tag>
              </Space>
            ),
          }))}
        />
        {session && (
          <Descriptions size="small" column={2} style={{ marginTop: 8 }} labelStyle={{ color: 'var(--text-secondary)' }}>
            <Descriptions.Item label="想定">{session.scenarioName}</Descriptions.Item>
            <Descriptions.Item label="时长">{formatSimTime(session.duration)}</Descriptions.Item>
            <Descriptions.Item label="事件数">{session.eventCount}</Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {new Date(session.startTime).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      {session && (
        <>
          {/* 时间轴 */}
          <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'monospace', color: '#4fc3f7', fontSize: 16 }}>
                {formatSimTime(currentTime)}
              </Text>
              <Text type="secondary" style={{ fontFamily: 'monospace' }}>
                {formatSimTime(totalDuration)}
              </Text>
            </div>
            <Slider
              min={0}
              max={totalDuration}
              value={currentTime}
              onChange={setCurrentTime}
              tooltip={{ formatter: (v) => formatSimTime(v ?? 0) }}
              styles={{
                track: { background: '#0078d7' },
                handle: { borderColor: '#0078d7' },
              }}
            />

            {/* 关键事件标记 */}
            <div style={{ position: 'relative', height: 20, marginTop: -8 }}>
              {mockKeyEvents.map((event) => (
                <Tooltip key={event.id} title={`${formatSimTime(event.time)} - ${event.label}`}>
                  <div
                    style={{
                      position: 'absolute',
                      left: `${(event.time / totalDuration) * 100}%`,
                      top: 0,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: eventColor(event.type),
                      cursor: 'pointer',
                      transform: 'translateX(-3px)',
                    }}
                    onClick={() => handleGoToEvent(event.time)}
                  />
                </Tooltip>
              ))}
            </div>
          </Card>

          {/* 播放控制按钮 */}
          <Card size="small" bordered={false} style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <Tooltip title="重置">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                />
              </Tooltip>
              <Tooltip title="后退 10s">
                <Button
                  icon={<StepBackwardOutlined />}
                  onClick={stepBackward}
                />
              </Tooltip>
              <Tooltip title={isPlaying ? '暂停' : '播放'}>
                <Button
                  type="primary"
                  icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={togglePlayback}
                  style={{ width: 80 }}
                >
                  {isPlaying ? '暂停' : '播放'}
                </Button>
              </Tooltip>
              <Tooltip title="前进 10s">
                <Button
                  icon={<StepForwardOutlined />}
                  onClick={stepForward}
                />
              </Tooltip>
            </div>

            {/* 速度控制 */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>速度：</Text>
              {speedOptions.map((speed) => (
                <Button
                  key={speed}
                  size="small"
                  type={playbackSpeed === speed ? 'primary' : 'default'}
                  onClick={() => handleSpeedChange(speed)}
                  style={{ minWidth: 40 }}
                >
                  {speed}x
                </Button>
              ))}
            </div>
          </Card>

          {/* 关键事件列表 */}
          <Card
            size="small"
            title={
              <Space>
                <ClockCircleOutlined />
                <span>关键事件</span>
                <Tag>{mockKeyEvents.length} 个</Tag>
              </Space>
            }
            bordered={false}
            style={{ background: 'var(--bg-secondary)', flex: 1, overflow: 'auto' }}
            bodyStyle={{ padding: 0 }}
          >
            <List
              size="small"
              dataSource={mockKeyEvents}
              renderItem={(event) => (
                <List.Item
                  style={{
                    padding: '6px 12px',
                    cursor: 'pointer',
                    background: nearbyEvents.includes(event) ? '#1e2a3a' : undefined,
                    borderLeft: `3px solid ${eventColor(event.type)}`,
                  }}
                  onClick={() => handleGoToEvent(event.time)}
                >
                  <Space size={8}>
                    {eventIcon(event.type)}
                    <div>
                      <Space size={4}>
                        <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#4fc3f7' }}>
                          {formatSimTime(event.time)}
                        </Text>
                        <Text strong style={{ fontSize: 12 }}>{event.label}</Text>
                      </Space>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>{event.description}</Text>
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </>
      )}

      {/* 未选择提示 */}
      {!session && (
        <Card
          size="small"
          bordered={false}
          style={{
            background: 'var(--bg-secondary)',
            textAlign: 'center',
            padding: 60,
          }}
        >
          <Space direction="vertical" size={8}>
            <HistoryOutlined style={{ fontSize: 48, color: 'var(--border-color)' }} />
            <Text type="secondary">请选择回放数据以开始回放</Text>
          </Space>
        </Card>
      )}
    </div>
  );
}
