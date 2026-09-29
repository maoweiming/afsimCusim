// ============================================================
// Replay API Client
// 查询仿真回放数据：会话列表、帧查询、统计信息
// ============================================================

import { DataPlatformClient } from './dataPlatform';

const client = new DataPlatformClient();

export interface ReplaySession {
  id: string;
  simulation_id: string;
  scenario_id: string;
  start_time: number;
  end_time: number;
  frame_count: number;
  created_at: string;
}

export interface SimulationFrame {
  sim_time: number;
  platform_id: string;
  platform_name: string;
  side: string;
  position: { latitude: number; longitude: number; altitude: number };
  velocity: { north: number; east: number; down: number };
  heading: number;
  altitude: number;
  status: string;
  fuel_remaining: number;
  damage_level: number;
}

export async function listReplays(): Promise<ReplaySession[]> {
  try {
    const resp = await client.get<{ replays: ReplaySession[] }>('/timeseries/replays');
    return resp.replays ?? [];
  } catch (err) {
    console.warn('[replayApi] Failed to fetch replays:', err);
    return [];
  }
}

export async function queryFrames(params: {
  simulation_id: string;
  start_time?: number;
  end_time?: number;
  platform_id?: string;
  limit?: number;
}): Promise<{ frames: SimulationFrame[]; total: number }> {
  try {
    const queryParams: Record<string, string> = {
      simulation_id: params.simulation_id,
    };
    if (params.start_time !== undefined) queryParams.start_time = String(params.start_time);
    if (params.end_time !== undefined) queryParams.end_time = String(params.end_time);
    if (params.platform_id) queryParams.platform_id = params.platform_id;
    if (params.limit) queryParams.limit = String(params.limit);
    return await client.get('/timeseries/query', queryParams);
  } catch (err) {
    console.warn('[replayApi] queryFrames failed:', err);
    return { frames: [], total: 0 };
  }
}

export interface PlatformStats {
  platform_id: string;
  platform_name: string;
  side: string;
  max_speed: number;
  min_altitude: number;
  max_altitude: number;
  total_distance: number;
  shots_fired: number;
  kills: number;
  final_status: string;
}

export interface EngagementSummary {
  id: string;
  time: number;
  attacker_id: string;
  target_id: string;
  weapon_type: string;
  result: string;
}

export interface SimulationStats {
  simulation_id: string;
  duration: number;
  total_frames: number;
  platform_count: number;
  events_count: number;
  platform_stats: PlatformStats[];
  engagements: EngagementSummary[];
  /** Set when the data platform could not be reached (request failed) */
  _unavailable?: boolean;
}

const EMPTY_STATS: SimulationStats = {
  simulation_id: '',
  duration: 0,
  total_frames: 0,
  platform_count: 0,
  events_count: 0,
  platform_stats: [],
  engagements: [],
};

export async function getSimulationStats(simId: string): Promise<SimulationStats> {
  try {
    return await client.get(`/timeseries/stats/${simId}`);
  } catch (err) {
    console.warn('[replayApi] getSimulationStats failed:', err);
    return { ...EMPTY_STATS, simulation_id: simId, _unavailable: true };
  }
}

export interface ScenarioComparisonEntry {
  replay_id: string;
  simulation_id: string;
  name: string;
  created_at: string;
  stats: SimulationStats;
}

export interface ScenarioComparison {
  scenario_id: string;
  runs: ScenarioComparisonEntry[];
}

const EMPTY_COMPARISON: ScenarioComparison = { scenario_id: '', runs: [] };

export async function getScenarioComparison(scenarioId: string): Promise<ScenarioComparison> {
  try {
    const resp = await client.get<ScenarioComparison>(`/timeseries/scenarios/${scenarioId}/comparison`);
    return { scenario_id: resp.scenario_id ?? scenarioId, runs: resp.runs ?? [] };
  } catch (err) {
    console.warn('[replayApi] getScenarioComparison failed:', err);
    return { ...EMPTY_COMPARISON, scenario_id: scenarioId };
  }
}

export async function deleteReplay(id: string): Promise<void> {
  try {
    await client.delete(`/timeseries/replays/${id}`);
  } catch (err) {
    console.warn('[replayApi] deleteReplay failed:', err);
  }
}
