// ============================================================
// Equipment I/O - JSON Importer
// AFSIM-native: imports AfsimEquipment
// ============================================================

import type { AfsimEquipment } from '../afsim/types';
import { createEmptyEquipment } from '../afsim/types';

// ============ Types ============

export interface AfsimImportResult {
  valid: AfsimEquipment[];
  errors: AfsimImportError[];
  total: number;
}

export interface AfsimImportError {
  index: number;
  name: string;
  field: string;
  message: string;
}

export interface ImportBundle {
  formatVersion?: string;
  format?: string;
  exportedAt?: string;
  count?: number;
  data: unknown[];
}

// ============ API ============

/**
 * Parse AfsimEquipment JSON text.
 * Auto-detects format: AfsimExportBundle, AfsimEquipment[], or single AfsimEquipment.
 */
export function importAfsimJson(json: string): AfsimImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      valid: [],
      errors: [{ index: -1, name: '-', field: 'json', message: 'JSON parse error' }],
      total: 0,
    };
  }

  let items: unknown[];
  let isAfsimFormat = false;

  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    const bundle = parsed as { format?: string; data: unknown };
    if (bundle.format === 'afsim') {
      isAfsimFormat = true;
    }
    if (Array.isArray(bundle.data)) {
      items = bundle.data;
    } else {
      return {
        valid: [],
        errors: [{ index: -1, name: '-', field: 'data', message: 'Bundle data is not an array' }],
        total: 0,
      };
    }
  } else if (parsed && typeof parsed === 'object') {
    items = [parsed];
  } else {
    return {
      valid: [],
      errors: [{ index: -1, name: '-', field: 'json', message: 'Unsupported data format' }],
      total: 0,
    };
  }

  return validateAfsimEquipmentList(items, isAfsimFormat);
}

/**
 * Import AfsimEquipment from File object.
 */
export async function importAfsimJsonFile(file: File): Promise<AfsimImportResult> {
  const text = await file.text();
  return importAfsimJson(text);
}

/**
 * Detect whether a JSON string is an AFSIM format bundle.
 */
export function isAfsimFormat(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && 'format' in parsed) {
      return (parsed as { format: string }).format === 'afsim';
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      return isAfsimEquipmentLike(parsed[0]);
    }
    return isAfsimEquipmentLike(parsed);
  } catch {
    return false;
  }
}

// ============ Validation ============

function validateAfsimEquipmentList(items: unknown[], _isAfsimFormat: boolean): AfsimImportResult {
  const valid: AfsimEquipment[] = [];
  const errors: AfsimImportError[] = [];

  items.forEach((item, index) => {
    const eq = item as Record<string, unknown>;
    const name = (eq.name as string) || `Entry #${index + 1}`;

    if (!eq.name || typeof eq.name !== 'string' || eq.name.trim() === '') {
      errors.push({ index, name, field: 'name', message: 'Missing equipment name' });
    }

    if (!eq.platform || typeof eq.platform !== 'object') {
      errors.push({ index, name, field: 'platform', message: 'Missing platform configuration' });
    }

    const itemErrors = errors.filter((e) => e.index === index);
    if (itemErrors.length === 0) {
      const equipment = buildAfsimEquipment(eq, index);
      valid.push(equipment);
    }
  });

  return { valid, errors, total: items.length };
}

function buildAfsimEquipment(raw: Record<string, unknown>, index: number): AfsimEquipment {
  const base = createEmptyEquipment();

  base.name = (raw.name as string) || `import-${Date.now()}-${index}`;
  base.parentType = raw.parentType as string | undefined;

  // Platform - deep merge with defaults
  const rawPlatform = raw.platform as Record<string, unknown> | undefined;
  if (rawPlatform) {
    base.platform = mergePlatform(base.platform, rawPlatform);
  }

  // Named type definitions
  base.sensorTypes = raw.sensorTypes as AfsimEquipment['sensorTypes'];
  base.weaponTypes = raw.weaponTypes as AfsimEquipment['weaponTypes'];
  base.commTypes = raw.commTypes as AfsimEquipment['commTypes'];
  base.processorTypes = raw.processorTypes as AfsimEquipment['processorTypes'];
  base.moverTypes = raw.moverTypes as AfsimEquipment['moverTypes'];
  base.fuelTypes = raw.fuelTypes as AfsimEquipment['fuelTypes'];
  base.weaponEffectTypes = raw.weaponEffectTypes as AfsimEquipment['weaponEffectTypes'];
  base.launchComputerTypes = raw.launchComputerTypes as AfsimEquipment['launchComputerTypes'];

  return base;
}

