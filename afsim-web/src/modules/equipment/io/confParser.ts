// ============================================================
// Equipment I/O - AFSIM .txt Parser
// Parses real AFSIM syntax: platform_type/end_platform_type,
// sensor/end_sensor, weapon/end_weapon, etc.
// ============================================================

import type {
  AfsimEquipment,
  AfsimPlatform,
  AfsimSensorConfig,
  AfsimWeaponConfig,
  AfsimCommConfig,
  AfsimMoverConfig,
  AfsimProcessorConfig,
  AfsimFuelConfig,
  AdvancedBehaviorTreeConfig,
  BehaviorTreeNode,
  BehaviorCompositeKind,
  BehaviorRepeaterMode,
} from '../afsim/types';
import { createEmptyEquipment } from '../afsim/types';

// ============================================================
// Public Types
// ============================================================

export interface AfsimParseResult {
  equipment: AfsimEquipment[];
  errors: AfsimParseError[];
  total: number;
}

export interface AfsimParseError {
  line: number;
  message: string;
}

/** A parsed AFSIM block: keyword name [type] ... end_keyword */
export interface AfsimBlock {
  keyword: string;      // e.g. 'platform_type', 'sensor', 'mover'
  name: string;         // e.g. 'BLUE_STRIKER', 'blue_a2a_radar'
  typeName: string;     // e.g. 'WSF_PLATFORM', 'BLUE_A2A_RADAR' (the parent/type reference)
  properties: Map<string, string>;
  children: AfsimBlock[];
  startLine: number;
  /** 块起始行中第 4 个及以后的 token（如 "decorator repeater repeat 20" 中的 "20"） */
  extra?: string;
}

/** Type registry entry for standalone type definitions */
export interface TypeRegistryEntry {
  keyword: string;
  name: string;
  block: AfsimBlock;
}

// ============================================================
// Block keyword → end_keyword mapping
// ============================================================

const BLOCK_KEYWORDS: Record<string, string> = {
  // Platform types
  platform_type: 'end_platform_type',
  platform: 'end_platform',
  // Subsystems
  sensor: 'end_sensor',
  weapon: 'end_weapon',
  mover: 'end_mover',
  processor: 'end_processor',
  comm: 'end_comm',
  fuel: 'end_fuel',
  // Weapon subsystems
  launch_computer: 'end_launch_computer',
  weapon_effects: 'end_weapon_effects',
  // Signatures
  radar_signature: 'end_radar_signature',
  infrared_signature: 'end_infrared_signature',
  optical_signature: 'end_optical_signature',
  // Antenna
  antenna_pattern: 'end_antenna_pattern',
  // Aero
  aero: 'end_aero',
  // Sensor internals
  mode_template: 'end_mode_template',
  mode: 'end_mode',
  transmitter: 'end_transmitter',
  receiver: 'end_receiver',
  filter: 'end_filter',
  // Track/guidance
  track_manager: 'end_track_manager',
  // Weapon internals
  guidance_computer: 'end_guidance_computer',
  // Comm internals
  comm_medium: 'end_comm_medium',
  datalink_layer: 'end_datalink_layer',
  // Route
  route: 'end_route',
  // Observer
  observer: 'end_observer',
  // Script blocks
  script: 'end_script',
  on_initialize: 'end_on_initialize',
  on_update: 'end_on_update',
  on_entry: 'end_on_entry',
  on_exit: 'end_on_exit',
  // Misc
  xobject: 'end_xobject',
  bistatic_signature: 'end_bistatic_signature',
  state: 'end_state',
  polarization: 'end_polarization',
  inline_table: 'end_inline_table',
  behavior_node: 'end_behavior_node',
  advanced_behavior_tree: 'end_advanced_behavior_tree',
  // Advanced behavior tree composite/decorator nodes
  sequence: 'end_sequence',
  sequence_with_memory: 'end_sequence_with_memory',
  selector: 'end_selector',
  selector_with_memory: 'end_selector_with_memory',
  parallel: 'end_parallel',
  priority_selector: 'end_priority_selector',
  weighted_random: 'end_weighted_random',
  decorator: 'end_decorator',
  script_variables: 'end_script_variables',
  event_pipe: 'end_event_pipe',
  event_output: 'end_event_output',
  execute: 'end_execute',
  perception: 'end_perception',
  sa_perceive: 'end_sa_perceive',
  sa_assess: 'end_sa_assess',
  missile_wez: 'end_missile_wez',
  service: 'end_service',
  commodity: 'end_commodity',
  fuel_table: 'end_fuel_table',
  error_model_parameters: 'end_error_model_parameters',
  detection_probability: 'end_detection_probability',
  signal_processor: 'end_signal_processor',
};

// Top-level standalone type definitions (can exist outside platform_type)
const TOP_LEVEL_KEYWORDS = new Set([
  'platform_type', 'platform',
  'sensor', 'weapon', 'mover', 'processor', 'comm', 'fuel',
  'launch_computer', 'weapon_effects',
  'radar_signature', 'infrared_signature', 'optical_signature',
  'antenna_pattern', 'aero',
  'observer', 'route',
]);

// Subsystem keywords inside platform_type
const SUBSYSTEM_KEYWORDS = new Set([
  'sensor', 'weapon', 'mover', 'processor', 'comm', 'fuel',
  'radar_signature', 'weapon_effects',
]);

