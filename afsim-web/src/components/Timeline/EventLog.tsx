/**
 * EventLog - 增强事件日志面板
 * 支持结构化事件、高级过滤、持久化、导出
 */
import { useMemo, useState, useCallback } from 'react'
import { Input, Button, Space, Tag, Tooltip, Select, Badge, Typography, Collapse } from 'antd'
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  AimOutlined,
  WifiOutlined,
  BranchesOutlined,
  DownloadOutlined,
  DeleteOutlined,
  SaveOutlined,
  DatabaseOutlined,
  SearchOutlined,
  FilterOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  SettingOutlined,
  CloudOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import {
  useEventStore,
  CATEGORY_COLORS,
  SEVERITY_COLORS,
  EVENT_CATEGORY_LABELS,
  EVENT_SEVERITY_LABELS,
  type SimEvent,
  type EventCategory,
  type EventSeverity,
} from '../../store/eventStore'

const { Text } = Typography

// ---------- constants ----------

const CATEGORY_ICONS: Record<EventCategory, React.ReactNode> = {
  simulation: <ClockCircleOutlined />,
  platform: <EnvironmentOutlined />,
  weapon: <AimOutlined />,
  sensor: <WifiOutlined />,
  track: <BranchesOutlined />,
  communication: <ApiOutlined />,
  system: <SettingOutlined />,
  environment: <CloudOutlined />,
  ai: <RobotOutlined />,
}

const SEVERITY_ORDER: EventSeverity[] = ['critical', 'error', 'warning', 'info', 'debug']

// ---------- helpers ----------

