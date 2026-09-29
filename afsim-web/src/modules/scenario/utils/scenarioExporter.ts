/**
 * Scenario Exporter
 *
 * Generates AFSIM .txt configuration from a Scenario's platforms,
 * routes, and their referenced equipment definitions.
 *
 * Output structure:
 *   1. Platform type definitions (from equipment library)
 *   2. Named route definitions (route NAME ... end_route)
 *   3. Platform instances (platform ... end_platform) with:
 *      - side, position, altitude, heading, speed
 *      - commander, command_chain
 *      - inline route (if routeInline set, or resolved from routeId)
 *      - creation_time, indestructible, category
 */

import type { Scenario, PlatformInstance, RouteDefinition, RouteWaypoint, MissionDefinition } from '../types';
import type { AfsimEquipment } from '../../equipment/afsim/types';
import { writeAfsimConf } from '../../equipment/io/confWriter';

/**
 * AFSIM base_types 平台类型 → 对应的 include_once 文件路径（相对于 demos/base_types）。
 * 仅这些类型在网关侧 demos/base_types/platforms 中可用，自定义装备名需映射到其中之一。
 */
// 注意：blue_multirole_fighter_1_noripr.txt 间接 include_once 了不存在的
// signatures/blue_multirole_fighter_3_radar_signature.txt，会导致 AFSIM 静默崩溃，
// 故不在此映射表中使用，蓝方多用途机型一律回退到 blue_adv_fighter_1。
const BASE_TYPE_INCLUDES: Record<string, string> = {
  AWACS: 'platforms/awacs.txt',
  blue_adv_fighter_1: 'platforms/blue_adv_fighter_1_noripr.txt',
  RED_ADV_FIGHTER_1: 'platforms/red_adv_fighter_1_noripr.txt',
  RED_MULTIROLE_FIGHTER_2: 'platforms/red_multirole_fighter_2_noripr.txt',
  red_fighter_1: 'platforms/red_fighter_1_noripr.txt',
  bomber: 'platforms/bomber.txt',
  // gci_noripr.txt 定义的是 `platform_type GCI`（大写），平台类型名大小写严格匹配，
  // 故映射键/返回值统一用大写 GCI（而非 'gci'），否则 AFSIM 报 "Unknown platform type".
  GCI: 'platforms/gci_noripr.txt',
  flight_lead: 'platforms/flight_lead_noripr.txt',
};

/**
 * 将装备名映射到有效的 base_types 平台类型名。
 * 已是有效类型名时原样返回；否则按关键字 + 阵营推断最接近的可用类型。
 */
function mapToBaseType(rawName: string, side: PlatformInstance['side']): string {
  const trimmed = (rawName || '').trim();
  if (trimmed in BASE_TYPE_INCLUDES) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.includes('awacs') || lower.includes('预警')) return 'AWACS';
  if (lower.includes('bomber') || lower.includes('轰炸')) return 'bomber';
  // 注意：gci_base.txt 的 track_manager 处理器配置了 `report_to subordinates via sub_net`，
  // 若场景中未定义 sub_net 通信网络，AFSIM 初始化会失败（无 start 1）。
  // 指挥所/C2 类装备映射到 gci 后，需在 platformInstanceToConf 中补充 sub_net comm 定义并通过
  // mission.exe 直接验证，详见 docs/next-steps.md「Command 装备实体库融合」任务。
  if (lower.includes('gci') || lower.includes('地面引导') || lower.includes('指挥') || lower.includes('command') || lower.includes('c2')) {
    return 'GCI';
  }

  if (side === 'red') {
    if (lower.includes('multirole') || lower.includes('多用途')) return 'RED_MULTIROLE_FIGHTER_2';
    return 'RED_ADV_FIGHTER_1';
  }
  return 'blue_adv_fighter_1';
}

/**
 * Generate AFSIM text for a scenario.
 */