function mergePlatform(base: import('../afsim/types').AfsimPlatform, raw: Record<string, unknown>): import('../afsim/types').AfsimPlatform {
  const merged = { ...base };

  if (raw.side != null) merged.side = raw.side as string;
  if (raw.icon != null) merged.icon = raw.icon as string;
  if (raw.marking != null) merged.marking = raw.marking as string;
  if (raw.destructible != null) merged.destructible = raw.destructible as boolean;
  if (raw.spatialDomain != null) merged.spatialDomain = raw.spatialDomain as typeof merged.spatialDomain;
  if (raw.altitude != null) merged.altitude = raw.altitude as string;
  if (raw.altitudeReference != null) merged.altitudeReference = raw.altitudeReference as typeof merged.altitudeReference;
  if (raw.heading != null) merged.heading = raw.heading as string;
  if (raw.pitch != null) merged.pitch = raw.pitch as string;
  if (raw.roll != null) merged.roll = raw.roll as string;
  if (raw.emptyMass != null) merged.emptyMass = raw.emptyMass as string;
  if (raw.fuelMass != null) merged.fuelMass = raw.fuelMass as string;
  if (raw.payloadMass != null) merged.payloadMass = raw.payloadMass as string;
  if (raw.length != null) merged.length = raw.length as string;
  if (raw.width != null) merged.width = raw.width as string;
  if (raw.height != null) merged.height = raw.height as string;
  if (raw.concealmentFactor != null) merged.concealmentFactor = raw.concealmentFactor as number;
  if (raw.initialDamageFactor != null) merged.initialDamageFactor = raw.initialDamageFactor as number;
  if (raw.radarSignature != null) merged.radarSignature = raw.radarSignature as string;
  if (raw.intersectMesh != null) merged.intersectMesh = raw.intersectMesh as string;
  if (raw.thermalSystem != null) merged.thermalSystem = raw.thermalSystem as string;
  if (raw.creationTime != null) merged.creationTime = raw.creationTime as string;

  if (raw.position && typeof raw.position === 'object') {
    merged.position = raw.position as typeof merged.position;
  }

  if (Array.isArray(raw.categories)) {
    merged.categories = raw.categories as string[];
  }

  if (raw.sensors && typeof raw.sensors === 'object' && !Array.isArray(raw.sensors)) {
    merged.sensors = raw.sensors as typeof merged.sensors;
  }
  if (raw.weapons && typeof raw.weapons === 'object' && !Array.isArray(raw.weapons)) {
    merged.weapons = raw.weapons as typeof merged.weapons;
  }
  if (raw.comms && typeof raw.comms === 'object' && !Array.isArray(raw.comms)) {
    merged.comms = raw.comms as typeof merged.comms;
  }
  if (raw.processors && typeof raw.processors === 'object' && !Array.isArray(raw.processors)) {
    merged.processors = raw.processors as typeof merged.processors;
  }
  if (raw.movers && typeof raw.movers === 'object' && !Array.isArray(raw.movers)) {
    merged.movers = raw.movers as typeof merged.movers;
  }
  if (raw.fuels && typeof raw.fuels === 'object' && !Array.isArray(raw.fuels)) {
    merged.fuels = raw.fuels as typeof merged.fuels;
  }
  if (raw.zones && typeof raw.zones === 'object' && !Array.isArray(raw.zones)) {
    merged.zones = raw.zones as typeof merged.zones;
  }
  if (raw.routers && typeof raw.routers === 'object' && !Array.isArray(raw.routers)) {
    merged.routers = raw.routers as typeof merged.routers;
  }
  if (raw.commandChains && typeof raw.commandChains === 'object' && !Array.isArray(raw.commandChains)) {
    merged.commandChains = raw.commandChains as typeof merged.commandChains;
  }

  return merged;
}

function isAfsimEquipmentLike(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (o.platform && typeof o.platform === 'object') {
    const p = o.platform as Record<string, unknown>;
    return 'sensors' in p || 'weapons' in p || 'movers' in p;
  }
  return false;
}
