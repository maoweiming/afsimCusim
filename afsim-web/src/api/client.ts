import type {
  ScenarioInfo,
  SimStatus,
  SimState,
} from './types';
import { useErrorStore } from '../store/errorStore';

// 仿真网关 REST API（与数据平台 VITE_DATA_API_URL 分离）
// 开发环境默认走 Vite 代理 /api → localhost:8080
const API_BASE = import.meta.env.VITE_GATEWAY_API_URL || '/api';

function normalizeScenarioInfo(raw: Record<string, unknown>): ScenarioInfo {
  const id = String(raw.id ?? '');
  const name = String(raw.name ?? id);
  return {
    id,
    name,
    filename: String(raw.filename ?? (name.endsWith('.scenario') ? name : `${id}.scenario`)),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    size_bytes: Number(raw.size_bytes ?? raw.size ?? 0),
  };
}

function normalizeSimStatus(raw: Record<string, unknown>): SimStatus {
  return {
    sim_id: String(raw.sim_id ?? raw.id ?? ''),
    scenario_id: String(raw.scenario_id ?? ''),
    state: String(raw.state ?? raw.status ?? 'idle') as SimState,
    sim_time: Number(raw.sim_time ?? 0),
    clock_rate: Number(raw.clock_rate ?? 1),
    wall_time: Number(raw.wall_time ?? 0),
  };
}

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `${API_BASE}${path}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        useErrorStore.getState().addError({
          source: 'api',
          severity: response.status >= 500 ? 'error' : 'warning',
          message: `API ${response.status}: ${path}`,
          detail: text,
        });
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        throw new Error(`API error ${response.status}: ${text}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        return response.blob() as unknown as T;
      }

      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;

      if (err instanceof DOMException && err.name === 'AbortError') {
        useErrorStore.getState().addError({
          source: 'api',
          severity: 'error',
          message: `Request timeout: ${path}`,
          detail: `Exceeded ${REQUEST_TIMEOUT_MS}ms`,
        });
        throw new Error(`Request timeout: ${path}`);
      }

      // Network error (backend not running) — fail fast, don't retry
      if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))) {
        useErrorStore.getState().addError({
          source: 'api',
          severity: 'warning',
          message: `Backend unavailable: ${path}`,
          detail: (err as Error).message,
        });
        throw err;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ----- Scenario endpoints -----

export async function listScenarios(): Promise<ScenarioInfo[]> {
  try {
    const list = await request<Record<string, unknown>[]>('/scenarios');
    return (list ?? []).map(normalizeScenarioInfo);
  } catch (err) {
    console.warn('[client] listScenarios failed:', err);
    throw err;
  }
}

export async function uploadScenario(file: File): Promise<ScenarioInfo> {
  const formData = new FormData();
  formData.append('file', file);
  const raw = await request<Record<string, unknown>>('/scenarios', {
    method: 'POST',
    headers: {},
    body: formData,
  });
  return normalizeScenarioInfo(raw);
}

export async function getScenario(scenarioId: string): Promise<ScenarioInfo> {
  return request<ScenarioInfo>(`/scenarios/${scenarioId}`);
}

// Backend returns the raw .scenario file as text/plain; request() falls back
// to Blob for non-JSON responses, so unwrap it to text here.
export async function getScenarioText(scenarioId: string): Promise<string> {
  const blob = await request<Blob>(`/scenarios/${scenarioId}`);
  return blob.text();
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  await request<void>(`/scenarios/${scenarioId}`, { method: 'DELETE' });
}

// ----- Simulation endpoints -----

export async function startSimulation(
  scenarioId: string,
  mode: string = 'realtime',
  equipmentConfigs?: string,
): Promise<SimStatus> {
  const body: Record<string, unknown> = { scenario_id: scenarioId, mode };
  if (equipmentConfigs) {
    body.equipment_configs = equipmentConfigs;
  }
  const raw = await request<Record<string, unknown>>('/simulations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return normalizeSimStatus(raw);
}

export async function getSimStatus(simId: string): Promise<SimStatus> {
  const raw = await request<Record<string, unknown>>(`/simulations/${simId}`);
  return normalizeSimStatus(raw);
}

export async function pauseSim(simId: string): Promise<SimStatus> {
  const raw = await request<Record<string, unknown>>(`/simulations/${simId}/pause`, { method: 'POST' });
  return normalizeSimStatus(raw);
}

export async function resumeSim(simId: string): Promise<SimStatus> {
  const raw = await request<Record<string, unknown>>(`/simulations/${simId}/resume`, { method: 'POST' });
  return normalizeSimStatus(raw);
}

export async function stepSim(simId: string): Promise<SimStatus> {
  const raw = await request<Record<string, unknown>>(`/simulations/${simId}/step`, { method: 'POST' });
  return normalizeSimStatus(raw);
}

export async function setClockRate(simId: string, rate: number): Promise<SimStatus> {
  const raw = await request<Record<string, unknown>>(`/simulations/${simId}/clock-rate`, {
    method: 'POST',
    body: JSON.stringify({ rate }),
  });
  return normalizeSimStatus(raw);
}

export async function terminateSim(simId: string): Promise<void> {
  await request<void>(`/simulations/${simId}/terminate`, { method: 'POST' });
}

// ----- Output -----

export async function getOutputFile(simId: string, filename: string): Promise<Blob> {
  return request<Blob>(`/simulations/${simId}/output/${filename}`);
}

// ----- Active simulation shorthand -----

let activeSimId: string | null = null;

export function setActiveSimId(id: string | null): void {
  activeSimId = id;
}

export function getActiveSimId(): string | null {
  return activeSimId;
}