// ============================================================
// Public API
// ============================================================

/**
 * Parse AFSIM .txt text into AfsimEquipment array.
 * Supports real AFSIM syntax: platform_type/end_platform_type, etc.
 */
export function parseAfsimConf(text: string): AfsimParseResult {
  const lines = text.split('\n');
  const errors: AfsimParseError[] = [];

  // Step 1: Parse all blocks
  const blocks = parseBlocks(lines, errors);

  // Step 2: Build type registry from standalone definitions
  const typeRegistry = buildTypeRegistry(blocks);

  // Step 3: Convert platform_type blocks to AfsimEquipment
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

  return { equipment, errors, total: blocks.length };
}

/**
 * Parse a single AfsimEquipment from .txt text.
 */
export function parseSingleAfsimConf(text: string): { equipment: AfsimEquipment | null; errors: AfsimParseError[] } {
  const result = parseAfsimConf(text);
  return {
    equipment: result.equipment[0] ?? null,
    errors: result.errors,
  };
}

/**
 * Parse text and return raw blocks (for advanced usage / type registry building).
 */
export function parseRawBlocks(text: string): { blocks: AfsimBlock[]; errors: AfsimParseError[] } {
  const lines = text.split('\n');
  const errors: AfsimParseError[] = [];
  const blocks = parseBlocks(lines, errors);
  return { blocks, errors };
}

// ============================================================
// Block parser
// ============================================================

function parseBlocks(lines: string[], errors: AfsimParseError[]): AfsimBlock[] {
  const rootBlocks: AfsimBlock[] = [];
  const stack: { block: AfsimBlock; indent: number; endKeyword: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    const indent = rawLine.search(/\S/);

    // Check for block end
    if (stack.length > 0 && trimmed === stack[stack.length - 1].endKeyword) {
      stack.pop();
      continue;
    }

    // Check for include directives
    if (trimmed.startsWith('include_once ') || trimmed.startsWith('include ')) {
      // Include directives are handled at a higher level (afsimImporter)
      // For single-file parsing, we just skip them
      continue;
    }

    // Skip non-block directives
    if (trimmed.startsWith('file_path ') ||
        trimmed.startsWith('define_path_variable ') ||
        trimmed.startsWith('log_file ') ||
        trimmed.startsWith('end_time ') ||
        trimmed.startsWith('random_seed ') ||
        trimmed.startsWith('end_')) {
      continue;
    }

    // Try to match block start: keyword name [typeName]
    const blockStart = matchBlockStart(trimmed);
    if (blockStart) {
      const endKw = BLOCK_KEYWORDS[blockStart.keyword];

      // Check for inline end first: e.g., "weapon int_missile TYPE end_weapon"
      const tokens = tokenize(trimmed);
      const isInlineEnd = tokens.length > 1 && tokens[tokens.length - 1] === endKw;

      // If NOT an inline end, verify end_keyword exists ahead (context-sensitive disambiguation)
      // This prevents "fuel 50.0 kg" inside a mover from being treated as a block
      if (!isInlineEnd && !hasEndKeywordAhead(lines, i, endKw)) {
        // Not a block — treat as property line
        parsePropertyLine(trimmed, stack.length > 0 ? stack[stack.length - 1].block : { properties: new Map() } as any);
        continue;
      }

      const block: AfsimBlock = {
        keyword: blockStart.keyword,
        name: blockStart.name,
        typeName: blockStart.typeName,
        properties: new Map(),
        children: [],
        startLine: i + 1,
        extra: blockStart.extra,
      };

      if (stack.length === 0) {
        rootBlocks.push(block);
      } else {
        stack[stack.length - 1].block.children.push(block);
      }

      // Only push to stack if NOT an inline end
      if (!isInlineEnd) {
        stack.push({ block, indent, endKeyword: endKw });
      }
      continue;
    }

    // Property line: key value or key "quoted value"
    if (stack.length > 0) {
      parsePropertyLine(trimmed, stack[stack.length - 1].block);
    }
  }

  // Check unclosed blocks
  for (const item of stack) {
    errors.push({
      line: item.block.startLine,
      message: `Unclosed ${item.block.keyword} ${item.block.name} (expected ${item.endKeyword})`,
    });
  }

  return rootBlocks;
}

/**
 * Try to match a block start line.
 * Pattern: keyword [name] [typeName]
 * Examples:
 *   platform_type BLUE_STRIKER BLUE_ADV_FIGHTER_1_BASE
 *   sensor blue_a2a_radar BLUE_A2A_RADAR
 *   mover WSF_AIR_MOVER
 *   mode 120X10
 *   mode_template
 *   transmitter
 */
