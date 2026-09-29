/**
 * EngagementTimeline - Displays weapon engagement events as a timeline
 * Reads from useWeaponStore and useEventStore
 */
import { useMemo } from 'react';
import { Timeline, Typography, Empty, Tag, Space } from 'antd';
import { useWeaponStore } from '../../../store/weaponStore';
import { useEventStore } from '../../../store/eventStore';
import type { SimEvent } from '../../../store/eventStore';

const { Text } = Typography;

// ============ Kill chain phase detection ============

interface TimelineEvent {
  id: string;
  time: number;
  phase: 'engage' | 'hit' | 'miss';
  label: string;
  message: string;
  weaponName?: string;
  color: string;
}

const PHASE_CONFIG = {
  engage: { color: '#1890ff', label: '发射' },
  hit: { color: '#52c41a', label: '命中' },
  miss: { color: '#ff4d4f', label: '脱靶' },
} as const;

function classifyEvent(evt: SimEvent): TimelineEvent | null {
  const tags = evt.tags ?? [];

  if (tags.includes('weapon_fire')) {
    return {
      id: evt.id,
      time: evt.timestamp,
      phase: 'engage',
      label: PHASE_CONFIG.engage.label,
      message: evt.message,
      color: PHASE_CONFIG.engage.color,
    };
  }
  if (tags.includes('weapon_hit')) {
    return {
      id: evt.id,
      time: evt.timestamp,
      phase: 'hit',
      label: PHASE_CONFIG.hit.label,
      message: evt.message,
      color: PHASE_CONFIG.hit.color,
    };
  }
  if (tags.includes('weapon_miss')) {
    return {
      id: evt.id,
      time: evt.timestamp,
      phase: 'miss',
      label: PHASE_CONFIG.miss.label,
      message: evt.message,
      color: PHASE_CONFIG.miss.color,
    };
  }

  return null;
}

function formatSimTime(time: number): string {
  const totalSec = Math.floor(time);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ============ Main Component ============

export default function EngagementTimeline() {
  const weapons = useWeaponStore((s) => s.weapons);
  const queryEvents = useEventStore((s) => s.query);
  const events = useEventStore((s) => s.events);

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    // Query weapon-category events from the new event store
    const weaponEvents: TimelineEvent[] = [];
    const weaponEvts = queryEvents({ categories: ['weapon'] });

    for (const evt of weaponEvts) {
      const te = classifyEvent(evt);
      if (te) {
        weaponEvents.push(te);
      }
    }

    // Also derive events from current weapon states
    const seenPhases = new Set(weaponEvents.map((e) => e.phase));

    // If we have active weapons but no "fired" events in log, synthesize from store
    if (!seenPhases.has('engage') && weapons.size > 0) {
      weapons.forEach((w) => {
        const alreadyLogged = weaponEvents.some(
          (e) => e.message.includes(w.weapon_name) || e.message.includes(`#${w.weapon_platform_index}`),
        );
        if (!alreadyLogged) {
          weaponEvents.push({
            id: `synth-${w.weapon_platform_index}`,
            time: 0,
            phase: 'engage',
            label: PHASE_CONFIG.engage.label,
            message: `${w.weapon_name} 发射 (平台 #${w.firing_platform_index} → 目标 #${w.target_platform_index})`,
            weaponName: w.weapon_name,
            color: PHASE_CONFIG.engage.color,
          });

          if (w.hit === true) {
            weaponEvents.push({
              id: `synth-hit-${w.weapon_platform_index}`,
              time: 0,
              phase: 'hit',
              label: PHASE_CONFIG.hit.label,
              message: `${w.weapon_name} 命中目标 #${w.target_platform_index}`,
              weaponName: w.weapon_name,
              color: PHASE_CONFIG.hit.color,
            });
          }
        }
      });
    }

    // Sort by time descending (most recent first)
    weaponEvents.sort((a, b) => b.time - a.time);

    return weaponEvents;
  }, [events, weapons, queryEvents]);

  if (timelineEvents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Empty
          description="暂无交战事件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 300, overflow: 'auto', padding: '4px 0' }}>
      <Timeline
        items={timelineEvents.map((evt) => ({
          color: evt.color,
          children: (
            <div key={evt.id}>
              <Space size={6}>
                <Text style={{ color: '#8b949e', fontSize: 11 }}>
                  {evt.time > 0 ? formatSimTime(evt.time) : '--:--'}
                </Text>
                <Tag
                  color={evt.color}
                  style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                >
                  {evt.label}
                </Tag>
              </Space>
              <div>
                <Text
                  style={{ color: '#e6edf3', fontSize: 12 }}
                  ellipsis={{ tooltip: evt.message }}
                >
                  {evt.message}
                </Text>
              </div>
            </div>
          ),
        }))}
      />
    </div>
  );
}
