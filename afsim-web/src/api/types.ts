// ----- WebSocket message envelope -----

export interface WSMessage {
  type: string;
  sim_time: number;
  payload: unknown;
}

// ----- Simulation states -----

export type SimState = 'idle' | 'running' | 'paused' | 'complete' | 'error';

// ----- Platform data -----

export interface PlatformData {
  index: number;
  name: string;
  type_id: string;
  side: string; // "blue" | "red" | "neutral"
  icon: string;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  pitch: number;
  roll: number;
  vel_n: number;
  vel_e: number;
  vel_d: number;
  damage_factor: number;
}

// ----- Mover update (incremental position) -----

export interface MoverUpdatePayload {
  index: number;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  pitch: number;
  roll: number;
  vel_n: number;
  vel_e: number;
  vel_d: number;
}

// ----- Weapon payloads -----

export interface WeaponFiredPayload {
  firing_platform_index: number;
  weapon_name: string;
  weapon_platform_index: number;
  target_platform_index: number;
  launch_lat: number;
  launch_lon: number;
  launch_alt: number;
}

export interface WeaponHitPayload {
  weapon_platform_index: number;
  target_platform_index: number;
  target_lat: number;
  target_lon: number;
  target_alt: number;
}

export interface WeaponMissedPayload {
  weapon_platform_index: number;
  target_platform_index: number;
}

export interface WeaponTerminatedPayload {
  weapon_platform_index: number;
}

// ----- Sensor detection -----

export interface SensorDetectionPayload {
  sensor_platform_index: number;
  sensor_name: string;
  target_index: number;
  detected: boolean;
}

// ----- Track data -----

export interface TrackId {
  originator_index: number;
  target_index: number;
  sensor_name: string;
}

export interface TrackData {
  id: TrackId;
  originator_index: number;
  target_index: number;
  lat: number;
  lon: number;
  alt: number;
  vel_n: number;
  vel_e: number;
  vel_d: number;
  quality: number;
}

// ----- Damage update -----

export interface DamageUpdatePayload {
  index: number;
  damage_factor: number;
}

// ----- Platform removed -----

export interface PlatformRemovedPayload {
  index: number;
}

// ----- Track update -----

export interface TrackUpdatePayload {
  id: TrackId;
  lat: number;
  lon: number;
  alt: number;
  vel_n: number;
  vel_e: number;
  vel_d: number;
  quality: number;
}

export interface TrackRemovedPayload {
  id: TrackId;
}

// ----- Full snapshot (sent on initial connect) -----

export interface FullSnapshotPayload {
  sim_state: SimState;
  sim_time: number;
  clock_rate: number;
  platforms: PlatformData[];
  tracks: TrackData[];
  active_weapons: WeaponEngagement[];
  recent_events: SimEvent[];
}

// ----- Weapon engagement (client-side tracking) -----

export interface WeaponEngagement {
  weapon_platform_index: number;
  firing_platform_index: number;
  weapon_name: string;
  target_platform_index: number;
  launch_lat: number;
  launch_lon: number;
  launch_alt: number;
  current_lat?: number;
  current_lon?: number;
  current_alt?: number;
  hit?: boolean;
}

// ----- Simulation event (for event log) -----

export interface SimEvent {
  sim_time: number;
  event_type: string;
  message: string;
}

// ----- Scenario metadata -----

export interface ScenarioInfo {
  id: string;
  name: string;
  filename: string;
  created_at: string;
  size_bytes: number;
}

// ----- Simulation status (REST response) -----

export interface SimStatus {
  sim_id: string;
  scenario_id: string;
  state: SimState;
  sim_time: number;
  clock_rate: number;
  wall_time: number;
}

// ----- WS message type constants -----

export const WS_MSG_TYPES = {
  FULL_SNAPSHOT: 'full_snapshot',
  MOVER_UPDATE: 'mover_update',
  WEAPON_FIRED: 'weapon_fired',
  WEAPON_HIT: 'weapon_hit',
  WEAPON_MISSED: 'weapon_missed',
  WEAPON_TERMINATED: 'weapon_terminated',
  SENSOR_DETECTION: 'sensor_detection',
  TRACK_UPDATE: 'track_update',
  TRACK_REMOVED: 'track_removed',
  DAMAGE_UPDATE: 'damage_update',
  PLATFORM_REMOVED: 'platform_removed',
  SIM_STATE_CHANGED: 'sim_state_changed',
  EVENT: 'event',
} as const;

export type WSMessageType = (typeof WS_MSG_TYPES)[keyof typeof WS_MSG_TYPES];
