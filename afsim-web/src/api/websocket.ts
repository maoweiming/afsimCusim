import { useSimStore } from '../store/simStore'
import { usePlatformStore } from '../store/platformStore'
import { useTrackStore } from '../store/trackStore'
import { useWeaponStore } from '../store/weaponStore'
import { useWsHealthStore } from '../store/wsHealthStore'
import { useErrorStore } from '../store/errorStore'
import { useWezStore } from '../store/wezStore'
import { useThreatStore } from '../store/threatStore'
import { useAiStore } from '../store/aiStore'
import { useEventStore } from '../store/eventStore'
import { useEnvironmentStore } from '../store/environmentStore'
import { useSimMetricsStore } from '../store/simMetricsStore'
import { useCoverageStore } from '../store/coverageStore'
import type { EventCategory, EventSeverity } from '../store/eventStore'
import type { MissionStatus } from '../store/platformStore'
import type { TrackData } from './types'

const MISSION_TYPES: MissionStatus['type'][] = ['patrol', 'strike', 'escort', 'recon', 'cargo', 'cap', 'cas']

/** Map an AFSIM task_type string to the frontend mission type enum (fallback: patrol). */
function mapTaskTypeToMissionType(taskType: string | undefined): MissionStatus['type'] {
  const t = (taskType ?? '').toLowerCase() as MissionStatus['type']
  return MISSION_TYPES.includes(t) ? t : 'patrol'
}

/** Convert gateway snapshot mission state ({task_type, status: assigned|completed|canceled}) to MissionStatus. */
function missionFromSnapshot(m: any): MissionStatus {
  const status: MissionStatus['status'] =
    m.status === 'completed' ? 'completed' : m.status === 'canceled' ? 'aborted' : 'en_route'
  return {
    type: mapTaskTypeToMissionType(m.task_type),
    status,
    waypointsRemaining: 0,
    progress: status === 'completed' ? 1 : 0,
  }
}

type MessageHandler = (msg: WSMessage) => void

export interface WSMessage {
  type: string
  sim_time: number
  payload: any
}

class SimulationWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private intentionalClose = false
  private handler?: MessageHandler
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private pingTimestamp = 0

  constructor(url: string) {
    this.url = url
  }

  connect(handler?: MessageHandler) {
    this.handler = handler
    this.intentionalClose = false
    this.doConnect()
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      useSimStore.getState().setConnected(true)
      useWsHealthStore.getState().setConnected(true)
      useWsHealthStore.getState().setReconnectInfo(0, this.maxReconnectAttempts)
      console.log('[WS] Connected to', this.url)

      // Start ping/pong heartbeat
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.pingTimestamp = performance.now()
          this.ws.send(JSON.stringify({ type: 'ping', sim_time: Date.now() / 1000 }))
        }
      }, 10000)
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        useWsHealthStore.getState().recordMessage()
        this.processMessage(msg)
        this.handler?.(msg)
      } catch (e) {
        console.error('[WS] Parse error:', e)
        useErrorStore.getState().addError({
          source: 'websocket',
          severity: 'warning',
          message: 'WebSocket message parse error',
          detail: String(e),
        })
      }
    }

    this.ws.onclose = () => {
      useSimStore.getState().setConnected(false)
      useWsHealthStore.getState().setConnected(false)
      if (this.pingInterval) {
        clearInterval(this.pingInterval)
        this.pingInterval = null
      }
      if (!this.intentionalClose) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      useErrorStore.getState().addError({
        source: 'websocket',
        severity: 'error',
        message: 'WebSocket connection error',
        detail: `URL: ${this.url}`,
      })
    }
  }

  private processMessage(msg: WSMessage) {
    const sim = useSimStore.getState()
    const platforms = usePlatformStore.getState()
    const tracks = useTrackStore.getState()
    const weapons = useWeaponStore.getState()
    const events = useEventStore.getState()
    const metrics = useSimMetricsStore.getState()
    const coverage = useCoverageStore.getState()

    if (msg.sim_time !== undefined) {
      sim.setSimTime(msg.sim_time)
    }

    const t = msg.sim_time
    const p = msg.payload

    switch (msg.type) {
      case 'sim_starting':
      case 'sim_state_changed': {
        const state = p?.state ?? (msg.type === 'sim_starting' ? 'running' : p)
        if (state === 'running') {
          sim.setPhase('running')
          // Reset coverage heatmap at the start of each new simulation
          if (msg.type === 'sim_starting') coverage.clearAll()
        } else if (state === 'paused') sim.setPhase('paused')
        else if (state === 'complete') sim.setPhase('complete')
        else if (state === 'idle') sim.setPhase('idle')
        events.addEvent({ timestamp: t, category: 'simulation', severity: 'info', message: `仿真状态: ${state}`, source: 'websocket', tags: ['sim_state'] })
        break
      }

      case 'sim_complete':
        sim.setPhase('complete')
        events.addEvent({ timestamp: t, category: 'simulation', severity: 'info', message: `仿真完成 t=${t.toFixed(1)}s`, source: 'websocket', tags: ['sim_state'] })
        break

      case 'sim_pausing':
        sim.setPhase('paused')
        events.addEvent({ timestamp: t, category: 'simulation', severity: 'info', message: '仿真暂停', source: 'websocket', tags: ['sim_state'] })
        break

      case 'sim_resuming':
        sim.setPhase('running')
        events.addEvent({ timestamp: t, category: 'simulation', severity: 'info', message: '仿真恢复', source: 'websocket', tags: ['sim_state'] })
        break

      case 'platform_added': {
        // Gateway wraps PlatformAdded inside { platform: {...} }
        const pd = p?.platform ?? p
        if (pd?.index !== undefined) {
          platforms.addPlatform({
            index: pd.index,
            name: pd.name,
            typeId: pd.type_id,
            side: pd.side,
            lat: pd.lat ?? 0,
            lon: pd.lon ?? 0,
            alt: pd.alt ?? 0,
            damageFactor: pd.damage_factor ?? 0,
          })
          metrics.ensurePlatform(pd.index, pd.name, pd.side)
          events.addEvent({
            timestamp: t, category: 'platform', severity: 'info',
            message: `平台加入: ${pd.name} (${pd.side})`,
            entityRefs: [{ type: 'platform', index: pd.index, name: pd.name }],
            source: 'websocket', tags: ['platform_lifecycle'],
          })
        }
        break
      }

      case 'platform_initialized': {
        // Same nesting: { platform: { index, ... } }
        const pd = p?.platform ?? p
        if (pd) {
          platforms.updatePlatform(pd.index, { initialized: true })
        }
        break
      }

      case 'platform_deleted':
      case 'platform_removed':
        if (p) {
          platforms.removePlatform(p.index)
          events.addEvent({
            timestamp: t, category: 'platform', severity: 'info',
            message: `平台移除: ${p.name ?? '#' + p.index}`,
            entityRefs: [{ type: 'platform', index: p.index, name: p.name }],
            source: 'websocket', tags: ['platform_lifecycle'],
          })
        }
        break

      case 'platform_broken':
        if (p) {
          const dmgPct = ((p.damage ?? p.damage_factor ?? 1) * 100).toFixed(0)
          platforms.updatePlatform(p.index, { broken: true, damageFactor: p.damage ?? p.damage_factor ?? 1 })
          metrics.setStatus(p.index, 'destroyed')
          events.addEvent({
            timestamp: t, category: 'platform', severity: 'warning',
            message: `平台损毁: #${p.index} (损伤 ${dmgPct}%)`,
            entityRefs: [{ type: 'platform', index: p.index }],
            payload: { damage: p.damage ?? p.damage_factor },
            source: 'websocket', tags: ['damage'],
          })
        }
        break

      case 'platform_damage_changed':
      case 'damage_update':
        if (p) {
          const idx = p.index ?? p.platform_index
          const dmg = p.damage ?? p.damage_factor ?? 0
          platforms.updatePlatform(idx, { damageFactor: dmg })
          if (dmg > 0) {
            metrics.setStatus(idx, dmg >= 1 ? 'destroyed' : 'damaged')
            events.addEvent({
              timestamp: t, category: 'platform', severity: dmg > 0.5 ? 'warning' : 'info',
              message: `平台 #${idx} 损伤变化: ${(dmg * 100).toFixed(0)}%`,
              entityRefs: [{ type: 'platform', index: idx }],
              payload: { damage: dmg },
              source: 'websocket', tags: ['damage'],
            })
          }
        }
        break

      case 'mover_update':
        if (p) {
          const idx = p.platform_index ?? p.index
          // Gateway serializes WS payloads as proto JSON with `omitempty`, so a
          // zero-valued field (e.g. alt of a sea-level ship) is omitted entirely.
          // Coalesce to 0 so a shallow merge never clobbers a previously-valid
          // value with `undefined` (which crashed createDescription's toFixed).
          const moverUpdates: Record<string, any> = {
            lat: p.lat ?? 0,
            lon: p.lon ?? 0,
            alt: p.alt ?? 0,
            heading: p.heading,
            pitch: p.pitch,
            roll: p.roll,
            velN: p.vel_n,
            velE: p.vel_e,
            velD: p.vel_d,
          }
          // Extract extended status fields if present in payload
          if (p.mission !== undefined) moverUpdates.mission = p.mission
          if (p.combat !== undefined) moverUpdates.combat = p.combat
          if (p.communications !== undefined) moverUpdates.communications = p.communications
          if (p.operational !== undefined) moverUpdates.operational = p.operational
          platforms.updatePlatform(idx, moverUpdates)
          metrics.recordMover(idx, moverUpdates.lat, moverUpdates.lon, moverUpdates.alt, p.vel_n, p.vel_e, p.vel_d)
          // Also update weapon position if this is a weapon platform
          weapons.updateWeaponPosition(idx, p.lat, p.lon, p.alt)
        }
        break

      case 'weapon_fired':
        if (p) {
          weapons.addWeapon({
            weapon_platform_index: p.weapon_platform_index,
            firing_platform_index: p.firing_platform_index,
            weapon_name: p.weapon_name,
            target_platform_index: p.target_platform_index,
            launch_lat: p.launch_lat,
            launch_lon: p.launch_lon,
            launch_alt: p.launch_alt,
          })
          metrics.recordFired(p.weapon_platform_index, p.firing_platform_index, p.target_platform_index, p.weapon_name, t)
          // A platform with an active mission that opens fire is engaging
          const firer = platforms.platforms[p.firing_platform_index]
          if (firer?.mission && firer.mission.status !== 'completed' && firer.mission.status !== 'aborted') {
            platforms.updatePlatform(p.firing_platform_index, {
              mission: { ...firer.mission, status: 'engaging' },
            })
          }
          events.addEvent({
            timestamp: t, category: 'weapon', severity: 'info',
            message: `武器发射: ${p.weapon_name}`,
            entityRefs: [
              { type: 'platform', index: p.firing_platform_index },
              { type: 'weapon', index: p.weapon_platform_index, name: p.weapon_name },
              { type: 'platform', index: p.target_platform_index },
            ],
            payload: { weapon_name: p.weapon_name, target_index: p.target_platform_index },
            source: 'websocket', tags: ['engagement', 'weapon_fire'],
          })
        }
        break

      case 'weapon_hit':
        if (p) {
          weapons.weaponHit(p.weapon_platform_index)
          metrics.resolveEngagement(p.weapon_platform_index, 'hit', t)
          events.addEvent({
            timestamp: t, category: 'weapon', severity: 'warning',
            message: `武器命中: #${p.weapon_platform_index} → #${p.target_platform_index}`,
            entityRefs: [
              { type: 'weapon', index: p.weapon_platform_index },
              { type: 'platform', index: p.target_platform_index },
            ],
            source: 'websocket', tags: ['engagement', 'weapon_hit'],
          })
        }
        break

      case 'weapon_missed':
        if (p) {
          weapons.weaponMissed(p.weapon_platform_index)
          metrics.resolveEngagement(p.weapon_platform_index, 'miss', t)
          events.addEvent({
            timestamp: t, category: 'weapon', severity: 'info',
            message: `武器脱靶: #${p.weapon_platform_index}`,
            entityRefs: [{ type: 'weapon', index: p.weapon_platform_index }],
            source: 'websocket', tags: ['engagement', 'weapon_miss'],
          })
        }
        break

      case 'weapon_terminated':
        if (p) {
          weapons.weaponTerminated(p.weapon_platform_index)
          // Terminated without a recorded hit counts as a miss (no-op if already resolved).
          metrics.resolveEngagement(p.weapon_platform_index, 'miss', t)
        }
        break

      case 'task_assigned': {
        const td = p?.task
        if (td?.assignee_index !== undefined) {
          platforms.updatePlatform(td.assignee_index, {
            mission: {
              type: mapTaskTypeToMissionType(td.task_type),
              status: 'en_route',
              waypointsRemaining: 0,
              progress: 0,
            },
          })
          events.addEvent({
            timestamp: t, category: 'platform', severity: 'info',
            message: `任务分配: ${td.assignee_name ?? '#' + td.assignee_index} ← ${td.task_type}${td.target_name ? ` (目标 ${td.target_name})` : ''}`,
            entityRefs: [{ type: 'platform', index: td.assignee_index, name: td.assignee_name }],
            payload: { task_type: td.task_type, assigner: td.assigner_name, target: td.target_name },
            source: 'websocket', tags: ['task'],
          })
        }
        break
      }

      case 'task_completed': {
        const td = p?.task
        if (td?.assignee_index !== undefined) {
          const plat = platforms.platforms[td.assignee_index]
          if (plat?.mission) {
            platforms.updatePlatform(td.assignee_index, {
              mission: { ...plat.mission, status: 'completed', progress: 1 },
            })
          }
          events.addEvent({
            timestamp: t, category: 'platform', severity: 'info',
            message: `任务完成: ${td.assignee_name ?? '#' + td.assignee_index} — ${td.task_type}${p.status ? ` (${p.status})` : ''}`,
            entityRefs: [{ type: 'platform', index: td.assignee_index, name: td.assignee_name }],
            payload: { task_type: td.task_type, status: p.status },
            source: 'websocket', tags: ['task'],
          })
        }
        break
      }

      case 'task_canceled': {
        const td = p?.task
        if (td?.assignee_index !== undefined) {
          const plat = platforms.platforms[td.assignee_index]
          if (plat?.mission) {
            platforms.updatePlatform(td.assignee_index, {
              mission: { ...plat.mission, status: 'aborted' },
            })
          }
          events.addEvent({
            timestamp: t, category: 'platform', severity: 'warning',
            message: `任务取消: ${td.assignee_name ?? '#' + td.assignee_index} — ${td.task_type}`,
            entityRefs: [{ type: 'platform', index: td.assignee_index, name: td.assignee_name }],
            payload: { task_type: td.task_type },
            source: 'websocket', tags: ['task'],
          })
        }
        break
      }

      case 'sensor_turned_on':
        if (p?.sensor) {
          platforms.updateSensor(p.sensor.platform_index, p.sensor.sensor_name, {
            name: p.sensor.sensor_name,
            type: p.sensor.sensor_type,
            isOn: true,
          })
        }
        break

      case 'sensor_turned_off':
        if (p?.sensor) {
          platforms.updateSensor(p.sensor.platform_index, p.sensor.sensor_name, {
            isOn: false,
          })
        }
        break

      case 'sensor_detection_changed':
      case 'sensor_detection':
        if (p) {
          const det = p.detected ? '发现' : '丢失'
          const sensorPlatformIndex: number = p.sensor?.platform_index ?? 0
          const sensorName = p.sensor?.sensor_name ?? p.sensor_name ?? 'unknown'
          events.addEvent({
            timestamp: t, category: 'sensor', severity: p.detected ? 'info' : 'debug',
            message: `传感器 ${sensorName} ${det}目标 #${p.target_index}`,
            entityRefs: [
              { type: 'sensor', index: sensorPlatformIndex, name: sensorName },
              { type: 'platform', index: p.target_index },
            ],
            source: 'websocket', tags: ['sensor', 'detection'],
          })
          // Feed detection into coverage heatmap only when target is detected (not lost)
          if (p.detected) {
            const targetPlat = platforms.platforms[p.target_index]
            const sensorPlat = platforms.platforms[sensorPlatformIndex]
            if (targetPlat) {
              coverage.recordDetection(
                targetPlat.lat,
                targetPlat.lon,
                sensorPlatformIndex,
                sensorPlat?.name ?? `#${sensorPlatformIndex}`,
                sensorName,
                sensorPlat?.sensors[sensorName]?.type ?? '',
              )
            }
          }
        }
        break

      case 'track_initiated':
        if (p?.track?.id) {
          tracks.addTrack({
            id: {
              originator_index: p.track.id.originator_index,
              target_index: p.track.target_index ?? p.track.id.target_index,
              sensor_name: p.track.id.sensor_name ?? '',
            },
            originator_index: p.track.id.originator_index,
            target_index: p.track.target_index ?? p.track.id.target_index,
            lat: p.track.lat ?? 0,
            lon: p.track.lon ?? 0,
            alt: p.track.alt ?? 0,
            vel_n: p.track.vel_n ?? 0,
            vel_e: p.track.vel_e ?? 0,
            vel_d: p.track.vel_d ?? 0,
            quality: p.track.quality ?? 0,
          })
        }
        break

      case 'track_update':
      case 'track_updated':
        if (p?.track?.id || p?.id) {
          const id = p.id ?? p.track?.id
          const trackUpdate = p.track ?? p
          tracks.updateTrack({
            id: {
              originator_index: id.originator_index,
              target_index: id.target_index ?? p.target_index,
              sensor_name: id.sensor_name ?? '',
            },
            lat: trackUpdate.lat,
            lon: trackUpdate.lon,
            alt: trackUpdate.alt,
            vel_n: trackUpdate.vel_n,
            vel_e: trackUpdate.vel_e,
            vel_d: trackUpdate.vel_d,
            quality: trackUpdate.quality,
          })
        }
        break

      case 'track_dropped':
      case 'track_removed':
        if (p?.id) {
          tracks.removeTrack({
            originator_index: p.id.originator_index,
            target_index: p.id.target_index,
            sensor_name: p.id.sensor_name ?? '',
          })
        }
        break

      case 'fuel_event':
        if (p) {
          platforms.updateFuel(p.platform_index, p.fuel_name, p.quantity)
        }
        break

      case 'full_snapshot':
        if (p) {
          // Platforms from snapshot
          if (p.platforms) {
            const platList = Array.isArray(p.platforms) ? p.platforms : Object.values(p.platforms)
            for (const pd of platList) {
              const d = pd as any
              platforms.addPlatform({
                index: d.index,
                name: d.name,
                typeId: d.type_id,
                side: d.side,
                lat: d.lat,
                lon: d.lon,
                alt: d.alt,
                damageFactor: d.damage_factor ?? 0,
                ...(d.mission ? { mission: missionFromSnapshot(d.mission) } : {}),
              })
              metrics.ensurePlatform(d.index, d.name, d.side)
              metrics.recordMover(d.index, d.lat ?? 0, d.lon ?? 0, d.alt ?? 0, d.vel_n, d.vel_e, d.vel_d)
            }
          }
          // Tracks from snapshot (flat shape from gateway state, no nested `id`)
          if (p.tracks) {
            const trackList = Array.isArray(p.tracks) ? p.tracks : Object.values(p.tracks)
            tracks.addTracks(
              trackList.map((t: unknown) => {
                const d = t as any
                return {
                  id: {
                    originator_index: d.originator_index,
                    target_index: d.target_index,
                    sensor_name: d.sensor_name ?? '',
                  },
                  originator_index: d.originator_index,
                  target_index: d.target_index,
                  lat: d.lat,
                  lon: d.lon,
                  alt: d.alt,
                  vel_n: d.vel_n,
                  vel_e: d.vel_e,
                  vel_d: d.vel_d,
                  quality: d.quality,
                }
              }) as TrackData[]
            )
          }
          if (p.sim_state) {
            const state = p.sim_state as string
            if (state === 'running') sim.setPhase('running')
            else if (state === 'paused') sim.setPhase('paused')
            else if (state === 'complete') sim.setPhase('complete')
          }
          if (p.sim_time !== undefined) sim.setSimTime(p.sim_time)
          if (p.clock_rate !== undefined) sim.setClockRate(p.clock_rate)
        }
        break

      case 'wez_update':
        if (p) {
          const wezStore = useWezStore.getState()
          if (Array.isArray(p.zones)) {
            for (const z of p.zones) {
              wezStore.addZone({
                platformIndex: z.platform_index,
                weaponName: z.weapon_name,
                rangeKm: z.range_km,
                maxOffAxisDeg: z.max_off_axis_deg ?? 0,
                probabilityOfKill: z.pk ?? 0,
                side: z.side ?? 'neutral',
              })
            }
          } else if (p.platform_index !== undefined) {
            wezStore.addZone({
              platformIndex: p.platform_index,
              weaponName: p.weapon_name ?? '',
              rangeKm: p.range_km ?? 0,
              maxOffAxisDeg: p.max_off_axis_deg ?? 0,
              probabilityOfKill: p.pk ?? 0,
              side: p.side ?? 'neutral',
            })
          }
        }
        break

      case 'threat_assessment':
        if (p) {
          useThreatStore.getState().addAssessment({
            platformIndex: p.platform_index,
            targetIndex: p.target_index,
            threatLevel: p.threat_level ?? 'low',
            engagementStatus: p.engagement_status ?? 'tracking',
            riskScore: p.risk_score ?? 0,
            wezClosureRate: p.wez_closure_rate,
            timeToWez: p.time_to_wez,
            timestamp: t,
          })
        }
        break

      case 'ooda_state_change':
      case 'ai_decision':
        if (p) {
          const aiStore = useAiStore.getState()
          const idx = p.platform_index ?? p.index
          if (idx !== undefined) {
            aiStore.updatePlatformAi(idx, {
              platformIndex: idx,
              oodaPhase: p.ooda_phase ?? p.phase ?? 'observe',
              oodaPhaseStartTime: p.phase_start_time ?? t,
              threatScore: p.threat_score ?? 0,
              riskLevel: p.risk_level ?? 'low',
              engagementDecision: p.engagement_decision ?? 'hold',
              aiBehaviorMode: p.ai_behavior_mode ?? p.behavior ?? 'patrol',
              lastDecisionTime: t,
            })
          }
        }
        break

      case 'iads_c2_update':
        if (p?.battle_manager_id) {
          useAiStore.getState().updateIadsC2(p.battle_manager_id, {
            battleManagerId: p.battle_manager_id,
            engagementAuthority: p.engagement_authority ?? false,
            shotDoctrine: p.shot_doctrine ?? 'shoot-look-shoot',
            activeEngagements: p.active_engagements ?? 0,
            pendingEngagements: p.pending_engagements ?? 0,
          })
        }
        break

      case 'ew_update':
        if (p) {
          const ewIdx = p.platform_index ?? p.index
          if (ewIdx !== undefined) {
            useAiStore.getState().updateEwState(ewIdx, {
              platformIndex: ewIdx,
              isJamming: p.is_jamming ?? false,
              jammingType: p.jamming_type ?? '',
              jammingTarget: p.jamming_target,
              emitters: (p.emitters ?? []).map((e: any) => ({
                name: e.name ?? '',
                type: e.type ?? '',
                isOn: e.is_on ?? false,
                frequency: e.frequency,
                power: e.power,
              })),
            })
          }
        }
        break

      case 'weather_update':
        if (p) {
          const envStore = useEnvironmentStore.getState()
          const weatherData = Array.isArray(p) ? p : [p]
          envStore.setWeather(weatherData.map((w: any) => ({
            stationId: w.station_id ?? w.stationId ?? '',
            stationName: w.station_name ?? w.stationName,
            position: { lng: w.lon ?? w.lng ?? 0, lat: w.lat ?? 0 },
            timestamp: w.timestamp ?? t,
            wind: {
              speed: w.wind_speed ?? w.wind?.speed ?? 0,
              direction: w.wind_direction ?? w.wind?.direction ?? 0,
              gust: w.wind_gust ?? w.wind?.gust,
              unit: (w.wind_unit ?? w.wind?.unit ?? 'm/s') as 'knots' | 'm/s' | 'km/h',
            },
            temperature: {
              air: w.temperature ?? w.temperature?.air ?? 0,
              dewPoint: w.dew_point ?? w.temperature?.dewPoint,
              unit: 'C' as const,
            },
            pressure: {
              seaLevel: w.pressure ?? w.pressure?.sea_level ?? 1013.25,
              unit: 'hPa' as const,
            },
            visibility: w.visibility ?? 10000,
            precipitation: { type: (w.precipitation_type ?? 'none') as any },
            cloudCover: { total: w.cloud_cover ?? 0, layers: [] },
            humidity: w.humidity ?? 50,
            weatherCode: w.weather_code,
            source: 'websocket',
          })))
          events.addEvent({
            timestamp: t, category: 'environment', severity: 'info',
            message: `天气数据更新: ${weatherData.length}个站点`,
            source: 'websocket', tags: ['environment', 'weather'],
          })
        }
        break

      case 'sea_state_update':
        if (p) {
          const envStore = useEnvironmentStore.getState()
          const seaData = Array.isArray(p) ? p : [p]
          envStore.setSeaState(seaData.map((s: any) => ({
            position: { lng: s.lon ?? s.lng ?? 0, lat: s.lat ?? 0 },
            timestamp: s.timestamp ?? t,
            wave: {
              significantHeight: s.wave_height ?? s.wave?.significantHeight ?? 0,
              maxHeight: s.wave_max_height ?? s.wave?.maxHeight,
              direction: s.wave_direction ?? s.wave?.direction ?? 0,
              period: s.wave_period ?? s.wave?.period ?? 0,
              unit: 'm' as const,
            },
            swell: {
              height: s.swell_height ?? s.swell?.height ?? 0,
              direction: s.swell_direction ?? s.swell?.direction ?? 0,
              period: s.swell_period ?? s.swell?.period ?? 0,
            },
            current: {
              speed: s.current_speed ?? s.current?.speed ?? 0,
              direction: s.current_direction ?? s.current?.direction ?? 0,
              unit: (s.current_unit ?? s.current?.unit ?? 'knots') as 'knots' | 'm/s',
            },
            seaSurfaceTemperature: s.sea_surface_temp ?? s.seaSurfaceTemperature ?? 15,
            seaState: s.sea_state ?? s.seaState ?? 0,
            source: 'websocket',
          })))
          events.addEvent({
            timestamp: t, category: 'environment', severity: 'info',
            message: `海情数据更新: ${seaData.length}个区域`,
            source: 'websocket', tags: ['environment', 'sea_state'],
          })
        }
        break

      case 'tide_update':
        if (p) {
          const envStore = useEnvironmentStore.getState()
          const tideData = Array.isArray(p) ? p : [p]
          envStore.setTides(tideData.map((td: any) => ({
            stationId: td.station_id ?? td.stationId ?? '',
            stationName: td.station_name ?? td.stationName ?? '',
            position: { lng: td.lon ?? td.lng ?? 0, lat: td.lat ?? 0 },
            timestamp: td.timestamp ?? t,
            level: td.level ?? 0,
            trend: (td.trend ?? 'slack') as any,
            predictions: (td.predictions ?? []).map((pr: any) => ({
              time: pr.time, level: pr.level, type: pr.type,
            })),
            datum: (td.datum ?? 'MSL') as any,
            source: 'websocket',
          })))
          events.addEvent({
            timestamp: t, category: 'environment', severity: 'info',
            message: `潮汐数据更新: ${tideData.length}个站点`,
            source: 'websocket', tags: ['environment', 'tide'],
          })
        }
        break

      case 'environment_update':
        if (p) {
          events.addEvent({
            timestamp: t, category: 'environment', severity: 'info',
            message: p.message ?? '环境数据更新',
            payload: p,
            source: 'websocket', tags: ['environment'],
          })
        }
        break

      case 'frame_complete':
        metrics.recordFrame(t ?? 0)
        break

      case 'event':
        if (p) {
          const cat: EventCategory = p.category ?? 'system'
          const sev: EventSeverity = p.severity ?? 'info'
          events.addEvent({
            timestamp: p.sim_time ?? t,
            category: cat,
            severity: sev,
            message: p.message ?? '',
            entityRefs: p.entity_refs,
            payload: p.payload,
            source: 'websocket',
            tags: p.tags,
          })
        }
        break

      case 'pong':
        if (this.pingTimestamp > 0) {
          const latency = Math.round(performance.now() - this.pingTimestamp)
          useWsHealthStore.getState().recordLatency(latency)
        }
        break

      default:
        break
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  close() {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.ws?.close()
    this.ws = null
  }

  private scheduleReconnect() {
    if (this.intentionalClose || this.reconnectAttempts >= this.maxReconnectAttempts) return

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    useWsHealthStore.getState().setReconnectInfo(this.reconnectAttempts, this.maxReconnectAttempts)
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay)
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

let wsInstance: SimulationWebSocket | null = null

export function connectWebSocket(simId: string, handler?: MessageHandler): SimulationWebSocket {
  if (wsInstance) {
    wsInstance.close()
  }

  // Fresh run → reset the live evaluation-metrics accumulator.
  useSimMetricsStore.getState().reset()

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname || 'localhost'
  const port = import.meta.env.VITE_GATEWAY_PORT || '8080'
  const url = `${protocol}//${host}:${port}/api/simulations/${simId}/ws`

  useWsHealthStore.getState().startTicking()
  wsInstance = new SimulationWebSocket(url)
  wsInstance.connect(handler)
  return wsInstance
}

export function getWebSocket(): SimulationWebSocket | null {
  return wsInstance
}