function formatTime(t: number): string {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// ---------- component ----------

interface EventLogProps {
  maxHeight?: string
}

export default function EventLog({ maxHeight = '400px' }: EventLogProps) {
  const events = useEventStore((s) => s.events)
  const clear = useEventStore((s) => s.clear)
  const queryEvents = useEventStore((s) => s.query)
  const exportJSON = useEventStore((s) => s.exportJSON)
  const exportCSV = useEventStore((s) => s.exportCSV)
  const persistToIDB = useEventStore((s) => s.persistToIDB)
  const loadFromIDB = useEventStore((s) => s.loadFromIDB)
  const getStats = useEventStore((s) => s.getStats)

  // filter state
  const [enabledCategories, setEnabledCategories] = useState<Set<EventCategory>>(
    () => new Set(Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]),
  )
  const [enabledSeverities, setEnabledSeverities] = useState<Set<EventSeverity>>(
    () => new Set(SEVERITY_ORDER),
  )
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showStats, setShowStats] = useState(false)

  const toggleCategory = (cat: EventCategory) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const toggleSeverity = (sev: EventSeverity) => {
    setEnabledSeverities((prev) => {
      const next = new Set(prev)
      if (next.has(sev)) next.delete(sev); else next.add(sev)
      return next
    })
  }

  // filtered events
  const filtered = useMemo(() => {
    return queryEvents({
      categories: Array.from(enabledCategories),
      severities: Array.from(enabledSeverities),
      searchText: search || undefined,
    })
  }, [events, enabledCategories, enabledSeverities, search, queryEvents])

  const stats = useMemo(() => getStats(), [events, getStats])

  const filtersActive =
    enabledCategories.size < Object.keys(EVENT_CATEGORY_LABELS).length ||
    enabledSeverities.size < SEVERITY_ORDER.length ||
    search.trim() !== ''

  const handleExportCSV = useCallback(() => {
    const csv = exportCSV({
      categories: Array.from(enabledCategories),
      severities: Array.from(enabledSeverities),
      searchText: search || undefined,
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [exportCSV, enabledCategories, enabledSeverities, search])

  const handleExportJSON = useCallback(() => {
    const json = exportJSON({
      categories: Array.from(enabledCategories),
      severities: Array.from(enabledSeverities),
    })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [exportJSON, enabledCategories, enabledSeverities])

  // ------- render -------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '4px 8px', borderBottom: '1px solid #30363d', fontSize: 12, color: '#8b949e', flexShrink: 0,
        }}
      >
        <span>
          事件日志{' '}
          {filtersActive ? (
            <span style={{ color: '#58a6ff' }}>显示 {filtered.length} / 共 {events.length} 条</span>
          ) : (
            <span>({events.length})</span>
          )}
          {stats.eventsPerSecond > 0 && (
            <span style={{ marginLeft: 8, color: '#484f58' }}>{stats.eventsPerSecond} evt/s</span>
          )}
        </span>
        <Space size={4}>
          <Tooltip title="保存到 IndexedDB">
            <Button type="text" size="small" icon={<SaveOutlined />} onClick={persistToIDB} style={{ color: '#8b949e' }} />
          </Tooltip>
          <Tooltip title="从 IndexedDB 加载">
            <Button type="text" size="small" icon={<DatabaseOutlined />} onClick={() => loadFromIDB()} style={{ color: '#8b949e' }} />
          </Tooltip>
          <Tooltip title="导出 CSV">
            <Button type="text" size="small" icon={<DownloadOutlined />} disabled={filtered.length === 0} onClick={handleExportCSV} style={{ color: '#8b949e' }} />
          </Tooltip>
          <Tooltip title="导出 JSON">
            <Button type="text" size="small" icon={<ThunderboltOutlined />} disabled={filtered.length === 0} onClick={handleExportJSON} style={{ color: '#8b949e' }} />
          </Tooltip>
          <Tooltip title="清空">
            <Button type="text" size="small" icon={<DeleteOutlined />} onClick={clear} style={{ color: '#8b949e' }} />
          </Tooltip>
        </Space>
      </div>

      {/* filters */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #30363d', flexShrink: 0 }}>
        <Input.Search
          placeholder="搜索事件..."
          size="small" allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={setSearch}
          style={{ marginBottom: 4 }}
        />

        {/* category chips */}
        <Space size={[4, 4]} wrap style={{ marginBottom: 4 }}>
          {(Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]).map((cat) => {
            const active = enabledCategories.has(cat)
            const color = CATEGORY_COLORS[cat]
            return (
              <Tag
                key={cat}
                onClick={() => toggleCategory(cat)}
                style={{
                  cursor: 'pointer',
                  background: active ? `${color}22` : 'transparent',
                  borderColor: active ? color : '#30363d',
                  color: active ? color : '#484f58',
                  fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0, userSelect: 'none',
                }}
              >
                {CATEGORY_ICONS[cat]} {EVENT_CATEGORY_LABELS[cat]}
              </Tag>
            )
          })}
        </Space>

        {/* severity chips */}
        <Space size={[4, 4]} wrap>
          {SEVERITY_ORDER.map((sev) => {
            const active = enabledSeverities.has(sev)
            const color = SEVERITY_COLORS[sev]
            return (
              <Tag
                key={sev}
                onClick={() => toggleSeverity(sev)}
                style={{
                  cursor: 'pointer',
                  background: active ? `${color}22` : 'transparent',
                  borderColor: active ? color : '#30363d',
                  color: active ? color : '#484f58',
                  fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0, userSelect: 'none',
                }}
              >
                {EVENT_SEVERITY_LABELS[sev]}
              </Tag>
            )
          })}
        </Space>
      </div>

      {/* event list */}
      <div style={{ overflowY: 'auto', maxHeight, fontFamily: 'monospace', fontSize: 11, padding: 4 }}>
        {filtered.length === 0 && (
          <div style={{ color: '#484f58', padding: 8 }}>
            {events.length === 0 ? '暂无事件' : '无匹配事件'}
          </div>
        )}
        {filtered.map((evt) => {
          const catColor = CATEGORY_COLORS[evt.category]
          const sevColor = SEVERITY_COLORS[evt.severity]
          const isExpanded = expandedId === evt.id

          return (
            <div key={evt.id} style={{ borderBottom: '1px solid #161b22' }}>
              <div
                style={{
                  padding: '2px 4px', display: 'flex', alignItems: 'baseline', gap: 6,
                  cursor: (evt.entityRefs?.length || evt.payload) ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (evt.entityRefs?.length || evt.payload) {
                    setExpandedId(isExpanded ? null : evt.id)
                  }
                }}
              >
                <span style={{ color: '#484f58', flexShrink: 0 }}>[{formatTime(evt.timestamp)}]</span>
                <span style={{ color: catColor, flexShrink: 0, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {CATEGORY_ICONS[evt.category]}
                </span>
                {evt.severity !== 'info' && (
                  <Badge color={sevColor} style={{ flexShrink: 0 }} />
                )}
                <span style={{ color: '#e6edf3' }}>{evt.message}</span>
              </div>
              {isExpanded && (
                <div style={{ padding: '4px 8px 6px 30px', fontSize: 10, color: '#8b949e' }}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        来源: {evt.source} | 分类: {EVENT_CATEGORY_LABELS[evt.category]} | 级别: {EVENT_SEVERITY_LABELS[evt.severity]}
                      </Text>
                    </div>
                    {evt.entityRefs && evt.entityRefs.length > 0 && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 10 }}>关联实体: </Text>
                        {evt.entityRefs.map((ref, i) => (
                          <Tag key={i} style={{ fontSize: 9, padding: '0 3px', margin: '0 2px' }}>
                            {ref.type}#{ref.index}{ref.name ? `(${ref.name})` : ''}
                          </Tag>
                        ))}
                      </div>
                    )}
                    {evt.payload && (
                      <pre style={{
                        margin: 0, padding: 4, borderRadius: 4, fontSize: 10, lineHeight: 1.4,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflow: 'auto',
                      }}>
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    )}
                    {evt.tags && evt.tags.length > 0 && (
                      <div>
                        {evt.tags.map((tag) => (
                          <Tag key={tag} style={{ fontSize: 9, padding: '0 3px', margin: '0 2px' }}>{tag}</Tag>
                        ))}
                      </div>
                    )}
                  </Space>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