function matchBlockStart(trimmed: string): { keyword: string; name: string; typeName: string; extra?: string } | null {
  // Split into tokens, respecting quoted strings
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return null;

  const keyword = tokens[0];
  const endKeyword = BLOCK_KEYWORDS[keyword];
  if (!endKeyword) return null;

  // Check this isn't an end_ line that we missed
  if (keyword.startsWith('end_')) return null;

  // Special case: single-word blocks like "mode_template", "transmitter", "receiver"
  if (tokens.length === 1) {
    // For mode_template, we need to check if the end_keyword exists ahead
    // But for simplicity, we accept single-word blocks
    return { keyword, name: '', typeName: '' };
  }

  // Two tokens: keyword name (e.g., "mover WSF_AIR_MOVER", "mode 120X10")
  if (tokens.length === 2) {
    return { keyword, name: tokens[1], typeName: '' };
  }

  // Strip inline end keyword if present (e.g., "weapon name type end_weapon")
  const endKw = BLOCK_KEYWORDS[keyword];
  let effectiveTokens = tokens;
  if (endKw && tokens.length > 1 && tokens[tokens.length - 1] === endKw) {
    effectiveTokens = tokens.slice(0, -1);
  }

  // Three tokens: keyword name typeName (e.g., "platform_type BLUE_STRIKER BLUE_ADV_FIGHTER_1_BASE")
  // Four+ tokens (e.g., "decorator repeater repeat 20", "decorator repeater for 5 minutes"):
  // keep the trailing tokens in `extra` so callers needing them (behavior tree repeater args) can recover them.
  if (effectiveTokens.length >= 3) {
    const extra = effectiveTokens.length > 3 ? effectiveTokens.slice(3).join(' ') : undefined;
    return { keyword, name: effectiveTokens[1], typeName: effectiveTokens[2], extra };
  }
  if (effectiveTokens.length === 2) {
    return { keyword, name: effectiveTokens[1], typeName: '' };
  }
  return { keyword, name: '', typeName: '' };
}

/**
 * Tokenize a line, respecting quoted strings.
 */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    // Skip whitespace
    while (i < line.length && /\s/.test(line[i])) i++;
    if (i >= line.length) break;

    if (line[i] === '"') {
      // Quoted string
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      tokens.push(line.substring(i + 1, j));
      i = j + 1;
    } else {
      // Unquoted token
      let j = i;
      while (j < line.length && !/\s/.test(line[j])) j++;
      tokens.push(line.substring(i, j));
      i = j;
    }
  }
  return tokens;
}

/**
 * Parse a property line and add to block.
 * Handles: key value, key "quoted value", key val1 val2 val3
 */
function parsePropertyLine(trimmed: string, block: AfsimBlock): void {
  // Note: block starts are already filtered in the main parser loop via
  // matchBlockStart + hasEndKeywordAhead. We do NOT skip BLOCK_KEYWORDS here
  // because properties like "radar_signature 10dB_FuzzBall" use the same keywords.

  // Strip inline comments (// ...) outside of quoted strings
  const clean = trimmed.replace(/\/\/.*$/, '').trim();
  if (!clean) return;

  // Handle key-value pairs
  const quotedMatch = clean.match(/^(\w+)\s+"([^"]*)"(.*)?$/);
  if (quotedMatch) {
    const key = quotedMatch[1];
    const value = quotedMatch[2];
    const rest = quotedMatch[3]?.trim();
    block.properties.set(key, rest ? `${value} ${rest}` : value);
    return;
  }

  // Handle key with multiple values
  const propMatch = clean.match(/^(\w+)\s+(.+)$/);
  if (propMatch) {
    const key = propMatch[1];
    const value = propMatch[2].replace(/^"(.*)"$/, '$1');
    // Append if key already exists (for multi-value properties)
    const existing = block.properties.get(key);
    if (existing !== undefined) {
      block.properties.set(key, `${existing} ${value}`);
    } else {
      block.properties.set(key, value);
    }
    return;
  }

  // Single-word key (boolean flags like "on", "off", "debug")
  const singleKeyMatch = clean.match(/^(\w+)$/);
  if (singleKeyMatch) {
    block.properties.set(singleKeyMatch[1], '');
  }
}

// ============================================================
// Type registry
// ============================================================

function buildTypeRegistry(blocks: AfsimBlock[]): Map<string, TypeRegistryEntry> {
  const registry = new Map<string, TypeRegistryEntry>();

  for (const block of blocks) {
    if (TOP_LEVEL_KEYWORDS.has(block.keyword) && block.name) {
      registry.set(block.name, {
        keyword: block.keyword,
        name: block.name,
        block,
      });
    }
  }

  return registry;
}

// ============================================================
// Platform type → AfsimEquipment
// ============================================================

function platformTypeToEquipment(
  block: AfsimBlock,
  typeRegistry: Map<string, TypeRegistryEntry>,
  _errors: AfsimParseError[],
): AfsimEquipment {
  const eq = createEmptyEquipment();
  eq.name = block.name || 'Unnamed';
  eq.parentType = block.typeName || undefined;

  const platform = eq.platform;

  // Process platform-level properties
  for (const [key, value] of block.properties) {
    applyPlatformProperty(platform, key, value);
  }

  // Process child blocks
  for (const child of block.children) {
    applyChildBlock(platform, child, typeRegistry);
  }

  return eq;
}

