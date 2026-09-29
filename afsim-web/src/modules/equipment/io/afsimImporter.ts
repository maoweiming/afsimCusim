// ============================================================
// Equipment I/O - AFSIM Base Types Importer
// Resolves include_once directives, builds type registry,
// and converts platform_type blocks to AfsimEquipment[]
// ============================================================

import type { AfsimEquipment, AfsimPlatform } from '../afsim/types';
import { createEmptyEquipment, createEmptyPlatform } from '../afsim/types';
import type { AfsimBlock, AfsimParseError, TypeRegistryEntry } from './confParser';
import { parseRawBlocks } from './confParser';

// ============================================================
// Public Types
// ============================================================

export interface AfsimBatchImportResult {
  equipment: AfsimEquipment[];
  typeRegistry: Map<string, TypeRegistryEntry>;
  errors: AfsimParseError[];
  stats: {
    filesProcessed: number;
    platformTypes: number;
    sensorTypes: number;
    weaponTypes: number;
    otherTypes: number;
  };
}

/** File content provider: given a relative path, return file content or null */
export type FileProvider = (path: string) => string | null;

// ============================================================
// Public API
// ============================================================

/**
 * Import AFSIM equipment from a set of files.
 *
 * @param entryPoints - Paths to entry-point files (e.g., platform_type files)
 * @param fileProvider - Function that returns file content given a relative path
 * @returns Parsed equipment, type registry, and errors
 */
export function importAfsimFiles(
  entryPoints: string[],
  fileProvider: FileProvider,
): AfsimBatchImportResult {
  const errors: AfsimParseError[] = [];
  const allBlocks: AfsimBlock[] = [];
  const processedFiles = new Set<string>();
  let filesProcessed = 0;

  // Step 1: Resolve includes and collect all blocks
  for (const entry of entryPoints) {
    const blocks = resolveAndParse(entry, fileProvider, processedFiles, errors);
    allBlocks.push(...blocks);
    filesProcessed = processedFiles.size;
  }

  // Step 2: Build type registry
  const typeRegistry = buildTypeRegistry(allBlocks);

  // Step 3: Convert platform_type blocks to AfsimEquipment
  const equipment: AfsimEquipment[] = [];
  for (const block of allBlocks) {
    if (block.keyword === 'platform_type') {
      try {
        const eq = platformTypeToEquipment(block, typeRegistry, errors);
        equipment.push(eq);
      } catch (e) {
        errors.push({
          line: block.startLine,
          message: `Failed to parse platform_type "${block.name}": ${(e as Error).message}`,
        });
      }
    }
  }

  // Stats
  const stats = {
    filesProcessed,
    platformTypes: Array.from(typeRegistry.values()).filter(e => e.keyword === 'platform_type').length,
    sensorTypes: Array.from(typeRegistry.values()).filter(e => e.keyword === 'sensor').length,
    weaponTypes: Array.from(typeRegistry.values()).filter(e => e.keyword === 'weapon').length,
    otherTypes: Array.from(typeRegistry.values()).filter(e =>
      !['platform_type', 'sensor', 'weapon'].includes(e.keyword)
    ).length,
  };

  return { equipment, typeRegistry, errors, stats };
}

/**
 * Import from a single text (no include resolution).
 * Useful for importing a self-contained .txt file.
 */
export function importAfsimText(text: string): AfsimBatchImportResult {
  const errors: AfsimParseError[] = [];
  const { blocks, errors: parseErrors } = parseRawBlocks(text);
  errors.push(...parseErrors);

  const typeRegistry = buildTypeRegistry(blocks);
  const equipment: AfsimEquipment[] = [];

  for (const block of blocks) {
    if (block.keyword === 'platform_type') {
      try {
        const eq = platformTypeToEquipment(block, typeRegistry, errors);
        equipment.push(eq);
      } catch (e) {
        errors.push({
          line: block.startLine,
          message: `Failed to parse platform_type "${block.name}": ${(e as Error).message}`,
        });
      }
    }
  }

  const stats = {
    filesProcessed: 1,
    platformTypes: Array.from(typeRegistry.values()).filter(e => e.keyword === 'platform_type').length,
    sensorTypes: Array.from(typeRegistry.values()).filter(e => e.keyword === 'sensor').length,
    weaponTypes: Array.from(typeRegistry.values()).filter(e => e.keyword === 'weapon').length,
    otherTypes: Array.from(typeRegistry.values()).filter(e =>
      !['platform_type', 'sensor', 'weapon'].includes(e.keyword)
    ).length,
  };

  return { equipment, typeRegistry, errors, stats };
}

/**
 * Create a FileProvider from a Map of path → content.
 */
export function createMapFileProvider(files: Map<string, string>): FileProvider {
  return (path: string) => {
    // Normalize path separators
    const normalized = path.replace(/\\/g, '/');
    return files.get(normalized) ?? files.get(path) ?? null;
  };
}

/**
 * Create a FileProvider from a base URL (for fetching files from a server).
 */
export function createUrlFileProvider(baseUrl: string): FileProvider {
  return (path: string) => {
    // This is a synchronous interface, so we can't actually fetch.
    // Use createAsyncFileProvider for URL-based loading.
    console.warn(`Cannot synchronously fetch ${baseUrl}/${path}`);
    return null;
  };
}

// ============================================================
// Include resolution
// ============================================================

/**
 * Recursively resolve include_once directives and parse all blocks.
 */
