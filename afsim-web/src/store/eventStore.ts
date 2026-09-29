/**
 * 结构化事件存储
 * 替代 simStore.ts 中的 useEventLogStore
 * 支持分类、严重级别、实体关联、持久化、高级查询
 */
import { create } from 'zustand';
import { eventDB } from '../core/storage/IndexedDBStore';

// ============ Types ============

export type EventCategory = 'simulation' | 'platform' | 'weapon' | 'sensor' | 'track'
  | 'communication' | 'system' | 'environment' | 'ai';

export type EventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface SimEvent {
  id: string;
  timestamp: number;         // sim_time
  wallTime: number;          // Date.now()
  category: EventCategory;
  severity: EventSeverity;
  message: string;
  entityRefs?: Array<{
    type: 'platform' | 'weapon' | 'track' | 'sensor';
    index: number;
    name?: string;
  }>;
  payload?: Record<string, unknown>;
  source: 'websocket' | 'client' | 'system';
  tags?: string[];
  simId?: string;            // 关联的仿真 ID
}

export interface EventQuery {
  timeRange?: [number, number];
  wallTimeRange?: [number, number];
  categories?: EventCategory[];
  severities?: EventSeverity[];
  entityIndex?: number;
  searchText?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface EventStats {
  total: number;
  byCategory: Record<EventCategory, number>;
  bySeverity: Record<EventSeverity, number>;
  eventsPerSecond: number;
  timeRange: [number, number];
}

// ============ Constants ============

const MAX_EVENTS = 5000;

const CATEGORY_LABELS: Record<EventCategory, string> = {
  simulation: '仿真', platform: '平台', weapon: '武器', sensor: '传感器',
  track: '航迹', communication: '通信', system: '系统', environment: '环境', ai: 'AI',
};

const SEVERITY_LABELS: Record<EventSeverity, string> = {
  debug: '调试', info: '信息', warning: '警告', error: '错误', critical: '严重',
};

export const EVENT_CATEGORY_LABELS = CATEGORY_LABELS;
export const EVENT_SEVERITY_LABELS = SEVERITY_LABELS;

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  simulation: '#4fc3f7', platform: '#81c784', weapon: '#ef5350', sensor: '#ffb74d',
  track: '#00bcd4', communication: '#ab47bc', system: '#78909c', environment: '#26a69a', ai: '#ffa726',
};

export const SEVERITY_COLORS: Record<EventSeverity, string> = {
  debug: '#616161', info: '#4fc3f7', warning: '#ffb74d', error: '#ef5350', critical: '#d32f2f',
};

// ============ ID Generator ============

let idCounter = 0;
function nextId(): string {
  return `evt-${Date.now()}-${++idCounter}`;
}

// ============ Store ============

interface EventState {
  events: SimEvent[];
  maxEvents: number;

  addEvent: (event: Omit<SimEvent, 'id' | 'wallTime'>) => void;
  query: (query: EventQuery) => SimEvent[];
  clear: () => void;

  // 持久化
  persistToIDB: () => Promise<void>;
  loadFromIDB: (simId?: string) => Promise<void>;

  // 导出
  exportJSON: (query?: EventQuery) => string;
  exportCSV: (query?: EventQuery) => string;

  // 统计
  getStats: () => EventStats;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  maxEvents: MAX_EVENTS,

  addEvent: (event) => {
    const fullEvent: SimEvent = {
      ...event,
      id: nextId(),
      wallTime: Date.now(),
    };

    set((state) => {
      const events = [...state.events, fullEvent];
      // FIFO eviction
      if (events.length > state.maxEvents) {
        return { events: events.slice(events.length - state.maxEvents) };
      }
      return { events };
    });
  },

  query: (query) => {
    const { events } = get();
    let filtered = events;

    if (query.timeRange) {
      const [min, max] = query.timeRange;
      filtered = filtered.filter((e) => e.timestamp >= min && e.timestamp <= max);
    }
    if (query.wallTimeRange) {
      const [min, max] = query.wallTimeRange;
      filtered = filtered.filter((e) => e.wallTime >= min && e.wallTime <= max);
    }
    if (query.categories?.length) {
      const cats = new Set(query.categories);
      filtered = filtered.filter((e) => cats.has(e.category));
    }
    if (query.severities?.length) {
      const sevs = new Set(query.severities);
      filtered = filtered.filter((e) => sevs.has(e.severity));
    }
    if (query.entityIndex !== undefined) {
      filtered = filtered.filter((e) => e.entityRefs?.some((r) => r.index === query.entityIndex));
    }
    if (query.searchText) {
      const lower = query.searchText.toLowerCase();
      filtered = filtered.filter((e) => e.message.toLowerCase().includes(lower));
    }
    if (query.tags?.length) {
      const tagSet = new Set(query.tags);
      filtered = filtered.filter((e) => e.tags?.some((t) => tagSet.has(t)));
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const offset = query.offset ?? 0;
    const limit = query.limit ?? filtered.length;
    return filtered.slice(offset, offset + limit);
  },

  clear: () => set({ events: [] }),

  persistToIDB: async () => {
    const { events } = get();
    try {
      await eventDB.putBatch('events', events);
    } catch (err) {
      console.error('[EventStore] Failed to persist:', err);
    }
  },

  loadFromIDB: async (simId) => {
    try {
      let events: SimEvent[];
      if (simId) {
        events = await eventDB.query<SimEvent>('events', 'simId', IDBKeyRange.only(simId));
      } else {
        events = await eventDB.getAll<SimEvent>('events');
      }
      events.sort((a, b) => a.timestamp - b.timestamp);
      set({ events: events.slice(-MAX_EVENTS) });
    } catch (err) {
      console.error('[EventStore] Failed to load:', err);
    }
  },

  exportJSON: (query) => {
    const events = query ? get().query(query) : get().events;
    return JSON.stringify(events, null, 2);
  },

  exportCSV: (query) => {
    const events = query ? get().query(query) : get().events;
    const headers = ['id', 'timestamp', 'wallTime', 'category', 'severity', 'message', 'source', 'tags'];
    const rows = events.map((e) => [
      e.id,
      e.timestamp.toFixed(3),
      new Date(e.wallTime).toISOString(),
      e.category,
      e.severity,
      `"${e.message.replace(/"/g, '""')}"`,
      e.source,
      (e.tags ?? []).join(';'),
    ]);
    return '﻿' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  getStats: () => {
    const { events } = get();
    const byCategory = {} as Record<EventCategory, number>;
    const bySeverity = {} as Record<EventSeverity, number>;

    for (const cat of Object.keys(CATEGORY_LABELS)) byCategory[cat as EventCategory] = 0;
    for (const sev of Object.keys(SEVERITY_LABELS)) bySeverity[sev as EventSeverity] = 0;

    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const e of events) {
      byCategory[e.category]++;
      bySeverity[e.severity]++;
      if (e.timestamp < minTime) minTime = e.timestamp;
      if (e.timestamp > maxTime) maxTime = e.timestamp;
    }

    const duration = maxTime - minTime;
    const eventsPerSecond = duration > 0 ? Math.round((events.length / duration) * 10) / 10 : 0;

    return {
      total: events.length,
      byCategory,
      bySeverity,
      eventsPerSecond,
      timeRange: [minTime === Infinity ? 0 : minTime, maxTime === -Infinity ? 0 : maxTime],
    };
  },
}));