function applyPlatformProperty(platform: AfsimPlatform, key: string, value: string): void {
  switch (key) {
    case 'side':
      platform.side = value;
      break;
    case 'icon':
      platform.icon = value;
      break;
    case 'marking':
      platform.marking = value;
      break;
    case 'destructible':
      platform.destructible = value !== 'false';
      break;
    case 'domain':
      platform.spatialDomain = value as AfsimPlatform['spatialDomain'];
      break;
    case 'altitude':
      platform.altitude = value;
      break;
    case 'altitude_reference':
      platform.altitudeReference = value as AfsimPlatform['altitudeReference'];
      break;
    case 'heading':
      platform.heading = value;
      break;
    case 'pitch':
      platform.pitch = value;
      break;
    case 'roll':
      platform.roll = value;
      break;
    case 'empty_mass':
      platform.emptyMass = value;
      break;
    case 'fuel_mass':
      platform.fuelMass = value;
      break;
    case 'payload_mass':
      platform.payloadMass = value;
      break;
    case 'length':
      platform.length = value;
      break;
    case 'width':
      platform.width = value;
      break;
    case 'height':
      platform.height = value;
      break;
    case 'concealment_factor':
      platform.concealmentFactor = parseFloat(value);
      break;
    case 'initial_damage_factor':
      platform.initialDamageFactor = parseFloat(value);
      break;
    case 'radar_signature':
      platform.radarSignature = value;
      break;
    case 'intersect_mesh':
      platform.intersectMesh = value;
      break;
    case 'category':
      // AFSIM uses single category string, we store as array
      platform.categories = value.split(/\s+/).filter(Boolean);
      break;
    case 'categories':
      platform.categories = value.split(/\s+/).filter(Boolean);
      break;
    case 'creation_time':
      platform.creationTime = value;
      break;
    // Position (for platform instances)
    case 'position':
      {
        const parts = value.split(/\s+/).map(Number);
        if (parts.length >= 2) {
          platform.position = { type: 'latlon', latitude: parts[0], longitude: parts[1] };
        }
      }
      break;
  }
}

function applyChildBlock(
  platform: AfsimPlatform,
  child: AfsimBlock,
  _typeRegistry: Map<string, TypeRegistryEntry>,
): void {
  switch (child.keyword) {
    case 'mover':
      platform.movers[child.name || 'main_mover'] = parseMoverBlock(child);
      break;
    case 'sensor':
      platform.sensors[child.name] = parseSensorReference(child);
      break;
    case 'weapon':
      platform.weapons[child.name] = parseWeaponReference(child);
      break;
    case 'processor':
      platform.processors[child.name] = parseProcessorBlock(child);
      break;
    case 'comm':
      platform.comms[child.name] = parseCommBlock(child);
      break;
    case 'fuel':
      platform.fuels[child.name || 'main_fuel'] = parseFuelBlock(child);
      break;
    case 'radar_signature':
      platform.radarSignature = child.name;
      break;
    case 'route':
      // Route blocks are handled separately (scenario level)
      break;
  }
}

// ============================================================
// Mover parsing
// ============================================================