function resolveAndParse(
  filePath: string,
  fileProvider: FileProvider,
  processedFiles: Set<string>,
  errors: AfsimParseError[],
): AfsimBlock[] {
  const normalizedPath = filePath.replace(/\\/g, '/');

  if (processedFiles.has(normalizedPath)) {
    return []; // Already processed (include_once semantics)
  }
  processedFiles.add(normalizedPath);

  const content = fileProvider(filePath);
  if (content === null) {
    errors.push({
      line: 0,
      message: `File not found: ${filePath}`,
    });
    return [];
  }

  // Extract include directives and resolve them first
  const lines = content.split('\n');
  const resolvedBlocks: AfsimBlock[] = [];
  let currentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle include_once
    const includeMatch = trimmed.match(/^(?:\/\/\s*)?include_once\s+(.+)$/);
    if (includeMatch) {
      const includePath = includeMatch[1].trim();
      const resolvedPath = resolvePath(currentDir, includePath);
      const includedBlocks = resolveAndParse(resolvedPath, fileProvider, processedFiles, errors);
      resolvedBlocks.push(...includedBlocks);
      continue;
    }

    // Handle include (non-once)
    const includeOnceMatch = trimmed.match(/^(?:\/\/\s*)?include\s+(.+)$/);
    if (includeOnceMatch) {
      const includePath = includeOnceMatch[1].trim();
      const resolvedPath = resolvePath(currentDir, includePath);
      // include (not include_once) always re-processes
      const savedProcessed = new Set(processedFiles);
      processedFiles.delete(resolvedPath);
      const includedBlocks = resolveAndParse(resolvedPath, fileProvider, processedFiles, errors);
      // Restore the "once" state for files that were already processed
      for (const p of processedFiles) {
        if (!savedProcessed.has(p)) {
          // New file processed during this include — keep it
        }
      }
      resolvedBlocks.push(...includedBlocks);
      continue;
    }

    // Handle file_path directive (sets search path)
    // We track this but don't use it yet — could be extended
  }

  // Parse the current file's own blocks
  const { blocks, errors: parseErrors } = parseRawBlocks(content);
  // Adjust line numbers for errors from included files
  for (const err of parseErrors) {
    errors.push({
      line: err.line,
      message: `[${normalizedPath}] ${err.message}`,
    });
  }

  resolvedBlocks.push(...blocks);
  return resolvedBlocks;
}

/**
 * Resolve a relative path against a base directory.
 */