export function exportScenarioForSimulation(
  scenario: Scenario,
  equipmentMap: Map<string, AfsimEquipment>,
): string {
  const lines: string[] = [];
  const platforms = expandBatchPlatforms(scenario.platforms);

  lines.push('# AFSIM Scenario - Auto-generated from TrueSim');
  lines.push(`# Scenario: ${scenario.name}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  // 1. Platform type definitions
  const usedTypes = new Map<string, AfsimEquipment>();
  for (const platform of platforms) {
    const eqId = platform.equipmentRef?.equipmentId || platform.equipmentId;
    if (!eqId) continue;
    const afsimEq = equipmentMap.get(eqId);
    if (afsimEq && !usedTypes.has(afsimEq.name)) {
      usedTypes.set(afsimEq.name, afsimEq);
    }
  }

  if (usedTypes.size > 0) {
    lines.push('# ===== Platform Type Definitions =====');
    lines.push('');
    lines.push(writeAfsimConf([...usedTypes.values()], { includeComments: false }));
    lines.push('');
  }

  // Build a route lookup map
  const routeMap = new Map<string, RouteDefinition>();
  for (const r of scenario.routes) {
    routeMap.set(r.id, r);
  }

  // Resolve each platform's AFSIM type name, mapping to a valid base_types type
  // when no equipment definition is bundled (the common case: type defs are
  // provided by the gateway's demos/base_types).
  const platformTypes = new Map<string, string>();
  const includeFiles = new Set<string>();
  for (const platform of platforms) {
    const eqId = platform.equipmentRef?.equipmentId || platform.equipmentId;
    const afsimEq = eqId ? equipmentMap.get(eqId) : undefined;
    let typeName: string;
    if (afsimEq) {
      typeName = afsimEq.name;
    } else {
      const rawName = platform.equipmentRef?.name || 'UNKNOWN';
      typeName = mapToBaseType(rawName, platform.side);
      const includeFile = BASE_TYPE_INCLUDES[typeName];
      if (includeFile) includeFiles.add(includeFile);
    }
    platformTypes.set(platform.id, typeName);
  }

  // 2. include_once for base_types platform definitions referenced above
  if (includeFiles.size > 0) {
    lines.push('# ===== Platform Type Includes =====');
    lines.push('');
    for (const file of [...includeFiles].sort()) {
      lines.push(`include_once ${file}`);
    }
    lines.push('');
  }

  // 3. Named route definitions
  if (scenario.routes.length > 0) {
    lines.push('# ===== Route Definitions =====');
    lines.push('');
    for (const route of scenario.routes) {
      lines.push(...routeToConf(route));
      lines.push('');
    }
  }

  // 4. Platform instances
  lines.push('# ===== Platform Instances =====');
  lines.push('');

  for (const platform of platforms) {
    const typeName = platformTypes.get(platform.id) || 'UNKNOWN';
    lines.push(...platformInstanceToConf(platform, typeName, routeMap, scenario));
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 分批次到达展开
// ============================================================

/**
 * 将带有 batchGroupId/batchGroupSize/batchIntervalSeconds 的"批次模板"平台
 * 展开为多个独立实例：第 i 个实例的 creation_time = 模板的 creationTime + i * interval，
 * 名称追加 "-N" 后缀，id 追加索引以避免冲突。未配置批次的平台原样保留。
 */
function expandBatchPlatforms(platforms: PlatformInstance[]): PlatformInstance[] {
  const result: PlatformInstance[] = [];
  for (const platform of platforms) {
    const size = platform.batchGroupId ? (platform.batchGroupSize ?? 1) : 1;
    if (size <= 1) {
      result.push(platform);
      continue;
    }
    const interval = platform.batchIntervalSeconds ?? 0;
    const baseCreationTime = platform.creationTime ?? 0;
    for (let i = 0; i < size; i++) {
      result.push({
        ...platform,
        id: `${platform.id}-batch${i}`,
        name: `${platform.name}-${i + 1}`,
        creationTime: baseCreationTime + i * interval,
      });
    }
  }
  return result;
}

// ============================================================
// Route serialization
// ============================================================

/** 格式化纬度/经度为 AFSIM laydown 格式，如 "25.5n 122.3e" / "10s 30w"。 */
function formatLatLon(lat: number, lng: number): string {
  const ns = lat < 0 ? 's' : 'n';
  const ew = lng < 0 ? 'w' : 'e';
  return `${Math.abs(lat)}${ns} ${Math.abs(lng)}${ew}`;
}

/**
 * 将一个航路点格式化为 laydown 风格的多行：
 *   position {lat}n {lon}e altitude {alt} m
 *      speed {speed} kts
 * speed 单独成行并多缩进一级，避免 AFSIM 同行解析失败。
 */
function waypointToConfLines(wp: RouteWaypoint, indent: string): string[] {
  const lines: string[] = [];
  const posLine = [`position ${formatLatLon(wp.position.lat, wp.position.lng)}`];
  if (wp.altitude) posLine.push(`altitude ${wp.altitude} m`);
  lines.push(`${indent}${posLine.join(' ')}`);
  if (wp.speed) {
    lines.push(`${indent}   speed ${wp.speed} kts`);
  }
  return lines;
}

function routeToConf(route: RouteDefinition): string[] {
  const lines: string[] = [];
  const p1 = '   ';

  lines.push(`route ${route.name}`);
  for (const wp of route.waypoints) {
    lines.push(...waypointToConfLines(wp, p1));
  }
  lines.push('end_route');

  return lines;
}

// ============================================================
// Platform instance serialization
// ============================================================

function platformInstanceToConf(
  platform: PlatformInstance,
  typeName: string,
  routeMap: Map<string, RouteDefinition>,
  scenario: Scenario,
): string[] {
  const lines: string[] = [];
  const name = platform.name || typeName;
  const p1 = '   ';

  lines.push(`platform "${name}" ${typeName}`);

  // Side
  lines.push(`${p1}side ${platform.side}`);

  // Commander
  if (platform.commander) {
    lines.push(`${p1}commander ${platform.commander}`);
  }

  // Command chains
  if (platform.commandChains && platform.commandChains.length > 0) {
    for (const chain of platform.commandChains) {
      lines.push(`${p1}command_chain ${chain.chainName} ${chain.leader}`);
    }
  }

  // Position + altitude
  if (platform.initialPosition) {
    const posLine = [`position ${formatLatLon(platform.initialPosition.lat, platform.initialPosition.lng)}`];
    if (platform.initialAltitude !== undefined && platform.initialAltitude !== 0) {
      posLine.push(`altitude ${platform.initialAltitude} m`);
    }
    lines.push(`${p1}${posLine.join(' ')}`);
  }

  // Heading
  if (platform.initialHeading !== undefined && platform.initialHeading !== 0) {
    lines.push(`${p1}heading ${platform.initialHeading} deg`);
  }

  // 注意：`speed` 仅在 route/waypoint 内有效，平台体级别的 `speed` 会导致
  // AFSIM 报 "Unknown command: speed" 并解析失败，因此此处不输出。

  // Creation time
  if (platform.creationTime && platform.creationTime > 0) {
    lines.push(`${p1}creation_time ${platform.creationTime} sec`);
  }

  // Indestructible
  if (platform.indestructible) {
    lines.push(`${p1}indestructible`);
  }

  // Categories
  if (platform.categories && platform.categories.length > 0) {
    lines.push(`${p1}category ${platform.categories.join(' ')}`);
  }

  // GCI 类型的 track_manager 处理器要求 `report_to subordinates via sub_net`，
  // 但 gci_base.txt 并未定义 sub_net 这个 comm，必须由场景实例补充，
  // 否则 AFSIM 初始化报 "External link reference is not a valid comm object"。
  // 经 mission.exe 直接验证：必须用 `add comm`（而非 `comm`）新增 comm，
  // 否则解析报 "Unknown comm: sub_net"。
  if (typeName === 'GCI') {
    lines.push(`${p1}add comm sub_net WSF_COMM_TRANSCEIVER`);
    lines.push(`${p1}${p1}network_name gci_net_${platform.side}`);
    lines.push(`${p1}${p1}internal_link track_manager`);
    lines.push(`${p1}end_comm`);
  }

  // Inline route (explicit waypoints on the platform)
  if (platform.routeInline && platform.routeInline.length > 0) {
    lines.push(`${p1}route`);
    for (const wp of platform.routeInline) {
      lines.push(...waypointToConfLines(wp, `${p1}${p1}`));
    }
    lines.push(`${p1}end_route`);
  }
  // Referenced route (by routeId)
  else if (platform.routeId) {
    const route = routeMap.get(platform.routeId);
    if (route && route.waypoints.length > 0) {
      lines.push(`${p1}route`);
      for (const wp of route.waypoints) {
        lines.push(...waypointToConfLines(wp, `${p1}${p1}`));
      }
      lines.push(`${p1}end_route`);
    }
  }

  // 武器交战任务（type === 'engage'）：为分配到此平台的交战任务生成
  // 几何传感器（用于建立目标航迹）+ 脚本处理器（按 ROE/交战距离/武器名 触发 FireSalvo）。
  lines.push(...engagementProcessorLines(platform, scenario, p1));

  lines.push('end_platform');
  return lines;
}

/**
 * 为分配了 type === 'engage' 任务的平台生成交战相关配置：
 * - 一个全向几何传感器（建立 MasterTrackList，供 SlantRangeTo/FireSalvo 使用）
 * - 每个交战任务一个 WSF_SCRIPT_PROCESSOR：roe='hold' 时不开火，否则在交战距离内
 *   对（可选限定的）目标航迹用指定武器 FireSalvo。
 */
function engagementProcessorLines(platform: PlatformInstance, scenario: Scenario, p1: string): string[] {
  const engageMissions = (scenario.missions ?? []).filter(
    (m): m is MissionDefinition & { engagement: NonNullable<MissionDefinition['engagement']> } =>
      m.type === 'engage' && !!m.engagement && m.assignedPlatforms.includes(platform.id)
  );
  if (engageMissions.length === 0) return [];

  const lines: string[] = [];
  const p2 = p1 + p1;
  const p3 = p2 + p1;
  const p4 = p3 + p1;

  lines.push(`${p1}add sensor geo_sensor WSF_GEOMETRIC_SENSOR`);
  lines.push(`${p2}azimuth_field_of_view -180.0 degrees 180.0 degrees`);
  lines.push(`${p2}elevation_field_of_view -90.0 degrees 90.0 degrees`);
  lines.push(`${p2}minimum_range 0 m`);
  lines.push(`${p2}maximum_range 200000 m`);
  lines.push(`${p2}on`);
  lines.push(`${p2}frame_time 1.0 sec`);
  lines.push(`${p2}reports_location`);
  lines.push(`${p2}reports_velocity`);
  lines.push(`${p2}reports_iff`);
  lines.push(`${p2}track_quality 1.0`);
  lines.push(`${p2}ignore_same_side`);
  lines.push(`${p2}internal_link track_manager`);
  lines.push(`${p1}end_sensor`);

  engageMissions.forEach((mission, idx) => {
    const eng = mission.engagement;
    const procName = engageMissions.length > 1 ? `engage_mgr_${idx + 1}` : 'engage_mgr';
    const maxRange = eng.maxRange ?? 100000;
    const salvoSize = eng.salvoSize ?? 1;
    const targetName = eng.targetPlatformId
      ? scenario.platforms.find((p) => p.id === eng.targetPlatformId)?.name
      : undefined;

    lines.push(`${p1}add processor ${procName} WSF_SCRIPT_PROCESSOR`);
    lines.push(`${p2}update_interval 2 sec`);

    if (eng.roe === 'hold') {
      // ROE = hold fire: 处理器存在但不主动开火（仅记录任务名，便于日志核对）。
      lines.push(`${p2}on_update`);
      lines.push(`${p3}// 任务「${mission.name}」ROE=hold，禁止主动开火`);
      lines.push(`${p2}end_on_update`);
    } else {
      lines.push(`${p2}script_variables`);
      lines.push(`${p3}Set<string> engaged = Set<string>();`);
      lines.push(`${p2}end_script_variables`);
      lines.push(`${p2}on_update`);
      lines.push(`${p3}foreach (WsfLocalTrack track in PLATFORM.MasterTrackList())`);
      lines.push(`${p3}{`);
      lines.push(`${p4}if (!track.IsValid()) { continue; }`);
      lines.push(`${p4}if (track.Side() == PLATFORM.Side()) { continue; }`);
      if (targetName) {
        lines.push(`${p4}if (track.TargetName() != "${targetName}") { continue; }`);
      }
      lines.push(`${p4}if (engaged.Exists(track.TargetName())) { continue; }`);
      lines.push(`${p4}double range = PLATFORM.SlantRangeTo(track);`);
      lines.push(`${p4}if (range < ${maxRange}.0)`);
      lines.push(`${p4}{`);
      lines.push(`${p4}${p1}WsfWeapon wpn = PLATFORM.Weapon("${eng.weaponName}");`);
      lines.push(`${p4}${p1}if (wpn.IsValid() && wpn.QuantityRemaining() > 0)`);
      lines.push(`${p4}${p1}{`);
      lines.push(`${p4}${p2}if (wpn.FireSalvo(track, ${salvoSize}))`);
      lines.push(`${p4}${p2}{`);
      lines.push(`${p4}${p3}engaged.Insert(track.TargetName());`);
      lines.push(`${p4}${p3}writeln(PLATFORM.Name(), " [", "${mission.name}", "] engaging ", track.TargetName(), " at range ", range);`);
      lines.push(`${p4}${p2}}`);
      lines.push(`${p4}${p1}}`);
      lines.push(`${p4}}`);
      lines.push(`${p3}}`);
      lines.push(`${p2}end_on_update`);
    }

    lines.push(`${p1}end_processor`);
  });

  return lines;
}