function parseMoverBlock(block: AfsimBlock): AfsimMoverConfig {
  // Determine mover type from the typeName or name
  const moverTypeName = block.name || block.typeName;
  const MOVER_TYPE_MAP: Record<string, AfsimMoverConfig['type']> = {
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
    WSF_POINT_MASS_SIX_DOF_MOVER: 'WSF_POINT_MASS_SIX_DOF_MOVER',
  };

  const moverType = MOVER_TYPE_MAP[moverTypeName] || 'WSF_AIR_MOVER';

  const config: any = {
    type: moverType,
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

  // Apply properties
  for (const [key, value] of block.properties) {
    applyMoverProperty(config, key, value);
  }

  return config as AfsimMoverConfig;
}

function applyMoverProperty(config: any, key: string, value: string): void {
  const MOVER_PROP_MAP: Record<string, string> = {
    maximum_speed: 'maximumSpeed',
    minimum_speed: 'minimumSpeed',
    cruise_speed: 'cruiseSpeed',
    maximum_altitude: 'maximumAltitude',
    minimum_altitude: 'minimumAltitude',
    service_ceiling: 'serviceCeiling',
    maximum_range: 'maximumRange',
    endurance: 'endurance',
    maximum_g: 'maximumG',
    max_g: 'maximumG',
    maximum_linear_acceleration: 'maximumLinearAcceleration',
    maximum_radial_acceleration: 'maximumRadialAcceleration',
    default_linear_acceleration: 'defaultLinearAcceleration',
    default_radial_acceleration: 'defaultRadialAcceleration',
    default_climb_rate: 'defaultClimbRate',
    maximum_climb_rate: 'maximumClimbRate',
    roll_rate_limit: 'rollRateLimit',
    turn_rate_limit: 'turnRateLimit',
    maximum_turn_rate: 'maximumTurnRate',
    bank_angle_limit: 'bankAngleLimit',
    at_end_of_path: 'atEndOfPath',
    update_interval: 'updateInterval',
    terrain: 'terrain',
    altitude_offset: 'altitudeOffset',
    draw_route: 'drawRoute',
    // Guided mover
    mass: 'mass',
    specific_impulse: 'specificImpulse',
    thrust: 'thrust',
    thrust_duration: 'thrustDuration',
    // Brawler mover
    aero_file: 'aeroFile',
    update_time_tolerance: 'updateTimeTolerance',
  };

  const propKey = MOVER_PROP_MAP[key];
  if (propKey) {
    config[propKey] = value;
  }

  // Handle on/off
  if (key === 'on') config.on = true;
  if (key === 'off') config.on = false;
  if (key === 'debug') config.debug = true;
}

// ============================================================
// Sensor reference parsing
// ============================================================

function parseSensorReference(block: AfsimBlock): AfsimSensorConfig {
  // The sensor block references a type: sensor NAME TYPE
  // Properties inside are instance overrides
  const sensorTypeName = block.typeName || block.name;

  // Determine sensor type from the type name
  const SENSOR_TYPE_MAP: Record<string, AfsimSensorConfig['type']> = {
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

  const sensorType = SENSOR_TYPE_MAP[sensorTypeName] || 'WSF_RADAR_SENSOR';

  const config: any = {
    type: sensorType,
    name: block.name || 'Unnamed Sensor',
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
    modes: {},
    template: {},
  };

  // Apply instance-level properties
  for (const [key, value] of block.properties) {
    if (key === 'on') config.on = true;
    else if (key === 'off') config.on = false;
    else if (key === 'debug') config.debug = true;
    else if (key === 'internal_link') config.internalLink = value;
    else if (key === 'ignore_same_side') config.ignoreSameSide = true;
    else if (key === 'initial_mode') config.initialMode = value;
  }

  // Process child blocks (mode_template, mode, etc.)
  for (const child of block.children) {
    if (child.keyword === 'mode_template') {
      config.template = parseSensorMode(child);
    } else if (child.keyword === 'mode') {
      config.modes[child.name] = parseSensorMode(child);
    }
  }

  return config as AfsimSensorConfig;
}

function parseSensorMode(block: AfsimBlock): any {
  const mode: any = {
    beams: {},
  };

  for (const [key, value] of block.properties) {
    applySensorModeProperty(mode, key, value);
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

function applySensorModeProperty(mode: any, key: string, value: string): void {
  const MODE_PROP_MAP: Record<string, string> = {
    azimuth_field_of_view: 'azimuthFieldOfView',
    elevation_field_of_view: 'elevationFieldOfView',
    field_of_view_azimuth: 'azimuthFieldOfView',
    field_of_view_elevation: 'elevationFieldOfView',
    range_product: 'rangeProduct',
    one_m2_detect_range: 'oneM2_DetectRange',
    frame_time: 'frameTime',
    revisit_time: 'revisitTime',
    dwell_time: 'dwellTime',
    detection_threshold: 'detectionThreshold',
    required_pd: 'requiredPD',
    track_quality: 'trackQuality',
    reports_location: 'reportsLocation',
    reports_velocity: 'reportsVelocity',
    reports_range: 'reportsRange',
    reports_bearing: 'reportsBearing',
    reports_elevation: 'reportsElevation',
    reports_range_rate: 'reportsRangeRate',
    reports_side: 'reportsSide',
    reports_type: 'reportsType',
    reports_iff: 'reportsIFF',
    reports_signal_to_noise: 'reportsSignalToNoise',
    azimuth_error_sigma: 'azimuthErrorSigma',
    elevation_error_sigma: 'elevationErrorSigma',
    range_error_sigma: 'rangeErrorSigma',
    range_rate_error_sigma: 'rangeRateErrorSigma',
    hits_to_establish_track: 'hitsToEstablishTrack',
    hits_to_maintain_track: 'hitsToMaintainTrack',
    maximum_request_count: 'maximumRequestCount',
    integration_gain: 'integrationGain',
    electronic_beam_steering: 'electronicBeamSteering',
    electronic_beam_steering_limit: 'electronicBeamSteeringLimit',
    electronic_beam_steering_loss_exponent: 'electronicBeamSteeringLossExponent',
    selection_mode: 'selectionMode',
    slew_mode: 'slewMode',
    search_while_track: 'searchWhileTrack',
    disables_search: 'disablesSearch',
    transmit_only: 'transmitOnly',
    receive_only: 'receiveOnly',
    detection_sensitivity: 'detectionSensitivity',
    probability_of_false_alarm: 'probabilityOfFalseAlarm',
    swerling_case: 'swerlingCase',
    number_of_pulses_integrated: 'numberOfPulsesIntegrated',
  };

  const propKey = MODE_PROP_MAP[key];
  if (propKey) {
    mode[propKey] = value;
  }

  // Boolean flags
  if (key === 'reports_location' || key === 'reports_velocity' || key === 'reports_range' ||
      key === 'reports_bearing' || key === 'reports_elevation' || key === 'reports_range_rate' ||
      key === 'reports_side' || key === 'reports_type' || key === 'reports_iff' ||
      key === 'reports_signal_to_noise' || key === 'search_while_track' ||
      key === 'disables_search' || key === 'transmit_only' || key === 'receive_only') {
    mode[propKey || key] = true;
  }
}

function parseTransmitterBlock(block: AfsimBlock): any {
  const tx: any = {};

  for (const [key, value] of block.properties) {
    const TX_MAP: Record<string, string> = {
      frequency: 'frequency',
      power: 'power',
      bandwidth: 'bandwidth',
      pulse_width: 'pulseWidth',
      pulse_repetition_frequency: 'pulseRepetitionFrequency',
      prf: 'pulseRepetitionFrequency',
      pulse_repetition_interval: 'pulseRepetitionInterval',
      duty_cycle: 'dutyCycle',
      polarization: 'polarization',
      internal_loss: 'internalLoss',
      antenna_pattern: 'antennaPattern',
      wavelength: 'wavelength',
      pulse_compression_ratio: 'pulseCompressionRatio',
    };
    const propKey = TX_MAP[key];
    if (propKey) tx[propKey] = value;
  }

  return tx;
}

function parseReceiverBlock(block: AfsimBlock): any {
  const rx: any = {};

  for (const [key, value] of block.properties) {
    const RX_MAP: Record<string, string> = {
      bandwidth: 'bandwidth',
      frequency: 'frequency',
      internal_loss: 'internalLoss',
      noise_power: 'noisePower',
      noise_figure: 'noiseFigure',
      polarization: 'polarization',
      detection_threshold: 'detectionThreshold',
      instantaneous_bandwidth: 'instantaneousBandwidth',
      antenna_pattern: 'antennaPattern',
      wavelength: 'wavelength',
    };
    const propKey = RX_MAP[key];
    if (propKey) rx[propKey] = value;
  }

  return rx;
}

// ============================================================
// Weapon reference parsing
// ============================================================

function parseWeaponReference(block: AfsimBlock): AfsimWeaponConfig {
  const weaponTypeName = block.typeName || block.name;

  // Determine weapon type
  const WEAPON_TYPE_MAP: Record<string, AfsimWeaponConfig['type']> = {
    WSF_IMPLICIT_WEAPON: 'WSF_IMPLICIT_WEAPON',
    WSF_EXPLICIT_WEAPON: 'WSF_EXPLICIT_WEAPON',
    WSF_RF_JAMMER: 'WSF_RF_JAMMER',
    WSF_LASER_WEAPON: 'WSF_LASER_WEAPON',
    WSF_CUED_LASER_WEAPON: 'WSF_CUED_LASER_WEAPON',
  };

  const weaponType = WEAPON_TYPE_MAP[weaponTypeName] || 'WSF_IMPLICIT_WEAPON';

  const config: any = {
    type: weaponType,
    name: block.name || 'Unnamed Weapon',
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
    quantity: 1,
    maximumQuantity: 1,
    automaticTargetCueing: true,
    cueToPredictedIntercept: true,
  };

  // Apply instance properties
  for (const [key, value] of block.properties) {
    applyWeaponProperty(config, key, value);
  }

  // Process child blocks (launch_computer, etc.)
  for (const child of block.children) {
    if (child.keyword === 'launch_computer') {
      config.launchComputer = parseLaunchComputerBlock(child);
    }
  }

  return config as AfsimWeaponConfig;
}

function applyWeaponProperty(config: any, key: string, value: string): void {
  const WEAPON_PROP_MAP: Record<string, string> = {
    quantity: 'quantity',
    maximum_quantity: 'maximumQuantity',
    launched_platform_type: 'launchedPlatformType',
    firing_interval: 'firingInterval',
    firing_delay: 'firingDelay',
    salvo_interval: 'salvoInterval',
    update_interval: 'updateInterval',
    reload_time: 'reloadTime',
    automatic_target_cueing: 'automaticTargetCueing',
    cue_to_predicted_intercept: 'cueToPredictedIntercept',
    inhibit_while_reloading: 'inhibitWhileReloading',
    weapon_effects: 'weaponEffects',
    unknown_target_range: 'unknownTargetRange',
    unknown_target_altitude: 'unknownTargetAltitude',
    slew_mode: 'slewMode',
    azimuth_slew_limits: 'azimuthSlewLimits',
  };

  const propKey = WEAPON_PROP_MAP[key];
  if (propKey) {
    config[propKey] = value;
  }

  // Boolean flags
  if (key === 'on') config.on = true;
  if (key === 'off') config.on = false;
  if (key === 'debug') config.debug = true;
}

function parseLaunchComputerBlock(block: AfsimBlock): any {
  const lc: any = {
    type: block.typeName || block.name || 'WSF_LAUNCH_COMPUTER',
  };

  for (const [key, value] of block.properties) {
    const LC_MAP: Record<string, string> = {
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
    const propKey = LC_MAP[key];
    if (propKey) lc[propKey] = value;
  }

  return lc;
}

// ============================================================
// Processor parsing
// ============================================================

function parseProcessorBlock(block: AfsimBlock): AfsimProcessorConfig {
  const procTypeName = block.typeName || block.name;

  const PROC_TYPE_MAP: Record<string, AfsimProcessorConfig['type']> = {
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

  const procType = PROC_TYPE_MAP[procTypeName] || 'WSF_SCRIPT_PROCESSOR';

  const config: any = {
    type: procType,
    name: block.name || 'Unnamed Processor',
    on: true,
    operational: true,
    restorable: true,
    debug: false,
    automaticRecoveryTime: '0.0 sec',
    damageFactor: 1,
    categories: [],
  };

  // Apply properties
  for (const [key, value] of block.properties) {
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
    else if (key === 'reporting_self') config.reportingSelf = value === 'true';
    else if (key === 'reports_self') config.reportsSelf = value === 'true';
    else if (key === 'reporting_others') config.reportingOthers = value === 'true';
    else if (key === 'reports_others') config.reportsOthers = value === 'true';
    else if (key === 'perceive_self') config.perceiveSelf = value === 'true';
    else if (key === 'mission_task') config.missionTask = value;
  }

  // Process child blocks (script, on_update, etc.)
  for (const child of block.children) {
    if (child.keyword === 'script' || child.keyword === 'on_update' ||
        child.keyword === 'on_initialize' || child.keyword === 'on_entry' ||
        child.keyword === 'on_exit') {
      // Store script content as property
      const scriptContent = extractBlockContent(child);
      if (child.keyword === 'script') config.script = scriptContent;
      else if (child.keyword === 'on_update') config.onUpdate = scriptContent;
      else if (child.keyword === 'on_initialize') config.onInitialize = scriptContent;
      else if (child.keyword === 'on_entry') config.onEntry = scriptContent;
      else if (child.keyword === 'on_exit') config.onExit = scriptContent;
    } else if (child.keyword === 'track_manager') {
      config.trackManager = parseTrackManagerBlock(child);
    } else if (child.keyword === 'advanced_behavior_tree') {
      // 始终保留原始文本作为兜底（往返安全）；仅当树被完整识别时才附加结构化版本供编辑器使用
      config.advancedBehaviorTree = extractBlockContent(child);
      const parsed = parseAdvancedBehaviorTree(child);
      if (parsed.complete && parsed.config.nodes.length > 0) {
        config.behaviorTree = parsed.config;
      }
    } else if (child.keyword === 'sa_perceive') {
      config.perceive = parseSaPerceiveBlock(child);
    } else if (child.keyword === 'sa_assess') {
      config.assess = parseSaAssessBlock(child);
    }
  }

  return config as AfsimProcessorConfig;
}

function extractBlockContent(block: AfsimBlock): string {
  // For script blocks, we need the raw content between keyword and end_keyword
  // Since we've already parsed into properties, we reconstruct from properties
  const lines: string[] = [];
  for (const [key, value] of block.properties) {
    if (value) lines.push(`${key} ${value}`);
    else lines.push(key);
  }
  return lines.join('\n');
}

// ============================================================
// Advanced Behavior Tree parsing
//
// Returns `complete: false` whenever a node/property isn't recognized, so the
// caller can fall back to the raw-text round trip (config.advancedBehaviorTree)
// instead of serializing a structurally-incomplete tree and silently dropping content.
// ============================================================

const COMPOSITE_NODE_KEYWORDS = new Set<BehaviorCompositeKind>([
  'sequence',
  'sequence_with_memory',
  'selector',
  'selector_with_memory',
  'parallel',
  'priority_selector',
  'weighted_random',
]);

const DECORATOR_SUBTYPES = new Set(['inverter', 'negator', 'succeeder', 'repeater']);

let behaviorNodeIdCounter = 0;
function nextBehaviorNodeId(): string {
  behaviorNodeIdCounter += 1;
  return `bn-${behaviorNodeIdCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

function parseAdvancedBehaviorTree(block: AfsimBlock): { config: AdvancedBehaviorTreeConfig; complete: boolean } {
  const config: AdvancedBehaviorTreeConfig = { nodes: [] };
  let complete = true;

  for (const [key, value] of block.properties) {
    if (key === 'name') config.name = value;
    else if (key === 'desc') config.description = value;
    else if (key === 'btt') config.btt = value === 'true';
    else if (key === 'root_node_type') config.rootNodeType = value as BehaviorCompositeKind;
    else if (key === 'success_policy') config.successPolicy = value;
    else complete = false;
  }

  for (const child of block.children) {
    const node = parseBehaviorTreeNode(child);
    if (node) config.nodes.push(node);
    else complete = false;
  }

  return { config, complete };
}

function parseBehaviorTreeNode(block: AfsimBlock): BehaviorTreeNode | null {
  if (block.keyword === 'behavior_node') {
    return { id: nextBehaviorNodeId(), kind: 'behavior_node', name: block.name };
  }

  if (COMPOSITE_NODE_KEYWORDS.has(block.keyword as BehaviorCompositeKind)) {
    const children: BehaviorTreeNode[] = [];
    let childrenComplete = true;
    for (const child of block.children) {
      const childNode = parseBehaviorTreeNode(child);
      if (childNode) children.push(childNode);
      else childrenComplete = false;
    }
    if (!childrenComplete) return null;
    return {
      id: nextBehaviorNodeId(),
      kind: block.keyword as BehaviorCompositeKind,
      name: block.properties.get('name'),
      children,
    };
  }

  if (block.keyword === 'decorator' && DECORATOR_SUBTYPES.has(block.name)) {
    const children: BehaviorTreeNode[] = [];
    let childrenComplete = true;
    for (const child of block.children) {
      const childNode = parseBehaviorTreeNode(child);
      if (childNode) children.push(childNode);
      else childrenComplete = false;
    }
    if (!childrenComplete) return null;

    const node: BehaviorTreeNode = {
      id: nextBehaviorNodeId(),
      kind: `decorator_${block.name}` as BehaviorTreeNode['kind'],
      children,
    };
    if (block.name === 'repeater') {
      // "decorator repeater until_done" -> typeName='until_done', extra=undefined
      // "decorator repeater repeat 20"  -> typeName='repeat',      extra='20'
      // "decorator repeater for 5 minutes" -> typeName='for',      extra='5 minutes'
      if (block.typeName) node.repeaterMode = block.typeName as BehaviorRepeaterMode;
      if (block.extra) node.repeaterValue = block.extra;
    }
    return node;
  }

  if (block.keyword === 'advanced_behavior_tree') {
    // Nested subtree: recurse using the same logic as the top-level tree
    const { config, complete } = parseAdvancedBehaviorTree(block);
    if (!complete) return null;
    return {
      id: nextBehaviorNodeId(),
      kind: 'advanced_behavior_tree',
      name: config.name,
      description: config.description,
      btt: config.btt,
      rootNodeType: config.rootNodeType,
      successPolicy: config.successPolicy,
      children: config.nodes,
    };
  }

  // Unrecognized node type — signal incompleteness
  return null;
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

// ============================================================
// Comm parsing
// ============================================================

function parseCommBlock(block: AfsimBlock): AfsimCommConfig {
  const commTypeName = block.typeName || block.name;

  const COMM_TYPE_MAP: Record<string, AfsimCommConfig['type']> = {
    WSF_COMM_TRANSCEIVER: 'WSF_COMM_TRANSCEIVER',
    WSF_COMM_RCVR: 'WSF_COMM_RCVR',
    WSF_COMM_XMTR: 'WSF_COMM_XMTR',
    WSF_RADIO_TRANSCEIVER: 'WSF_RADIO_TRANSCEIVER',
    WSF_RADIO_RCVR: 'WSF_RADIO_RCVR',
    WSF_RADIO_XMTR: 'WSF_RADIO_XMTR',
    WSF_SUBSURFACE_RADIO_TRANSCEIVER: 'WSF_SUBSURFACE_RADIO_TRANSCEIVER',
  };

  const commType = COMM_TYPE_MAP[commTypeName] || 'WSF_COMM_TRANSCEIVER';

  const config: any = {
    type: commType,
    name: block.name || 'Unnamed Comm',
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

  // Process child blocks
  for (const child of block.children) {
    if (child.keyword === 'comm_medium') {
      config.medium = parseCommMediumBlock(child);
    } else if (child.keyword === 'datalink_layer') {
      config.datalinkLayer = parseDatalinkLayerBlock(child);
    } else if (child.keyword === 'transmitter') {
      config.transmitter = parseTransmitterBlock(child);
    } else if (child.keyword === 'receiver') {
      config.receiver = parseReceiverBlock(child);
    }
  }

  return config as AfsimCommConfig;
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

// ============================================================
// Fuel parsing
// ============================================================

function parseFuelBlock(block: AfsimBlock): AfsimFuelConfig {
  const fuelTypeName = block.name || block.typeName;

  const FUEL_TYPE_MAP: Record<string, AfsimFuelConfig['type']> = {
    WSF_FUEL: 'WSF_FUEL',
    WSF_VARIABLE_RATE_FUEL: 'WSF_VARIABLE_RATE_FUEL',
    WSF_TABULAR_RATE_FUEL: 'WSF_TABULAR_RATE_FUEL',
    WSF_TANKED_FUEL: 'WSF_TANKED_FUEL',
    WSF_BRAWLER_FUEL: 'WSF_VARIABLE_RATE_FUEL', // Brawler fuel is variable rate
  };

  const fuelType = FUEL_TYPE_MAP[fuelTypeName] || 'WSF_FUEL';

  const config: any = {
    type: fuelType,
    name: block.name || 'main_fuel',
    on: true,
    operational: true,
    restorable: true,
    debug: false,
    automaticRecoveryTime: '0.0 sec',
    damageFactor: 1,
    categories: [],
  };

  for (const [key, value] of block.properties) {
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
    else if (key === 'table_for_mode') config.tableForMode = value;
  }

  // Process child blocks (fuel_table, etc.)
  for (const child of block.children) {
    if (child.keyword === 'fuel_table') {
      config.fuelTable = config.fuelTable || [];
      config.fuelTable.push(parseFuelTableBlock(child));
    }
  }

  return config as AfsimFuelConfig;
}

function parseFuelTableBlock(block: AfsimBlock): any {
  const table: any = {};
  for (const [key, value] of block.properties) {
    if (key === 'mode') table.mode = value;
    else if (key === 'speeds') table.speeds = value.split(/\s+/);
    else if (key === 'altitudes') table.altitudes = value.split(/\s+/);
    else if (key === 'masses') table.masses = value.split(/\s+/);
    else if (key === 'rates') table.rates = value.split(/\s+/);
  }
  return table;
}

// ============================================================
// Context-sensitive lookahead
// ============================================================

/**
 * Scan forward from startIndex to check if endKeyword exists
 * before the current block scope ends. This prevents property lines
 * like "fuel 50.0 kg" inside a mover from being treated as block starts.
 *
 * Returns true if endKeyword is found at nesting depth 0.
 * Returns false if EOF is reached or the enclosing scope closes first.
 */
function hasEndKeywordAhead(lines: string[], startIndex: number, endKeyword: string): boolean {
  // Track nesting depth for the same keyword type
  // We need to find endKeyword at depth 0 (closing the block we're about to open)
  const startKeyword = endKeyword.replace(/^end_/, '');
  let depth = 0;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Check for matching end keyword
    if (trimmed === endKeyword) {
      if (depth === 0) return true;
      depth--;
      continue;
    }

    // Check for nested block start of the same type
    const tokens = tokenize(trimmed);
    if (tokens.length > 0 && tokens[0] === startKeyword && BLOCK_KEYWORDS[startKeyword]) {
      // Could be a nested block — but we need to verify it has its own end keyword
      // For simplicity, increment depth (conservative approach)
      depth++;
    }

    // Check for the enclosing scope's end keyword (stops the search)
    // If we hit an end keyword that doesn't match our target, we've exited the enclosing scope
    if (trimmed.startsWith('end_') && trimmed !== endKeyword) {
      // This could close an enclosing block — but we can't be sure without full context
      // For safety, we continue scanning (the stack-based parser handles real nesting)
    }
  }

  return false;
}

