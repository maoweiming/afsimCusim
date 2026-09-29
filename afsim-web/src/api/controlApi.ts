// ============================================================
// Control Command API
// 向网关发送传感器转向、武器发射等控制指令
// ============================================================

const BASE = '/api'; // proxied to gateway

async function postControl(simId: string, action: string, body: Record<string, unknown>): Promise<unknown> {
  try {
    const resp = await fetch(`${BASE}/simulations/${simId}/control/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => 'Unknown error');
      throw new Error(`Control command failed: ${resp.status} - ${text}`);
    }
    return resp.json();
  } catch (err) {
    console.warn(`[controlApi] ${action} failed (backend may be unavailable):`, err);
    return { status: 'unavailable', error: (err as Error).message };
  }
}

export function steerSensor(
  simId: string,
  params: {
    platform_index: number;
    sensor_name: string;
    azimuth: number;
    elevation: number;
  }
): Promise<unknown> {
  return postControl(simId, 'sensor-steer', params as unknown as Record<string, unknown>);
}

export function fireWeapon(
  simId: string,
  params: {
    firing_platform_index: number;
    weapon_name: string;
    target_platform_index: number;
  }
): Promise<unknown> {
  return postControl(simId, 'weapon-fire', params as unknown as Record<string, unknown>);
}
