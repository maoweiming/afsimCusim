import { create } from 'zustand';

export interface WsHealthMetrics {
  connected: boolean;
  latencyMs: number;
  messageRate: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastMessageTime: number;
  lastError: string | null;
  totalMessages: number;
  droppedMessages: number;
  connectionUptime: number;
  connectedAt: number | null;
}

interface WsHealthState {
  metrics: WsHealthMetrics;
  _messageTimestamps: number[];
  _tickInterval: ReturnType<typeof setInterval> | null;

  setConnected: (v: boolean) => void;
  recordLatency: (ms: number) => void;
  recordMessage: () => void;
  recordError: (msg: string) => void;
  recordDropped: () => void;
  setReconnectInfo: (attempts: number, max: number) => void;
  startTicking: () => void;
  stopTicking: () => void;
}

export const useWsHealthStore = create<WsHealthState>((set, get) => ({
  metrics: {
    connected: false,
    latencyMs: 0,
    messageRate: 0,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    lastMessageTime: 0,
    lastError: null,
    totalMessages: 0,
    droppedMessages: 0,
    connectionUptime: 0,
    connectedAt: null,
  },
  _messageTimestamps: [],
  _tickInterval: null,

  setConnected: (v) =>
    set((state) => ({
      metrics: {
        ...state.metrics,
        connected: v,
        connectedAt: v ? Date.now() : null,
        connectionUptime: 0,
        reconnectAttempts: v ? 0 : state.metrics.reconnectAttempts,
      },
    })),

  recordLatency: (ms) =>
    set((state) => ({
      metrics: { ...state.metrics, latencyMs: ms },
    })),

  recordMessage: () => {
    const now = Date.now();
    set((state) => {
      const timestamps = [...state._messageTimestamps, now].filter((t) => now - t < 5000);
      return {
        metrics: {
          ...state.metrics,
          lastMessageTime: now,
          totalMessages: state.metrics.totalMessages + 1,
          messageRate: Math.round((timestamps.length / 5) * 10) / 10,
        },
        _messageTimestamps: timestamps,
      };
    });
  },

  recordError: (msg) =>
    set((state) => ({
      metrics: { ...state.metrics, lastError: msg },
    })),

  recordDropped: () =>
    set((state) => ({
      metrics: { ...state.metrics, droppedMessages: state.metrics.droppedMessages + 1 },
    })),

  setReconnectInfo: (attempts, max) =>
    set((state) => ({
      metrics: { ...state.metrics, reconnectAttempts: attempts, maxReconnectAttempts: max },
    })),

  startTicking: () => {
    const existing = get()._tickInterval;
    if (existing) return;
    const interval = setInterval(() => {
      set((state) => ({
        metrics: {
          ...state.metrics,
          connectionUptime: state.metrics.connectedAt
            ? Math.floor((Date.now() - state.metrics.connectedAt) / 1000)
            : 0,
        },
      }));
    }, 1000);
    set({ _tickInterval: interval });
  },

  stopTicking: () => {
    const interval = get()._tickInterval;
    if (interval) clearInterval(interval);
    set({ _tickInterval: null });
  },
}));