/**
 * 将编辑器导出的 AFSIM 正文包装为网关可运行的 .scenario 文件。
 * 包含 event_gateway 命名管道配置（与 afsim-gateway 默认一致）。
 */
export function wrapAsGatewayScenario(
  scenarioName: string,
  afsimBody: string,
  options?: { endTime?: string; demosRelative?: string; simpleScenarioRelative?: string },
): string {
  const sanitized = scenarioName.replace(/[^a-zA-Z0-9_-]/g, '_');
  // 全部为下划线/连字符（如纯中文名）时回退为 'custom'，避免生成
  // `define_path_variable CASE ________` 这类无效占位符。
  const caseName = /[a-zA-Z0-9]/.test(sanitized) ? sanitized : 'custom';
  const demos = options?.demosRelative ?? '../../AFSim/afsim-2.9.0-win64/demos/base_types';
  const simpleScenario = options?.simpleScenarioRelative ?? '../../AFSim/afsim-2.9.0-win64/demos/simple_scenario';
  const endTime = options?.endTime ?? '30 mins';

  return [
    `define_path_variable CASE ${caseName}`,
    'file_path .',
    `file_path ${simpleScenario}`,
    `file_path ${demos}`,
    '',
    'include event_pipe.txt',
    'include event_output.txt',
    'include terrain.txt',
    '',
    `log_file ../output/$(CASE).log`,
    'event_output file ../output/$(CASE).evt end_event_output',
    'event_pipe file ../output/$(CASE).aer end_event_pipe',
    '',
    'event_gateway',
    '   enabled true',
    '   event_pipe_name afsim_events',
    '   control_pipe_name afsim_control',
    '   mover_throttle 0.5 sec',
    'end_event_gateway',
    '',
    afsimBody.trim(),
    '',
    `end_time ${endTime}`,
    '',
  ].join('\n');
}

/** 触发浏览器下载 .scenario 文件（用于上传到仿真模块） */
export function downloadGatewayScenario(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.scenario') ? filename : `${filename}.scenario`;
  a.click();
  URL.revokeObjectURL(url);
}
