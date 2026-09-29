import { useEffect, type CSSProperties } from 'react';
import { Tooltip, ConfigProvider, theme } from 'antd';
import { useWsHealthStore } from '../../store/wsHealthStore';

interface WsHealthIndicatorProps {
  onClick?: () => void;
}

const PULSE_KEYFRAMES = `
@keyframes ws-pulse {
  0% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.5); }
  70% { box-shadow: 0 0 0 6px rgba(82, 196, 26, 0); }
  100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
}
`;

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function WsHealthIndicator({ onClick }: WsHealthIndicatorProps) {
  const metrics = useWsHealthStore((s) => s.metrics);

  useEffect(() => {
    if (!document.getElementById('ws-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'ws-pulse-style';
      style.textContent = PULSE_KEYFRAMES;
      document.head.appendChild(style);
    }
  }, []);

  const { connected, latencyMs, messageRate } = metrics;

  // Determine dot color
  let dotColor: string;
  if (!connected) {
    dotColor = '#ff4d4f';
  } else if (latencyMs >= 100) {
    dotColor = '#faad14';
  } else {
    dotColor = '#52c41a';
  }

  const isPulsing = messageRate > 0;

  const dotStyle: CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: dotColor,
    display: 'inline-block',
    flexShrink: 0,
    animation: isPulsing ? 'ws-pulse 1.5s infinite' : undefined,
    cursor: onClick ? 'pointer' : undefined,
  };

  const latencyTextStyle: CSSProperties = {
    fontSize: 11,
    color: '#8b949e',
    marginLeft: 4,
    lineHeight: 1,
  };

  const tooltipContent = (
    <div style={{ fontSize: 12, lineHeight: 1.8 }}>
      <div>
        <span style={{ color: '#8b949e' }}>状态: </span>
        <span style={{ color: connected ? '#52c41a' : '#ff4d4f' }}>
          {connected ? '已连接' : '未连接'}
        </span>
      </div>
      <div>
        <span style={{ color: '#8b949e' }}>延迟: </span>
        <span>{latencyMs}ms</span>
      </div>
      <div>
        <span style={{ color: '#8b949e' }}>消息速率: </span>
        <span>{messageRate} msg/s</span>
      </div>
      <div>
        <span style={{ color: '#8b949e' }}>重连次数: </span>
        <span>
          {metrics.reconnectAttempts} / {metrics.maxReconnectAttempts}
        </span>
      </div>
      <div>
        <span style={{ color: '#8b949e' }}>在线时长: </span>
        <span>{formatUptime(metrics.connectionUptime)}</span>
      </div>
      <div>
        <span style={{ color: '#8b949e' }}>总消息数: </span>
        <span>{metrics.totalMessages.toLocaleString()}</span>
      </div>
      <div>
        <span style={{ color: '#8b949e' }}>丢弃消息: </span>
        <span style={{ color: metrics.droppedMessages > 0 ? '#ff4d4f' : undefined }}>
          {metrics.droppedMessages.toLocaleString()}
        </span>
      </div>
      {metrics.lastError && (
        <div style={{ color: '#ff4d4f', marginTop: 4, fontSize: 11 }}>
          最后错误: {metrics.lastError}
        </div>
      )}
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgElevated: '#1c2128',
          colorText: '#e6edf3',
        },
      }}
    >
      <Tooltip title={tooltipContent} placement="bottomRight" arrow={false}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 30,
            padding: '0 8px',
          }}
          onClick={onClick}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onKeyDown={
            onClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') onClick();
                }
              : undefined
          }
          aria-label="WebSocket health status"
        >
          <span style={dotStyle} />
          {connected && (
            <span style={latencyTextStyle}>{latencyMs}ms</span>
          )}
        </div>
      </Tooltip>
    </ConfigProvider>
  );
}