function resolvePath(baseDir: string, relativePath: string): string {
  // Normalize separators
  const normalized = relativePath.replace(/\\/g, '/');
  const base = baseDir.replace(/\\/g, '/');

  if (normalized.startsWith('/')) {
    return normalized; // Absolute path
  }

  // Simple relative path resolution
  const parts = base.split('/').filter(Boolean);
  const relParts = normalized.split('/');

  for (const part of relParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return parts.join('/');
}

// ============================================================
// Type registry
// ============================================================

function buildTypeRegistry(blocks: AfsimBlock[]): Map<string, TypeRegistryEntry> {
  const registry = new Map<string, TypeRegistryEntry>();

  const TOP_LEVEL_KEYWORDS = new Set([
    'platform_type', 'platform',
    'sensor', 'weapon', 'mover', 'processor', 'comm', 'fuel',
    'launch_computer', 'weapon_effects',
    'radar_signature', 'infrared_signature', 'optical_signature',
    'antenna_pattern', 'aero',
    'observer', 'route',
  ]);

  function collect(blocks: AfsimBlock[]) {
    for (const block of blocks) {
      if (TOP_LEVEL_KEYWORDS.has(block.keyword) && block.name) {
        registry.set(block.name, {
          keyword: block.keyword,
          name: block.name,
          block,
        });
      }
      // Recurse into children (for nested type definitions)
      collect(block.children);
    }
  }

  collect(blocks);
  return registry;
}

// ============================================================
// Platform type → AfsimEquipment
// ============================================================

function platformTypeToEquipment(
  block: AfsimBlock,
  typeRegistry: Map<string, TypeRegistryEntry>,
  errors: AfsimParseError[],
): AfsimEquipment {
  const eq = createEmptyEquipment();
  eq.name = block.name || 'Unnamed';
  eq.parentType = block.typeName || undefined;

  // Start with empty platform
  const platform = eq.platform;

  // Apply parent type properties first (if any)
  if (block.typeName && typeRegistry.has(block.typeName)) {
    const parentEntry = typeRegistry.get(block.typeName)!;
    if (parentEntry.block.keyword === 'platform_type') {
      applyPlatformFromBlock(parentEntry.block, platform, typeRegistry, errors);
    }
  }

  // Apply this block's own properties (overrides parent)
  applyPlatformFromBlock(block, platform, typeRegistry, errors);

  return eq;
}

function applyPlatformFromBlock(
  block: AfsimBlock,
  platform: AfsimPlatform,
  typeRegistry: Map<string, TypeRegistryEntry>,
  errors: AfsimParseError[],
): void {
  // Apply properties
  for (const [key, value] of block.properties) {
    applyPlatformProperty(platform, key, value);
  }

  // Apply child blocks
  for (const child of block.children) {
    applyChildBlock(platform, child, typeRegistry, errors);
  }
}

function applyPlatformProperty(platform: AfsimPlatform, key: string, value: string): void {
  switch (key) {
    case 'side': platform.side = value; break;
    case 'icon': platform.icon = value; break;
    case 'marking': platform.marking = value; break;
    case 'destructible': platform.destructible = value !== 'false'; break;
    case 'domain': platform.spatialDomain = value as AfsimPlatform['spatialDomain']; break;
    case 'altitude': platform.altitude = value; break;
    case 'altitude_reference': platform.altitudeReference = value as AfsimPlatform['altitudeReference']; break;
    case 'heading': platform.heading = value; break;
    case 'pitch': platform.pitch = value; break;
    case 'roll': platform.roll = value; break;
    case 'empty_mass': platform.emptyMass = value; break;
    case 'fuel_mass': platform.fuelMass = value; break;
    case 'payload_mass': platform.payloadMass = value; break;
    case 'length': platform.length = value; break;
    case 'width': platform.width = value; break;
    case 'height': platform.height = value; break;
    case 'concealment_factor': platform.concealmentFactor = parseFloat(value); break;
    case 'initial_damage_factor': platform.initialDamageFactor = parseFloat(value); break;
    case 'radar_signature': platform.radarSignature = value; break;
    case 'intersect_mesh': platform.intersectMesh = value; break;
    case 'category': platform.categories = value.split(/\s+/).filter(Boolean); break;
    case 'categories': platform.categories = value.split(/\s+/).filter(Boolean); break;
    case 'creation_time': platform.creationTime = value; break;
    case 'position': {
      const parts = value.split(/\s+/).map(Number);
      if (parts.length >= 2) {
        platform.position = { type: 'latlon', latitude: parts[0], longitude: parts[1] };
      }
      break;
    }
  }
}

function applyChildBlock(
  platform: AfsimPlatform,
  child: AfsimBlock,
  typeRegistry: Map<string, TypeRegistryEntry>,
  errors: AfsimParseError[],
): void {
  switch (child.keyword) {
    case 'mover': {
      // mover TYPE — TYPE is the mover type name (no separate instance name in AFSIM)
      const moverTypeName = child.typeName || child.name;
      const resolved = resolveType(moverTypeName, 'mover', typeRegistry);
      if (resolved) {
        platform.movers[moverTypeName || 'main_mover'] = parseMoverBlock(child, resolved);
      } else {
        platform.movers[moverTypeName || 'main_mover'] = parseMoverBlock(child, child);
      }
      break;
    }
    case 'sensor': {
      // sensor NAME TYPE — NAME is instance, TYPE is the type reference
      const sensorTypeName = child.typeName || child.name;
      const resolved = resolveType(sensorTypeName, 'sensor', typeRegistry);
      if (resolved) {
        // Merge type definition with instance overrides
        platform.sensors[child.name] = parseSensorReference(child, resolved);
      } else {
        // Use inline definition only
        platform.sensors[child.name] = parseSensorReference(child, child);
      }
      break;
    }
    case 'weapon': {
      const weaponTypeName = child.typeName || child.name;
      const resolved = resolveType(weaponTypeName, 'weapon', typeRegistry);
      if (resolved) {
        platform.weapons[child.name] = parseWeaponReference(child, resolved);
      } else {
        platform.weapons[child.name] = parseWeaponReference(child, child);
      }
      break;
    }
    case 'processor': {
      const procTypeName = child.typeName || child.name;
      const resolved = resolveType(procTypeName, 'processor', typeRegistry);
      if (resolved) {
        platform.processors[child.name] = parseProcessorBlock(child, resolved);
      } else {
        platform.processors[child.name] = parseProcessorBlock(child, child);
      }
      break;
    }
    case 'comm': {
      platform.comms[child.name] = parseCommBlock(child);
      break;
    }
    case 'fuel': {
      const fuelTypeName = child.name || child.typeName;
      const resolved = resolveType(fuelTypeName, 'fuel', typeRegistry);
      if (resolved) {
        platform.fuels[child.name || 'main_fuel'] = parseFuelBlock(child, resolved);
      } else {
        platform.fuels[child.name || 'main_fuel'] = parseFuelBlock(child, child);
      }
      break;
    }
    case 'radar_signature':
      platform.radarSignature = child.name;
      break;
    case 'route':
      break; // Routes are scenario-level
  }
}

/**
 * Resolve a type name to its definition block.
 * Walks the inheritance chain if needed.
 */
function resolveType(
  typeName: string,
  expectedKeyword: string,
  typeRegistry: Map<string, TypeRegistryEntry>,
): AfsimBlock | null {
  const entry = typeRegistry.get(typeName);
  if (!entry) return null;

  // If the entry is a platform_type but we're looking for a sensor/weapon/etc,
  // check if the platform_type has a child of that type
  if (entry.keyword !== expectedKeyword) {
    // For now, return null — the type might be defined inline
    return null;
  }

  return entry.block;
}

// ============================================================
// Block parsers (imported from confParser logic, adapted)
// ============================================================

function parseMoverBlock(block: AfsimBlock, typeBlock: AfsimBlock): any {
  const moverTypeName = typeBlock.name || typeBlock.typeName;
  const MOVER_TYPE_MAP: Record<string, string> = {
    WSF_AIR_MOVER: 'WSF_AIR_MOVER',
    WSF_GROUND_MOVER: 'WSF_GROUND_MOVER',
    WSF_SURFACE_MOVER: 'WSF_SURFACE_MOVER',
    WSF_SUBSURFACE_MOVER: 'WSF_SUBSURFACE_MOVER',
    WSF_SPACE_MOVER: 'WSF_SPACE_MOVER',
    WSF_KINEMATIC_MOVER: 'WSF_KINEMATIC_MOVER',
    WSF_ROTORCRAFT_MOVER: 'WSF_ROTORCRAFT_MOVER',
    WSF_ROAD_MOVER: 'WSF_ROAD_MOVER',
    WSF_HYBRID_MOVER: 'WSF_HYBRID_MOVER',
    WSF_OFFSET_MOVER: 'WSF_OFFSET_MOVER',
    WSF_TSPI_MOVER: 'WSF_TSPI_MOVER',
    WSF_GUIDED_MOVER: 'WSF_GUIDED_MOVER',
    WSF_BRAWLER_MOVER: 'WSF_BRAWLER_MOVER',
  };

  const config: any = {
    type: MOVER_TYPE_MAP[moverTypeName] || 'WSF_AIR_MOVER',
    name: block.name || 'main_mover',
    on: true,
    operational: true,
    restorable: true,
    debug: false,
    automaticRecoveryTime: '0.0 sec',
    damageFactor: 1,
    categories: [],
    location: [0, 0, 0],
    yaw: '0 deg',
    pitch: '0 deg',
    roll: '0 deg',
    tilt: '0 deg',
    slewMode: 'both',
    azimuthMin: '-180 deg',
    azimuthMax: '180 deg',
    elevationMin: '-90 deg',
    elevationMax: '90 deg',
  };

  // Apply type block properties first
  for (const [key, value] of typeBlock.properties) {
    applyMoverProperty(config, key, value);
  }
  // Apply instance overrides
  for (const [key, value] of block.properties) {
    applyMoverProperty(config, key, value);
  }

  return config;
}

function applyMoverProperty(config: any, key: string, value: string): void {
  const MAP: Record<string, string> = {
    maximum_speed: 'maximumSpeed', minimum_speed: 'minimumSpeed',
    cruise_speed: 'cruiseSpeed', maximum_altitude: 'maximumAltitude',
    minimum_altitude: 'minimumAltitude', service_ceiling: 'serviceCeiling',
    maximum_range: 'maximumRange', endurance: 'endurance',
    maximum_g: 'maximumG', max_g: 'maximumG',
    maximum_linear_acceleration: 'maximumLinearAcceleration',
    maximum_radial_acceleration: 'maximumRadialAcceleration',
    default_linear_acceleration: 'defaultLinearAcceleration',
    default_radial_acceleration: 'defaultRadialAcceleration',
    default_climb_rate: 'defaultClimbRate', maximum_climb_rate: 'maximumClimbRate',
    roll_rate_limit: 'rollRateLimit', turn_rate_limit: 'turnRateLimit',
    maximum_turn_rate: 'maximumTurnRate', bank_angle_limit: 'bankAngleLimit',
    at_end_of_path: 'atEndOfPath', update_interval: 'updateInterval',
    terrain: 'terrain', altitude_offset: 'altitudeOffset', draw_route: 'drawRoute',
    mass: 'mass', specific_impulse: 'specificImpulse',
    thrust: 'thrust', thrust_duration: 'thrustDuration',
    aero_file: 'aeroFile', update_time_tolerance: 'updateTimeTolerance',
  };
  const propKey = MAP[key];
  if (propKey) config[propKey] = value;
  if (key === 'on') config.on = true;
  if (key === 'off') config.on = false;
  if (key === 'debug') config.debug = true;
}

function parseSensorReference(block: AfsimBlock, typeBlock: AfsimBlock): any {
  const sensorTypeName = typeBlock.typeName || typeBlock.name;
  const SENSOR_TYPE_MAP: Record<string, string> = {
    WSF_RADAR_SENSOR: 'WSF_RADAR_SENSOR',
    WSF_PASSIVE_SENSOR: 'WSF_PASSIVE_SENSOR',
    WSF_EOIR_SENSOR: 'WSF_EOIR_SENSOR',
    WSF_IRST_SENSOR: 'WSF_IRST_SENSOR',
    WSF_ESM_SENSOR: 'WSF_ESM_SENSOR',
    WSF_SAR_SENSOR: 'WSF_SAR_SENSOR',
    WSF_ACOUSTIC_SENSOR: 'WSF_ACOUSTIC_SENSOR',
    WSF_LADAR_SENSOR: 'WSF_LADAR_SENSOR',
    WSF_LASER_DESIGNATOR: 'WSF_LASER_DESIGNATOR',
    WSF_LASER_TRACKER: 'WSF_LASER_TRACKER',
    WSF_GEOMETRIC_SENSOR: 'WSF_GEOMETRIC_SENSOR',
    WSF_COMPOSITE_SENSOR: 'WSF_COMPOSITE_SENSOR',
    WSF_NULL_SENSOR: 'WSF_NULL_SENSOR',
  };

  const config: any = {
    type: SENSOR_TYPE_MAP[sensorTypeName] || 'WSF_RADAR_SENSOR',
    name: block.name || 'Unnamed Sensor',
    on: true,
    operational: true,
    restorable: true,
    debug: false,
    automaticRecoveryTime: '0.0 sec',
    damageFactor: 1,
    categories: [],
    location: [0, 0, 0],
    yaw: '0 deg', pitch: '0 deg', roll: '0 deg', tilt: '0 deg',
    slewMode: 'both',
    azimuthMin: '-180 deg', azimuthMax: '180 deg',
    elevationMin: '-90 deg', elevationMax: '90 deg',
    modes: {},
    template: {},
  };

  // Apply type block properties
  for (const [key, value] of typeBlock.properties) {
    applySensorProperty(config, key, value);
  }
  // Apply type block children (mode_template, mode, etc.)
  for (const child of typeBlock.children) {
    applySensorChild(config, child);
  }

  // Apply instance overrides
  for (const [key, value] of block.properties) {
    applySensorProperty(config, key, value);
  }
  for (const child of block.children) {
    applySensorChild(config, child);
  }

  return config;
}

function applySensorProperty(config: any, key: string, value: string): void {
  if (key === 'on') config.on = true;
  else if (key === 'off') config.on = false;
  else if (key === 'debug') config.debug = true;
  else if (key === 'internal_link') config.internalLink = value;
  else if (key === 'ignore_same_side') config.ignoreSameSide = true;
  else if (key === 'initial_mode') config.initialMode = value;
  else if (key === 'slew_mode') config.slewMode = value;
}

function applySensorChild(config: any, child: AfsimBlock): void {
  if (child.keyword === 'mode_template') {
    config.template = parseSensorMode(child);
  } else if (child.keyword === 'mode') {
    config.modes[child.name] = parseSensorMode(child);
  } else if (child.keyword === 'filter') {
    config.filter = { type: child.typeName || child.name };
    for (const [key, value] of child.properties) {
      config.filter[key] = value;
    }
  }
}

function parseSensorMode(block: AfsimBlock): any {
  const mode: any = { beams: {} };
  for (const [key, value] of block.properties) {
    const MAP: Record<string, string> = {
      azimuth_field_of_view: 'azimuthFieldOfView',
      elevation_field_of_view: 'elevationFieldOfView',
      range_product: 'rangeProduct',
      one_m2_detect_range: 'oneM2_DetectRange',
      frame_time: 'frameTime',
      revisit_time: 'revisitTime',
      dwell_time: 'dwellTime',
      detection_threshold: 'detectionThreshold',
      required_pd: 'requiredPD',
      track_quality: 'trackQuality',
      azimuth_error_sigma: 'azimuthErrorSigma',
      elevation_error_sigma: 'elevationErrorSigma',
      range_error_sigma: 'rangeErrorSigma',
      range_rate_error_sigma: 'rangeRateErrorSigma',
      hits_to_establish_track: 'hitsToEstablishTrack',
      hits_to_maintain_track: 'hitsToMaintainTrack',
      maximum_request_count: 'maximumRequestCount',
      integration_gain: 'integrationGain',
      electronic_beam_steering: 'electronicBeamSteering',
      selection_mode: 'selectionMode',
      slew_mode: 'slewMode',
      detection_sensitivity: 'detectionSensitivity',
      probability_of_false_alarm: 'probabilityOfFalseAlarm',
      swerling_case: 'swerlingCase',
      number_of_pulses_integrated: 'numberOfPulsesIntegrated',
    };
    const propKey = MAP[key];
    if (propKey) mode[propKey] = value;

    // Boolean flags
    if (key === 'reports_location') mode.reportsLocation = true;
    if (key === 'reports_velocity') mode.reportsVelocity = true;
    if (key === 'reports_range') mode.reportsRange = true;
    if (key === 'reports_bearing') mode.reportsBearing = true;
    if (key === 'reports_elevation') mode.reportsElevation = true;
    if (key === 'reports_range_rate') mode.reportsRangeRate = true;
    if (key === 'reports_side') mode.reportsSide = true;
    if (key === 'reports_type') mode.reportsType = true;
    if (key === 'reports_iff') mode.reportsIFF = true;
    if (key === 'reports_signal_to_noise') mode.reportsSignalToNoise = true;
    if (key === 'search_while_track') mode.searchWhileTrack = true;
    if (key === 'disables_search') mode.disablesSearch = true;
    if (key === 'transmit_only') mode.transmitOnly = true;
    if (key === 'receive_only') mode.receiveOnly = true;
  }

  for (const child of block.children) {
    if (child.keyword === 'transmitter') {
      mode.transmitter = parseTransmitterBlock(child);
    } else if (child.keyword === 'receiver') {
      mode.receiver = parseReceiverBlock(child);
    }
  }

  return mode;
}

function parseTransmitterBlock(block: AfsimBlock): any {
  const tx: any = {};
  for (const [key, value] of block.properties) {
    const MAP: Record<string, string> = {
      frequency: 'frequency', power: 'power', bandwidth: 'bandwidth',
      pulse_width: 'pulseWidth', pulse_repetition_frequency: 'pulseRepetitionFrequency',
      prf: 'pulseRepetitionFrequency', pulse_repetition_interval: 'pulseRepetitionInterval',
      duty_cycle: 'dutyCycle', polarization: 'polarization',
      internal_loss: 'internalLoss', antenna_pattern: 'antennaPattern',
      wavelength: 'wavelength', pulse_compression_ratio: 'pulseCompressionRatio',
    };
    const propKey = MAP[key];
    if (propKey) tx[propKey] = value;
  }
  return tx;
}

function parseReceiverBlock(block: AfsimBlock): any {
  const rx: any = {};
  for (const [key, value] of block.properties) {
    const MAP: Record<string, string> = {
      bandwidth: 'bandwidth', frequency: 'frequency',
      internal_loss: 'internalLoss', noise_power: 'noisePower',
      noise_figure: 'noiseFigure', polarization: 'polarization',
      detection_threshold: 'detectionThreshold',
      instantaneous_bandwidth: 'instantaneousBandwidth',
      antenna_pattern: 'antennaPattern', wavelength: 'wavelength',
    };
    const propKey = MAP[key];
    if (propKey) rx[propKey] = value;
  }
  return rx;
}

function parseWeaponReference(block: AfsimBlock, typeBlock: AfsimBlock): any {
  const weaponTypeName = typeBlock.typeName || typeBlock.name;
  const WEAPON_TYPE_MAP: Record<string, string> = {
    WSF_IMPLICIT_WEAPON: 'WSF_IMPLICIT_WEAPON',
    WSF_EXPLICIT_WEAPON: 'WSF_EXPLICIT_WEAPON',
    WSF_RF_JAMMER: 'WSF_RF_JAMMER',
    WSF_LASER_WEAPON: 'WSF_LASER_WEAPON',
    WSF_CUED_LASER_WEAPON: 'WSF_CUED_LASER_WEAPON',
  };

  const config: any = {
    type: WEAPON_TYPE_MAP[weaponTypeName] || 'WSF_IMPLICIT_WEAPON',
    name: block.name || 'Unnamed Weapon',
    on: true, operational: true, restorable: true, debug: false,
    automaticRecoveryTime: '0.0 sec', damageFactor: 1, categories: [],
    location: [0, 0, 0],
    yaw: '0 deg', pitch: '0 deg', roll: '0 deg', tilt: '0 deg',
    slewMode: 'both',
    azimuthMin: '-180 deg', azimuthMax: '180 deg',
    elevationMin: '-90 deg', elevationMax: '90 deg',
    quantity: 1, maximumQuantity: 1,
    automaticTargetCueing: true, cueToPredictedIntercept: true,
    inhibitWhileReloading: false,
  };

  // Apply type block properties
  for (const [key, value] of typeBlock.properties) {
    applyWeaponProperty(config, key, value);
  }
  // Apply type block children
  for (const child of typeBlock.children) {
    if (child.keyword === 'launch_computer') {
      config.launchComputer = parseLaunchComputerBlock(child);
    }
  }

  // Apply instance overrides
  for (const [key, value] of block.properties) {
    applyWeaponProperty(config, key, value);
  }
  for (const child of block.children) {
    if (child.keyword === 'launch_computer') {
      config.launchComputer = parseLaunchComputerBlock(child);
    }
  }

  return config;
}

function applyWeaponProperty(config: any, key: string, value: string): void {
  const MAP: Record<string, string> = {
    quantity: 'quantity', maximum_quantity: 'maximumQuantity',
    launched_platform_type: 'launchedPlatformType',
    firing_interval: 'firingInterval', firing_delay: 'firingDelay',
    salvo_interval: 'salvoInterval', update_interval: 'updateInterval',
    reload_time: 'reloadTime',
    automatic_target_cueing: 'automaticTargetCueing',
    cue_to_predicted_intercept: 'cueToPredictedIntercept',
    inhibit_while_reloading: 'inhibitWhileReloading',
    weapon_effects: 'weaponEffects',
    unknown_target_range: 'unknownTargetRange',
    unknown_target_altitude: 'unknownTargetAltitude',
    slew_mode: 'slewMode',
  };
  const NUMERIC_KEYS = new Set(['quantity', 'maximum_quantity']);
  const propKey = MAP[key];
  if (propKey) {
    config[propKey] = NUMERIC_KEYS.has(key) ? Number(value) : value;
  }
  if (key === 'on') config.on = true;
  if (key === 'off') config.on = false;
  if (key === 'debug') config.debug = true;
}

function parseLaunchComputerBlock(block: AfsimBlock): any {
  const lc: any = { type: block.typeName || block.name || 'WSF_LAUNCH_COMPUTER' };
  for (const [key, value] of block.properties) {
    const MAP: Record<string, string> = {
      maximum_delta_altitude: 'maximumDeltaAltitude',
      minimum_delta_altitude: 'minimumDeltaAltitude',
      maximum_slant_range: 'maximumSlantRange',
      minimum_slant_range: 'minimumSlantRange',
      maximum_time_of_flight: 'maximumTimeOfFlight',
      maximum_boresight_angle: 'maximumBoresightAngle',
      thrust_duration: 'thrustDuration',
      coast_duration: 'coastDuration',
      burnout_speed: 'burnoutSpeed',
      load_table: 'loadTable',
    };
    const propKey = MAP[key];
    if (propKey) lc[propKey] = value;
  }
  return lc;
}

function parseProcessorBlock(block: AfsimBlock, typeBlock: AfsimBlock): any {
  const procTypeName = typeBlock.typeName || typeBlock.name;
  const PROC_TYPE_MAP: Record<string, string> = {
    WSF_SCRIPT_PROCESSOR: 'WSF_SCRIPT_PROCESSOR',
    WSF_TRACK_PROCESSOR: 'WSF_TRACK_PROCESSOR',
    WSF_MESSAGE_PROCESSOR: 'WSF_MESSAGE_PROCESSOR',
    WSF_EXCHANGE_PROCESSOR: 'WSF_EXCHANGE_PROCESSOR',
    WSF_DELAY_PROCESSOR: 'WSF_DELAY_PROCESSOR',
    WSF_LINKED_PROCESSOR: 'WSF_LINKED_PROCESSOR',
    WSF_LINKED_SCRIPT_PROCESSOR: 'WSF_LINKED_SCRIPT_PROCESSOR',
    WSF_PERFECT_TRACKER: 'WSF_PERFECT_TRACKER',
    WSF_THREAT_PROCESSOR: 'WSF_THREAT_PROCESSOR',
    WSF_INTERSECT_PROCESSOR: 'WSF_INTERSECT_PROCESSOR',
    WSF_SA_PROCESSOR: 'WSF_SA_PROCESSOR',
    WSF_TASK_PROCESSOR: 'WSF_TASK_PROCESSOR',
    WSF_PERCEPTION_PROCESSOR: 'WSF_PERCEPTION_PROCESSOR',
    WSF_GUIDANCE_COMPUTER: 'WSF_GUIDANCE_COMPUTER',
    WSF_WEAPON_TRACK_PROCESSOR: 'WSF_WEAPON_TRACK_PROCESSOR',
    WSF_SENSOR_CUE_PROCESSOR: 'WSF_SENSOR_CUE_PROCESSOR',
    WSF_WEAPON_DL_MANAGER: 'WSF_WEAPON_DL_MANAGER',
    WSF_BRAWLER_PROCESSOR: 'WSF_BRAWLER_PROCESSOR',
    WSF_AIR_TARGET_FUSE: 'WSF_AIR_TARGET_FUSE',
  };

  const config: any = {
    type: PROC_TYPE_MAP[procTypeName] || 'WSF_SCRIPT_PROCESSOR',
    name: block.name || 'Unnamed Processor',
    on: true, operational: true, restorable: true, debug: false,
    automaticRecoveryTime: '0.0 sec', damageFactor: 1, categories: [],
  };

  // Apply type block properties
  for (const [key, value] of typeBlock.properties) {
    applyProcessorProperty(config, key, value);
  }
  // Apply type block children
  for (const child of typeBlock.children) {
    applyProcessorChild(config, child);
  }

  // Apply instance overrides
  for (const [key, value] of block.properties) {
    applyProcessorProperty(config, key, value);
  }
  for (const child of block.children) {
    applyProcessorChild(config, child);
  }

  return config;
}

function applyProcessorProperty(config: any, key: string, value: string): void {
  if (key === 'on') config.on = true;
  else if (key === 'off') config.on = false;
  else if (key === 'debug') config.debug = true;
  else if (key === 'update_interval') config.updateInterval = value;
  else if (key === 'purge_interval') config.purgeInterval = value;
  else if (key === 'master_track_processor') config.masterTrackProcessor = value === 'true';
  else if (key === 'report_interval') config.reportInterval = value;
  else if (key === 'report_method') config.reportMethod = value;
  else if (key === 'report_fused_tracks') config.reportFusedTracks = value === 'true';
  else if (key === 'report_candidate_tracks') config.reportCandidateTracks = value === 'true';
  else if (key === 'report_unchanged_tracks') config.reportUnchangedTracks = value === 'true';
  else if (key === 'drop_after_inactive') config.dropAfterInactive = value;
  else if (key === 'enemy_side') config.enemySide = value;
  else if (key === 'friendly_side') config.friendlySide = value;
  else if (key === 'neutral_side') config.neutralSide = value;
  else if (key === 'missile_speed_any_alt') config.missileSpeedAnyAlt = value;
  else if (key === 'missile_distance') config.missileDistance = value;
  else if (key === 'max_range_for_perceived_assets') config.maxRangeForPerceivedAssets = value;
  else if (key === 'flight_id') config.flightId = parseInt(value);
  else if (key === 'id_flag') config.idFlag = value;
  else if (key === 'bingo_fuel') config.bingoFuel = value;
  else if (key === 'joker_fuel') config.jokerFuel = value;
  else if (key === 'queuing_method') config.queuingMethod = value;
  else if (key === 'number_of_servers') config.numberOfServers = value;
  else if (key === 'threat_velocity') config.threatVelocity = value;
  else if (key === 'threat_angle_spread') config.threatAngleSpread = value;
  else if (key === 'threat_time_to_intercept') config.threatTimeToIntercept = value;
  else if (key === 'mind_file') config.mindFile = value;
  else if (key === 'aero_file') config.aeroFile = value;
  else if (key === 'max_time_of_flight') config.maxTimeOfFlight = value;
  else if (key === 'coast_time') config.coastTime = value;
  else if (key === 'proportional_navigation_gain') config.proportionalNavigationGain = value;
  else if (key === 'velocity_pursuit_gain') config.velocityPursuitGain = value;
  else if (key === 'g_bias') config.gBias = value;
  else if (key === 'max_commanded_g') config.maxCommandedG = value;
  else if (key === 'network_name') config.networkName = value;
  else if (key === 'network_address') config.networkAddress = value;
}

function applyProcessorChild(config: any, child: AfsimBlock): void {
  if (child.keyword === 'script' || child.keyword === 'on_update' ||
      child.keyword === 'on_initialize' || child.keyword === 'on_entry' ||
      child.keyword === 'on_exit') {
    const content = extractBlockContent(child);
    if (child.keyword === 'script') config.script = content;
    else if (child.keyword === 'on_update') config.onUpdate = content;
    else if (child.keyword === 'on_initialize') config.onInitialize = content;
    else if (child.keyword === 'on_entry') config.onEntry = content;
    else if (child.keyword === 'on_exit') config.onExit = content;
  } else if (child.keyword === 'track_manager') {
    config.trackManager = parseTrackManagerBlock(child);
  } else if (child.keyword === 'sa_perceive') {
    config.perceive = parseSaPerceiveBlock(child);
  } else if (child.keyword === 'sa_assess') {
    config.assess = parseSaAssessBlock(child);
  }
}

function extractBlockContent(block: AfsimBlock): string {
  const lines: string[] = [];
  for (const [key, value] of block.properties) {
    if (value) lines.push(`${key} ${value}`);
    else lines.push(key);
  }
  return lines.join('\n');
}

function parseTrackManagerBlock(block: AfsimBlock): any {
  const tm: any = {};
  for (const [key, value] of block.properties) {
    if (key === 'correlation_method') tm.correlationMethod = value;
    else if (key === 'fusion_method') tm.fusionMethod = value;
    else if (key === 'tracker_type') tm.trackerType = value;
    else if (key === 'framed') tm.framed = value === 'true';
    else if (key === 'drop_uncorrelated_tracks') tm.dropUncorrelatedTracks = value === 'true';
    else if (key === 'retain_raw_tracks') tm.retainRawTracks = value === 'true';
    else if (key === 'tracking_sigma') tm.trackingSigma = value;
    else if (key === 'turning_sigma') tm.turningSigma = value;
    else if (key === 'coast_time') tm.coastTime = value;
    else if (key === 'precise_mode') tm.preciseMode = value === 'true';
    else if (key === 'maximum_correlation_distance') tm.maximumCorrelationDistance = value;
  }
  return tm;
}

function parseSaPerceiveBlock(block: AfsimBlock): any {
  const p: any = {};
  for (const [key, value] of block.properties) {
    if (key === 'reporting_self') p.reportingSelf = value === 'true';
    else if (key === 'reports_self') p.reportsSelf = value === 'true';
    else if (key === 'reporting_others') p.reportingOthers = value === 'true';
    else if (key === 'reports_others') p.reportsOthers = value === 'true';
    else if (key === 'perceive_self') p.perceiveSelf = value === 'true';
    else if (key === 'num_chaff') p.numChaff = parseInt(value);
    else if (key === 'num_flares') p.numFlares = parseInt(value);
    else if (key === 'num_decoys') p.numDecoys = parseInt(value);
  }
  return p;
}

function parseSaAssessBlock(block: AfsimBlock): any {
  const a: any = {};
  for (const [key, value] of block.properties) {
    if (key === 'mission_task') a.missionTask = value;
    else if (key === 'max_prioritized_threats') a.maxPrioritizedThreats = parseInt(value);
    else if (key === 'max_prioritized_targets') a.maxPrioritizedTargets = parseInt(value);
  }
  return a;
}

function parseCommBlock(block: AfsimBlock): any {
  const commTypeName = block.typeName || block.name;
  const COMM_TYPE_MAP: Record<string, string> = {
    WSF_COMM_TRANSCEIVER: 'WSF_COMM_TRANSCEIVER',
    WSF_COMM_RCVR: 'WSF_COMM_RCVR',
    WSF_COMM_XMTR: 'WSF_COMM_XMTR',
    WSF_RADIO_TRANSCEIVER: 'WSF_RADIO_TRANSCEIVER',
    WSF_RADIO_RCVR: 'WSF_RADIO_RCVR',
    WSF_RADIO_XMTR: 'WSF_RADIO_XMTR',
    WSF_SUBSURFACE_RADIO_TRANSCEIVER: 'WSF_SUBSURFACE_RADIO_TRANSCEIVER',
  };

  const config: any = {
    type: COMM_TYPE_MAP[commTypeName] || 'WSF_COMM_TRANSCEIVER',
    name: block.name || 'Unnamed Comm',
    on: true, operational: true, restorable: true, debug: false,
    automaticRecoveryTime: '0.0 sec', damageFactor: 1, categories: [],
    location: [0, 0, 0],
    yaw: '0 deg', pitch: '0 deg', roll: '0 deg', tilt: '0 deg',
    slewMode: 'both',
    azimuthMin: '-180 deg', azimuthMax: '180 deg',
    elevationMin: '-90 deg', elevationMax: '90 deg',
  };

  for (const [key, value] of block.properties) {
    if (key === 'on') config.on = true;
    else if (key === 'off') config.on = false;
    else if (key === 'debug') config.debug = true;
    else if (key === 'network_name') config.networkName = value;
    else if (key === 'network_address') config.networkAddress = value;
    else if (key === 'address') config.address = value;
    else if (key === 'router_name') config.routerName = value;
    else if (key === 'channels') config.channels = parseInt(value);
  }

  for (const child of block.children) {
    if (child.keyword === 'comm_medium') config.medium = parseCommMediumBlock(child);
    else if (child.keyword === 'datalink_layer') config.datalinkLayer = parseDatalinkLayerBlock(child);
    else if (child.keyword === 'transmitter') config.transmitter = parseTransmitterBlock(child);
    else if (child.keyword === 'receiver') config.receiver = parseReceiverBlock(child);
  }

  return config;
}

function parseCommMediumBlock(block: AfsimBlock): any {
  const medium: any = {};
  for (const [key, value] of block.properties) {
    if (key === 'propagation_speed') medium.propagationSpeed = value;
    else if (key === 'transfer_rate') medium.transferRate = value;
    else if (key === 'packet_loss_time') medium.packetLossTime = value;
    else if (key === 'bit_error_probability') medium.bitErrorProbability = parseFloat(value);
    else if (key === 'error_correction') medium.errorCorrection = parseFloat(value);
  }
  return medium;
}

function parseDatalinkLayerBlock(block: AfsimBlock): any {
  const dl: any = {};
  for (const [key, value] of block.properties) {
    if (key === 'queue_type') dl.queueType = value;
    else if (key === 'queue_limit') dl.queueLimit = parseInt(value);
    else if (key === 'retransmit_attempts') dl.retransmitAttempts = parseInt(value);
    else if (key === 'retransmit_delay') dl.retransmitDelay = value;
    else if (key === 'purge_interval') dl.purgeInterval = value;
  }
  return dl;
}

function parseFuelBlock(block: AfsimBlock, typeBlock: AfsimBlock): any {
  const fuelTypeName = typeBlock.name || typeBlock.typeName;
  const FUEL_TYPE_MAP: Record<string, string> = {
    WSF_FUEL: 'WSF_FUEL',
    WSF_VARIABLE_RATE_FUEL: 'WSF_VARIABLE_RATE_FUEL',
    WSF_TABULAR_RATE_FUEL: 'WSF_TABULAR_RATE_FUEL',
    WSF_TANKED_FUEL: 'WSF_TANKED_FUEL',
  };

  const config: any = {
    type: FUEL_TYPE_MAP[fuelTypeName] || 'WSF_FUEL',
    name: block.name || 'main_fuel',
    on: true, operational: true, restorable: true, debug: false,
    automaticRecoveryTime: '0.0 sec', damageFactor: 1, categories: [],
  };

  // Apply type block properties
  for (const [key, value] of typeBlock.properties) {
    applyFuelProperty(config, key, value);
  }
  // Apply instance overrides
  for (const [key, value] of block.properties) {
    applyFuelProperty(config, key, value);
  }

  return config;
}

function applyFuelProperty(config: any, key: string, value: string): void {
  if (key === 'on') config.on = true;
  else if (key === 'off') config.on = false;
  else if (key === 'debug') config.debug = true;
  else if (key === 'maximum_quantity') config.maximumQuantity = value;
  else if (key === 'initial_quantity') config.initialQuantity = value;
  else if (key === 'initial_quantity_ratio') config.initialQuantityRatio = value;
  else if (key === 'reserve_quantity') config.reserveQuantity = value;
  else if (key === 'reserve_fuel') config.reserveFuel = value;
  else if (key === 'bingo_quantity') config.bingoQuantity = value;
  else if (key === 'consumption_rate') config.consumptionRate = value;
  else if (key === 'rate') config.rate = value;
  else if (key === 'mode') config.mode = value;
  else if (key === 'aero_file') config.aeroFile = value;
}
