// ============================================================
// Equipment I/O - AFSIM .txt Writer
// Serializes AfsimEquipment to real AFSIM syntax:
//   platform_type NAME [PARENT] ... end_platform_type
//   sensor NAME TYPE ... end_sensor
//   weapon NAME TYPE ... end_weapon
//   mover TYPE ... end_mover
// ============================================================

import type {
  AfsimEquipment,
  AfsimSensorConfig,
  AfsimWeaponConfig,
  AfsimCommConfig,
  AfsimMoverConfig,
  AfsimProcessorConfig,
  AfsimFuelConfig,
  AfsimLaunchComputerConfig,
  PlatformPartBase,
  ArticulatedPartBase,
  TransmitterConfig,
  ReceiverConfig,
  AntennaConfig,
  RadarSensorConfig,
  PassiveSensorConfig,
  EoirSensorConfig,
  IrstSensorConfig,
  SarSensorConfig,
  AcousticSensorConfig,
  LadarSensorConfig,
  GeometricSensorConfig,
  RadarSensorMode,
  EoirSensorMode,
  RfJammerMode,
  WaypointMoverBase,
  SpaceMoverConfig,
  RotorcraftMoverConfig,
  KinematicMoverConfig,
  TrackManagerConfig,
  AdvancedBehaviorTreeConfig,
  BehaviorTreeNode,
} from '../afsim/types';

export interface ConfWriterOptions {
  /** Indentation spaces per level (default: 3) */
  indent?: number;
  /** Include comment headers */
  includeComments?: boolean;
}

const DEFAULT_INDENT = 3;

// ============================================================
// Public API
// ============================================================

/**
 * Write an array of AfsimEquipment to real AFSIM .txt format.
 */
export function writeAfsimConf(
  equipmentList: AfsimEquipment[],
  options: ConfWriterOptions = {},
): string {
  const { indent = DEFAULT_INDENT, includeComments = true } = options;
  const lines: string[] = [];

  if (includeComments) {
    lines.push('# AFSIM Platform Definition - Auto-generated');
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`# Count: ${equipmentList.length}`);
    lines.push('');
  }

  for (const eq of equipmentList) {
    lines.push(...equipmentToConf(eq, indent, includeComments));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Write a single AfsimEquipment to .txt text.
 */
export function writeSingleAfsimConf(
  equipment: AfsimEquipment,
  options: ConfWriterOptions = {},
): string {
  const { indent = DEFAULT_INDENT, includeComments = true } = options;
  return equipmentToConf(equipment, indent, includeComments).join('\n');
}

// ============================================================
// Equipment serialization
// ============================================================

function equipmentToConf(
  eq: AfsimEquipment,
  indent: number,
  includeComments: boolean,
): string[] {
  const lines: string[] = [];
  const p1 = pad(indent, 1);

  if (includeComments) {
    lines.push(`# Equipment: ${eq.name}`);
  }

  // platform_type NAME [PARENT]
  const parent = eq.parentType || 'WSF_PLATFORM';
  lines.push(`platform_type ${eq.name} ${parent}`);

  const platform = eq.platform;

  // Platform-level properties
  if (platform.spatialDomain && platform.spatialDomain !== 'air') {
    lines.push(`${p1}domain ${platform.spatialDomain}`);
  }
  if (platform.side) lines.push(`${p1}side ${platform.side}`);
  if (platform.icon) lines.push(`${p1}icon ${platform.icon}`);
  if (platform.marking) lines.push(`${p1}marking "${platform.marking}"`);
  if (!platform.destructible) lines.push(`${p1}destructible false`);

  // Position (for platform instances)
  const pos = platform.position;
  if (pos && pos.type === 'latlon' && pos.latitude != null && pos.longitude != null) {
    lines.push(`${p1}position ${pos.latitude} ${pos.longitude}`);
  }

  // Altitude & orientation
  if (platform.altitude && platform.altitude !== '0 m') lines.push(`${p1}altitude ${platform.altitude}`);
  if (platform.altitudeReference && platform.altitudeReference !== 'default') lines.push(`${p1}altitude_reference ${platform.altitudeReference}`);
  if (platform.heading && platform.heading !== '0 deg') lines.push(`${p1}heading ${platform.heading}`);
  if (platform.pitch && platform.pitch !== '0 deg') lines.push(`${p1}pitch ${platform.pitch}`);
  if (platform.roll && platform.roll !== '0 deg') lines.push(`${p1}roll ${platform.roll}`);

  // Physical properties
  if (platform.emptyMass) lines.push(`${p1}empty_mass ${platform.emptyMass}`);
  if (platform.fuelMass) lines.push(`${p1}fuel_mass ${platform.fuelMass}`);
  if (platform.payloadMass) lines.push(`${p1}payload_mass ${platform.payloadMass}`);
  if (platform.length) lines.push(`${p1}length ${platform.length}`);
  if (platform.width) lines.push(`${p1}width ${platform.width}`);
  if (platform.height) lines.push(`${p1}height ${platform.height}`);
  if (platform.concealmentFactor != null) lines.push(`${p1}concealment_factor ${platform.concealmentFactor}`);
  if (platform.initialDamageFactor != null) lines.push(`${p1}initial_damage_factor ${platform.initialDamageFactor}`);

  // References
  if (platform.radarSignature) lines.push(`${p1}radar_signature ${platform.radarSignature}`);
  if (platform.intersectMesh) lines.push(`${p1}intersect_mesh "${platform.intersectMesh}"`);

  // Categories
  if (platform.categories && platform.categories.length > 0) {
    lines.push(`${p1}category ${platform.categories.join(' ')}`);
  }
  if (platform.creationTime) lines.push(`${p1}creation_time "${platform.creationTime}"`);

  // ---- Sub-components ----

  // Movers
  for (const [, mover] of Object.entries(platform.movers)) {
    lines.push('');
    lines.push(...moverToConf(mover, indent));
  }

  // Sensors
  for (const [, sensor] of Object.entries(platform.sensors)) {
    lines.push('');
    lines.push(...sensorToConf(sensor, indent));
  }

  // Weapons
  for (const [, weapon] of Object.entries(platform.weapons)) {
    lines.push('');
    lines.push(...weaponToConf(weapon, indent));
  }

  // Comms
  for (const [, comm] of Object.entries(platform.comms)) {
    lines.push('');
    lines.push(...commToConf(comm, indent));
  }

  // Processors
  for (const [, proc] of Object.entries(platform.processors)) {
    lines.push('');
    lines.push(...processorToConf(proc, indent));
  }

  // Fuels
  for (const [, fuel] of Object.entries(platform.fuels)) {
    lines.push('');
    lines.push(...fuelToConf(fuel, indent));
  }

  // Zones
  for (const [, zone] of Object.entries(platform.zones)) {
    lines.push('');
    lines.push(`${p1}${zone.type} ${zone.name}`);
    if (zone.shape) lines.push(`${pad(indent, 2)}shape ${zone.shape}`);
    if (zone.include != null) lines.push(`${pad(indent, 2)}include ${zone.include}`);
    lines.push(`${p1}end_${zone.type.toLowerCase()}`);
  }

  // Command chains
  for (const [name, script] of Object.entries(platform.commandChains)) {
    lines.push('');
    lines.push(`${p1}command_chain ${name}`);
    lines.push(`${pad(indent, 2)}script`);
    lines.push(script);
    lines.push(`${pad(indent, 2)}end_script`);
    lines.push(`${p1}end_command_chain`);
  }

  lines.push('end_platform_type');
  return lines;
}

// ============================================================
// Mover serialization
// ============================================================

function moverToConf(mover: AfsimMoverConfig, baseIndent: number): string[] {
  const lines: string[] = [];
  const p1 = pad(baseIndent, 1);
  const p2 = pad(baseIndent, 2);

  // mover TYPE (name is implicit in AFSIM for movers inside platform)
  lines.push(`${p1}mover ${mover.type}`);

  // Base PlatformPart fields
  lines.push(...platformPartToConf(mover, baseIndent + 1));

  if (mover.updateInterval) lines.push(`${p2}update_interval ${mover.updateInterval}`);

  // Route mover fields
  if ('atEndOfPath' in mover && mover.atEndOfPath) lines.push(`${p2}at_end_of_path ${mover.atEndOfPath}`);
  if ('terrain' in mover && mover.terrain != null) lines.push(`${p2}terrain ${mover.terrain}`);
  if ('altitudeOffset' in mover && mover.altitudeOffset) lines.push(`${p2}altitude_offset ${mover.altitudeOffset}`);
  if ('drawRoute' in mover && mover.drawRoute != null) lines.push(`${p2}draw_route ${mover.drawRoute}`);

  // Waypoint mover fields
  const wm = mover as Partial<WaypointMoverBase>;
  if (wm.maximumRadialAcceleration) lines.push(`${p2}maximum_radial_acceleration ${wm.maximumRadialAcceleration}`);
  if (wm.maximumLinearAcceleration) lines.push(`${p2}maximum_linear_acceleration ${wm.maximumLinearAcceleration}`);
  if (wm.maximumClimbRate) lines.push(`${p2}maximum_climb_rate ${wm.maximumClimbRate}`);
  if (wm.defaultClimbRate) lines.push(`${p2}default_climb_rate ${wm.defaultClimbRate}`);
  if (wm.turnRateLimit) lines.push(`${p2}turn_rate_limit ${wm.turnRateLimit}`);
  if (wm.maximumTurnRate) lines.push(`${p2}maximum_turn_rate ${wm.maximumTurnRate}`);
  if (wm.bankAngleLimit) lines.push(`${p2}bank_angle_limit ${wm.bankAngleLimit}`);
  if (wm.minimumAltitude) lines.push(`${p2}minimum_altitude ${wm.minimumAltitude}`);
  if (wm.maximumAltitude) lines.push(`${p2}maximum_altitude ${wm.maximumAltitude}`);
  if (wm.minimumSpeed) lines.push(`${p2}minimum_speed ${wm.minimumSpeed}`);
  if (wm.maximumSpeed) lines.push(`${p2}maximum_speed ${wm.maximumSpeed}`);
  if (wm.maximumFlightPathAngle) lines.push(`${p2}maximum_flight_path_angle ${wm.maximumFlightPathAngle}`);
  if (wm.bodyGLimit) lines.push(`${p2}body_g_limit ${wm.bodyGLimit}`);
  if (wm.rollRateLimit) lines.push(`${p2}roll_rate_limit ${wm.rollRateLimit}`);
  if (wm.headingPursuitGain != null) lines.push(`${p2}heading_pursuit_gain ${wm.headingPursuitGain}`);
  if (wm.isOnGround != null) lines.push(`${p2}is_on_ground ${wm.isOnGround}`);
  if (wm.turnGLimit) lines.push(`${p2}turn_g_limit ${wm.turnGLimit}`);

  // Air mover specific
  if (mover.type === 'WSF_AIR_MOVER' && 'maximumImpactSpeed' in mover && (mover as any).maximumImpactSpeed) {
    lines.push(`${p2}maximum_impact_speed ${(mover as any).maximumImpactSpeed}`);
  }

  // Space mover specific
  if (mover.type === 'WSF_SPACE_MOVER') {
    const sm = mover as SpaceMoverConfig;
    if (sm.semiMajorAxis) lines.push(`${p2}semi_major_axis ${sm.semiMajorAxis}`);
    if (sm.eccentricity != null) lines.push(`${p2}eccentricity ${sm.eccentricity}`);
    if (sm.inclination) lines.push(`${p2}inclination ${sm.inclination}`);
    if (sm.raan) lines.push(`${p2}raan ${sm.raan}`);
    if (sm.argumentOfPeriapsis) lines.push(`${p2}argument_of_periapsis ${sm.argumentOfPeriapsis}`);
    if (sm.trueAnomaly) lines.push(`${p2}true_anomaly ${sm.trueAnomaly}`);
  }

  // Rotorcraft mover specific
  if (mover.type === 'WSF_ROTORCRAFT_MOVER') {
    const rm = mover as RotorcraftMoverConfig;
    if (rm.desiredHeading) lines.push(`${p2}desired_heading ${rm.desiredHeading}`);
    if (rm.positionHoldCaptureRadius) lines.push(`${p2}position_hold_capture_radius ${rm.positionHoldCaptureRadius}`);
    if (rm.maximumGroundSpeed) lines.push(`${p2}maximum_ground_speed ${rm.maximumGroundSpeed}`);
    if (rm.maximumRateOfClimb) lines.push(`${p2}maximum_rate_of_climb ${rm.maximumRateOfClimb}`);
    if (rm.maximumRateOfDescent) lines.push(`${p2}maximum_rate_of_descent ${rm.maximumRateOfDescent}`);
    if (rm.maximumTotalAcceleration) lines.push(`${p2}maximum_total_acceleration ${rm.maximumTotalAcceleration}`);
  }

  // Kinematic mover specific
  if (mover.type === 'WSF_KINEMATIC_MOVER') {
    const km = mover as KinematicMoverConfig;
    if (km.targetSpeed) lines.push(`${p2}target_speed ${km.targetSpeed}`);
    if (km.desiredSpeed) lines.push(`${p2}desired_speed ${km.desiredSpeed}`);
    if (km.initialSpeed) lines.push(`${p2}initial_speed ${km.initialSpeed}`);
    if (km.initialFlightPathAngle) lines.push(`${p2}initial_flight_path_angle ${km.initialFlightPathAngle}`);
    if (km.maximumBodyTurnRate) lines.push(`${p2}maximum_body_turn_rate ${km.maximumBodyTurnRate}`);
    if (km.maximumBodyRollRate) lines.push(`${p2}maximum_body_roll_rate ${km.maximumBodyRollRate}`);
    if (km.bankToTurn != null) lines.push(`${p2}bank_to_turn ${km.bankToTurn}`);
    if (km.switchOnApproach != null) lines.push(`${p2}switch_on_approach ${km.switchOnApproach}`);
  }

  // Guided mover specific
  if (mover.type === 'WSF_GUIDED_MOVER') {
    const gm = mover as any;
    if (gm.mass) lines.push(`${p2}mass ${gm.mass}`);
    if (gm.specificImpulse) lines.push(`${p2}specific_impulse ${gm.specificImpulse}`);
    if (gm.thrust) lines.push(`${p2}thrust ${gm.thrust}`);
    if (gm.thrustDuration) lines.push(`${p2}thrust_duration ${gm.thrustDuration}`);
    if (gm.fuel) lines.push(`${p2}fuel ${gm.fuel}`);
    if (gm.coastTime) lines.push(`${p2}coast_time ${gm.coastTime}`);
    if (gm.gLimit) lines.push(`${p2}g_limit ${gm.gLimit}`);
  }

  // Brawler mover specific
  if (mover.type === 'WSF_BRAWLER_MOVER') {
    const bm = mover as any;
    if (bm.aeroFile) lines.push(`${p2}aero_file ${bm.aeroFile}`);
    if (bm.updateTimeTolerance) lines.push(`${p2}update_time_tolerance ${bm.updateTimeTolerance}`);
    if (bm.fuelFraction != null) lines.push(`${p2}fuel_fraction ${bm.fuelFraction}`);
  }

  // Road mover specific
  if (mover.type === 'WSF_ROAD_MOVER') {
    const rom = mover as any;
    if (rom.roadNetwork) lines.push(`${p2}road_network "${rom.roadNetwork}"`);
    if (rom.considerOffRoadShortcut != null) lines.push(`${p2}consider_off_road_shortcut ${rom.considerOffRoadShortcut}`);
    if (rom.ignoreOffRoadPath != null) lines.push(`${p2}ignore_off_road_path ${rom.ignoreOffRoadPath}`);
    if (rom.offRoadSpeed) lines.push(`${p2}off_road_speed ${rom.offRoadSpeed}`);
    if (rom.linearAcceleration) lines.push(`${p2}linear_acceleration ${rom.linearAcceleration}`);
  }

  // Offset mover specific
  if (mover.type === 'WSF_OFFSET_MOVER') {
    const om = mover as any;
    if (om.attachmentType) lines.push(`${p2}attachment_type ${om.attachmentType}`);
    if (om.referencePlatform) lines.push(`${p2}reference_platform "${om.referencePlatform}"`);
    if (om.offsetFromReference) lines.push(`${p2}offset_from_reference ${om.offsetFromReference.join(' ')}`);
    if (om.orphanAction) lines.push(`${p2}orphan_action ${om.orphanAction}`);
  }

  // TSPI mover specific
  if (mover.type === 'WSF_TSPI_MOVER') {
    const tm = mover as any;
    if (tm.filename) lines.push(`${p2}filename "${tm.filename}"`);
    if (tm.startTime) lines.push(`${p2}start_time ${tm.startTime}`);
    if (tm.extrapolation != null) lines.push(`${p2}extrapolation ${tm.extrapolation}`);
  }

  lines.push(`${p1}end_mover`);
  return lines;
}

// ============================================================
// Sensor serialization
// ============================================================

function sensorToConf(sensor: AfsimSensorConfig, baseIndent: number): string[] {
  const lines: string[] = [];
  const p1 = pad(baseIndent, 1);
  const p2 = pad(baseIndent, 2);

  // sensor NAME TYPE
  lines.push(`${p1}sensor ${sensor.name} ${sensor.type}`);

  // Base articulated part fields
  lines.push(...articulatedPartToConf(sensor, baseIndent + 1));

  // Instance-level properties
  if ('internalLink' in sensor && sensor.internalLink) lines.push(`${p2}internal_link ${sensor.internalLink}`);
  if ('ignoreSameSide' in sensor && sensor.ignoreSameSide) lines.push(`${p2}ignore_same_side`);

  // Type-specific fields
  switch (sensor.type) {
    case 'WSF_RADAR_SENSOR':
      lines.push(...radarSensorToConf(sensor as any, baseIndent + 1));
      break;
    case 'WSF_PASSIVE_SENSOR':
    case 'WSF_ESM_SENSOR':
      lines.push(...passiveSensorToConf(sensor as any, baseIndent + 1));
      break;
    case 'WSF_EOIR_SENSOR':
    case 'WSF_IRST_SENSOR':
      lines.push(...eoirSensorToConf(sensor as any, baseIndent + 1));
      break;
    case 'WSF_SAR_SENSOR':
      lines.push(...sarSensorToConf(sensor as any, baseIndent + 1));
      break;
    case 'WSF_ACOUSTIC_SENSOR':
      lines.push(...acousticSensorToConf(sensor as any, baseIndent + 1));
      break;
    case 'WSF_LADAR_SENSOR':
      lines.push(...ladarSensorToConf(sensor as any, baseIndent + 1));
      break;
    case 'WSF_LASER_DESIGNATOR': {
      const ld = sensor as any;
      if (ld.laserCode != null) lines.push(`${p2}laser_code ${ld.laserCode}`);
      if (ld.maximumTargetAssociationDistance) lines.push(`${p2}maximum_target_association_distance ${ld.maximumTargetAssociationDistance}`);
      if (ld.maximumTransmissionRange) lines.push(`${p2}maximum_transmission_range ${ld.maximumTransmissionRange}`);
      break;
    }
    case 'WSF_LASER_TRACKER':
      if ((sensor as any).laserCode != null) lines.push(`${p2}laser_code ${(sensor as any).laserCode}`);
      break;
    case 'WSF_GEOMETRIC_SENSOR':
      lines.push(...geometricSensorToConf(sensor as any, baseIndent + 1));
      break;
    case 'WSF_COMPOSITE_SENSOR': {
      const cs = sensor as any;
      if (cs.operatingMode) lines.push(`${p2}operating_mode ${cs.operatingMode}`);
      for (const sub of cs.sensors) lines.push(`${p2}sensor ${sub}`);
      if (cs.trackQuality != null) lines.push(`${p2}track_quality ${cs.trackQuality}`);
      break;
    }
    case 'WSF_NULL_SENSOR':
      break;
  }

  if ('initialMode' in sensor && sensor.initialMode) {
    lines.push(`${p2}initial_mode "${sensor.initialMode}"`);
  }

  lines.push(`${p1}end_sensor`);
  return lines;
}

function radarSensorToConf(sensor: RadarSensorConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  // mode_template
  if (sensor.template) {
    lines.push(...radarModeToConf(sensor.template, indent, 'mode_template'));
  }

  // Named modes
  for (const [modeName, mode] of Object.entries(sensor.modes)) {
    lines.push(...radarModeToConf(mode, indent, `mode ${modeName}`));
  }

  return lines;
}

function radarModeToConf(mode: RadarSensorMode, indent: number, keyword: string): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  lines.push(`${p}${keyword}`);

  if (mode.transmitOnly != null) lines.push(`${pad(indent, 2)}transmit_only ${mode.transmitOnly}`);
  if (mode.receiveOnly != null) lines.push(`${pad(indent, 2)}receive_only ${mode.receiveOnly}`);
  if (mode.computeMeasurementErrors != null) lines.push(`${pad(indent, 2)}compute_measurement_errors ${mode.computeMeasurementErrors}`);
  if (mode.overrideMeasurementWithTruth != null) lines.push(`${pad(indent, 2)}override_measurement_with_truth ${mode.overrideMeasurementWithTruth}`);
  if (mode.frequencySelectDelay) lines.push(`${pad(indent, 2)}frequency_select_delay ${mode.frequencySelectDelay}`);

  // Sensor mode base fields
  lines.push(...sensorModeToConf(mode, indent + 1));

  // Beams (transmitter/receiver inside mode)
  for (const [, beam] of Object.entries(mode.beams ?? {})) {
    if (beam.transmitter) lines.push(...transmitterToConf(beam.transmitter, indent + 1));
    if (beam.receiver) lines.push(...receiverToConf(beam.receiver, indent + 1));
    if (beam.integrationGain) lines.push(`${pad(indent, 2)}integration_gain ${beam.integrationGain}`);
    if (beam.adjustmentFactor != null) lines.push(`${pad(indent, 2)}adjustment_factor ${beam.adjustmentFactor}`);
    if (beam.operatingLoss) lines.push(`${pad(indent, 2)}operating_loss ${beam.operatingLoss}`);
    if (beam.detectionThreshold) lines.push(`${pad(indent, 2)}detection_threshold ${beam.detectionThreshold}`);
    if (beam.swerlingCase != null) lines.push(`${pad(indent, 2)}swerling_case ${beam.swerlingCase}`);
    if (beam.numberOfPulsesIntegrated != null) lines.push(`${pad(indent, 2)}number_of_pulses_integrated ${beam.numberOfPulsesIntegrated}`);
    if (beam.probabilityOfFalseAlarm != null) lines.push(`${pad(indent, 2)}probability_of_false_alarm ${beam.probabilityOfFalseAlarm}`);
    if (beam.oneM2_DetectRange) lines.push(`${pad(indent, 2)}one_m2_detect_range ${beam.oneM2_DetectRange}`);
    if (beam.rangeProduct) lines.push(`${pad(indent, 2)}range_product ${beam.rangeProduct}`);
    if (beam.loopGain) lines.push(`${pad(indent, 2)}loop_gain ${beam.loopGain}`);
    if (beam.lookDownFactor) lines.push(`${pad(indent, 2)}look_down_factor ${beam.lookDownFactor}`);
    if (beam.prfFactor) lines.push(`${pad(indent, 2)}prf_factor ${beam.prfFactor}`);
    if (beam.dopplerResolution) lines.push(`${pad(indent, 2)}doppler_resolution ${beam.dopplerResolution}`);
    if (beam.clutterAttenuationFactor) lines.push(`${pad(indent, 2)}clutter_attenuation_factor ${beam.clutterAttenuationFactor}`);

    if (beam.errorModelParameters) {
      const emp = beam.errorModelParameters;
      lines.push(`${pad(indent, 2)}error_model_parameters`);
      if (emp.azimuthBeamwidth) lines.push(`${pad(indent, 3)}azimuth_beamwidth ${emp.azimuthBeamwidth}`);
      if (emp.elevationBeamwidth) lines.push(`${pad(indent, 3)}elevation_beamwidth ${emp.elevationBeamwidth}`);
      if (emp.pulseWidth) lines.push(`${pad(indent, 3)}pulse_width ${emp.pulseWidth}`);
      if (emp.receiverBandwidth) lines.push(`${pad(indent, 3)}receiver_bandwidth ${emp.receiverBandwidth}`);
      if (emp.dopplerResolution) lines.push(`${pad(indent, 3)}doppler_resolution ${emp.dopplerResolution}`);
      lines.push(`${pad(indent, 2)}end_error_model_parameters`);
    }
  }

  // end keyword matches the opening keyword
  const endKw = keyword.startsWith('mode ') ? 'end_mode' : `end_${keyword}`;
  lines.push(`${p}${endKw}`);
  return lines;
}

function passiveSensorToConf(sensor: PassiveSensorConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (sensor.template) {
    lines.push(`${p}mode_template`);
    lines.push(...sensorModeToConf(sensor.template, indent + 1));
    if (sensor.template.detectionThreshold) lines.push(`${pad(indent, 2)}detection_threshold ${sensor.template.detectionThreshold}`);
    if (sensor.template.continuousDetectionThreshold) lines.push(`${pad(indent, 2)}continuous_detection_threshold ${sensor.template.continuousDetectionThreshold}`);
    if (sensor.template.pulsedDetectionThreshold) lines.push(`${pad(indent, 2)}pulsed_detection_threshold ${sensor.template.pulsedDetectionThreshold}`);
    if (sensor.template.detectionSensitivity) lines.push(`${pad(indent, 2)}detection_sensitivity ${sensor.template.detectionSensitivity}`);
    for (const [, beam] of Object.entries(sensor.template.beams ?? {})) {
      if (beam.receiver) lines.push(...receiverToConf(beam.receiver, indent + 2));
    }
    lines.push(`${p}end_mode_template`);
  }

  for (const [modeName, mode] of Object.entries(sensor.modes)) {
    lines.push(`${p}mode ${modeName}`);
    lines.push(...sensorModeToConf(mode, indent + 1));
    if (mode.detectionThreshold) lines.push(`${pad(indent, 2)}detection_threshold ${mode.detectionThreshold}`);
    if (mode.continuousDetectionThreshold) lines.push(`${pad(indent, 2)}continuous_detection_threshold ${mode.continuousDetectionThreshold}`);
    if (mode.pulsedDetectionThreshold) lines.push(`${pad(indent, 2)}pulsed_detection_threshold ${mode.pulsedDetectionThreshold}`);
    if (mode.detectionSensitivity) lines.push(`${pad(indent, 2)}detection_sensitivity ${mode.detectionSensitivity}`);
    for (const [, beam] of Object.entries(mode.beams ?? {})) {
      if (beam.receiver) lines.push(...receiverToConf(beam.receiver, indent + 2));
    }
    lines.push(`${p}end_mode`);
  }

  return lines;
}

function eoirSensorToConf(sensor: EoirSensorConfig | IrstSensorConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (sensor.template) {
    lines.push(`${p}mode_template`);
    lines.push(...eoirModeToConf(sensor.template, indent + 1));
    lines.push(`${p}end_mode_template`);
  }

  for (const [modeName, mode] of Object.entries(sensor.modes)) {
    lines.push(`${p}mode ${modeName}`);
    lines.push(...eoirModeToConf(mode, indent + 1));
    lines.push(`${p}end_mode`);
  }

  return lines;
}

function eoirModeToConf(mode: EoirSensorMode, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  lines.push(...sensorModeToConf(mode, indent));

  if (mode.band) lines.push(`${p}band ${mode.band}`);
  if (mode.bands) {
    for (const b of mode.bands) lines.push(`${p}band ${b}`);
  }
  if (mode.detectNegativeContrast != null) lines.push(`${p}detect_negative_contrast ${mode.detectNegativeContrast}`);
  if (mode.detectorModel) lines.push(`${p}detector_model ${mode.detectorModel}`);
  if (mode.detectorGain != null) lines.push(`${p}detector_gain ${mode.detectorGain}`);
  if (mode.integrationGain != null) lines.push(`${p}integration_gain ${mode.integrationGain}`);
  if (mode.nei) lines.push(`${p}nei ${mode.nei}`);
  if (mode.detectionThreshold != null) lines.push(`${p}detection_threshold ${mode.detectionThreshold}`);
  if (mode.atmosphericAttenuation) lines.push(`${p}atmospheric_attenuation ${mode.atmosphericAttenuation}`);
  if (mode.backgroundRadiance) lines.push(`${p}background_radiance ${mode.backgroundRadiance}`);
  if (mode.angularResolution) lines.push(`${p}angular_resolution ${mode.angularResolution}`);
  if (mode.pixelCount) lines.push(`${p}pixel_count ${mode.pixelCount[0]} ${mode.pixelCount[1]}`);
  if (mode.receiver) lines.push(...receiverToConf(mode.receiver, indent));

  return lines;
}

function sarSensorToConf(sensor: SarSensorConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (sensor.template) {
    lines.push(`${p}mode_template`);
    lines.push(...sensorModeToConf(sensor.template, indent + 1));
    if (sensor.template.swathWidth) lines.push(`${pad(indent, 2)}swath_width ${sensor.template.swathWidth}`);
    if (sensor.template.resolution) lines.push(`${pad(indent, 2)}resolution ${sensor.template.resolution}`);
    if (sensor.template.integrationTime) lines.push(`${pad(indent, 2)}integration_time ${sensor.template.integrationTime}`);
    if (sensor.template.lookAngle) lines.push(`${pad(indent, 2)}look_angle ${sensor.template.lookAngle}`);
    lines.push(`${p}end_mode_template`);
  }

  for (const [modeName, mode] of Object.entries(sensor.modes)) {
    lines.push(`${p}mode ${modeName}`);
    lines.push(...sensorModeToConf(mode, indent + 1));
    if (mode.swathWidth) lines.push(`${pad(indent, 2)}swath_width ${mode.swathWidth}`);
    if (mode.resolution) lines.push(`${pad(indent, 2)}resolution ${mode.resolution}`);
    if (mode.integrationTime) lines.push(`${pad(indent, 2)}integration_time ${mode.integrationTime}`);
    if (mode.lookAngle) lines.push(`${pad(indent, 2)}look_angle ${mode.lookAngle}`);
    lines.push(`${p}end_mode`);
  }

  return lines;
}

function acousticSensorToConf(sensor: AcousticSensorConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (sensor.template) {
    lines.push(`${p}mode_template`);
    lines.push(...sensorModeToConf(sensor.template, indent + 1));
    if (sensor.template.noiseLevel) lines.push(`${pad(indent, 2)}noise_level ${sensor.template.noiseLevel}`);
    if (sensor.template.receiver) lines.push(...receiverToConf(sensor.template.receiver, indent + 2));
    if (sensor.template.detectionThreshold) lines.push(`${pad(indent, 2)}detection_threshold ${sensor.template.detectionThreshold}`);
    lines.push(`${p}end_mode_template`);
  }

  for (const [modeName, mode] of Object.entries(sensor.modes)) {
    lines.push(`${p}mode ${modeName}`);
    lines.push(...sensorModeToConf(mode, indent + 1));
    if (mode.noiseLevel) lines.push(`${pad(indent, 2)}noise_level ${mode.noiseLevel}`);
    if (mode.receiver) lines.push(...receiverToConf(mode.receiver, indent + 2));
    if (mode.detectionThreshold) lines.push(`${pad(indent, 2)}detection_threshold ${mode.detectionThreshold}`);
    lines.push(`${p}end_mode`);
  }

  return lines;
}

function ladarSensorToConf(sensor: LadarSensorConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (sensor.template) {
    lines.push(`${p}mode_template`);
    lines.push(...sensorModeToConf(sensor.template, indent + 1));
    const t = sensor.template.transmitter;
    if (t) {
      lines.push(`${pad(indent, 2)}transmitter`);
      if (t.apertureDiameter) lines.push(`${pad(indent, 3)}aperture_diameter ${t.apertureDiameter}`);
      if (t.averagePower) lines.push(`${pad(indent, 3)}average_power ${t.averagePower}`);
      if (t.beamDivergenceAngle) lines.push(`${pad(indent, 3)}beam_divergence_angle ${t.beamDivergenceAngle}`);
      if (t.wavelength) lines.push(`${pad(indent, 3)}wavelength ${t.wavelength}`);
      lines.push(`${pad(indent, 2)}end_transmitter`);
    }
    const r = sensor.template.receiver;
    if (r) {
      lines.push(`${pad(indent, 2)}receiver`);
      if (r.apertureDiameter) lines.push(`${pad(indent, 3)}aperture_diameter ${r.apertureDiameter}`);
      if (r.bandpass) lines.push(`${pad(indent, 3)}bandpass ${r.bandpass}`);
      if (r.quantumEfficiency != null) lines.push(`${pad(indent, 3)}quantum_efficiency ${r.quantumEfficiency}`);
      if (r.detectorGain != null) lines.push(`${pad(indent, 3)}detector_gain ${r.detectorGain}`);
      if (r.circuitTemperature) lines.push(`${pad(indent, 3)}circuit_temperature ${r.circuitTemperature}`);
      lines.push(`${pad(indent, 2)}end_receiver`);
    }
    if (sensor.template.backgroundTemperature) lines.push(`${pad(indent, 2)}background_temperature ${sensor.template.backgroundTemperature}`);
    if (sensor.template.backgroundIrradiance) lines.push(`${pad(indent, 2)}background_irradiance ${sensor.template.backgroundIrradiance}`);
    if (sensor.template.integrationGain != null) lines.push(`${pad(indent, 2)}integration_gain ${sensor.template.integrationGain}`);
    if (sensor.template.detectionThreshold != null) lines.push(`${pad(indent, 2)}detection_threshold ${sensor.template.detectionThreshold}`);
    lines.push(`${p}end_mode_template`);
  }

  return lines;
}

function geometricSensorToConf(sensor: GeometricSensorConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (sensor.template) {
    lines.push(`${p}mode_template`);
    lines.push(...sensorModeToConf(sensor.template, indent + 1));
    if (sensor.template.detectionRanges) {
      for (const dr of sensor.template.detectionRanges) {
        lines.push(`${pad(indent, 2)}detection_range ${dr.platformType} ${dr.range}`);
      }
    }
    if (sensor.template.receiver) lines.push(...receiverToConf(sensor.template.receiver, indent + 2));
    lines.push(`${p}end_mode_template`);
  }

  return lines;
}

// ============================================================
// Weapon serialization
// ============================================================

function weaponToConf(weapon: AfsimWeaponConfig, baseIndent: number): string[] {
  const lines: string[] = [];
  const p1 = pad(baseIndent, 1);
  const p2 = pad(baseIndent, 2);

  // weapon NAME TYPE
  lines.push(`${p1}weapon ${weapon.name} ${weapon.type}`);

  // Base articulated part fields
  lines.push(...articulatedPartToConf(weapon, baseIndent + 1));

  // Weapon base fields
  if (weapon.quantity != null) lines.push(`${p2}quantity ${weapon.quantity}`);
  if (weapon.maximumQuantity != null) lines.push(`${p2}maximum_quantity ${weapon.maximumQuantity}`);
  if (weapon.launchedPlatformType) lines.push(`${p2}launched_platform_type ${weapon.launchedPlatformType}`);
  if (weapon.firingInterval) lines.push(`${p2}firing_interval ${weapon.firingInterval}`);
  if (weapon.updateInterval) lines.push(`${p2}update_interval ${weapon.updateInterval}`);
  if (weapon.maximumRequestCount != null) lines.push(`${p2}maximum_request_count ${weapon.maximumRequestCount}`);
  if (weapon.reloadTime) lines.push(`${p2}reload_time ${weapon.reloadTime}`);
  if (weapon.automaticTargetCueing != null) lines.push(`${p2}automatic_target_cueing ${weapon.automaticTargetCueing}`);
  if (weapon.cueToPredictedIntercept != null) lines.push(`${p2}cue_to_predicted_intercept ${weapon.cueToPredictedIntercept}`);
  if (weapon.inhibitWhileReloading != null) lines.push(`${p2}inhibit_while_reloading ${weapon.inhibitWhileReloading}`);
  if (weapon.reloadThreshold != null) lines.push(`${p2}reload_threshold ${weapon.reloadThreshold}`);
  if (weapon.reloadIncrement != null) lines.push(`${p2}reload_increment ${weapon.reloadIncrement}`);
  if (weapon.reloadInventory != null) lines.push(`${p2}reload_inventory ${weapon.reloadInventory}`);
  if (weapon.weaponEffects) lines.push(`${p2}weapon_effects ${weapon.weaponEffects}`);
  if (weapon.unknownTargetRange) lines.push(`${p2}unknown_target_range ${weapon.unknownTargetRange}`);
  if (weapon.unknownTargetAltitude) lines.push(`${p2}unknown_target_altitude ${weapon.unknownTargetAltitude}`);

  // Launch computer (inline block)
  if (weapon.launchComputer) {
    lines.push(...launchComputerToConf(weapon.launchComputer, baseIndent + 1));
  }

  // RF Jammer specific
  if (weapon.type === 'WSF_RF_JAMMER') {
    const jw = weapon as any;
    if (jw.jammerGroup) lines.push(`${p2}jammer_group "${jw.jammerGroup}"`);
    if (jw.groupPowerDistribution) lines.push(`${p2}group_power_distribution ${jw.groupPowerDistribution}`);
    if (jw.template) {
      lines.push(`${p2}mode_template`);
      lines.push(...rfJammerModeToConf(jw.template, baseIndent + 2));
      lines.push(`${p2}end_mode_template`);
    }
    for (const [modeName, mode] of Object.entries(jw.modes)) {
      lines.push(`${p2}mode ${modeName}`);
      lines.push(...rfJammerModeToConf(mode as any, baseIndent + 2));
      lines.push(`${p2}end_mode`);
    }
  }

  // Laser weapon specific
  if (weapon.type === 'WSF_LASER_WEAPON' || weapon.type === 'WSF_CUED_LASER_WEAPON') {
    const lw = weapon as any;
    if (lw.firingTime) lines.push(`${p2}firing_time ${lw.firingTime}`);
    if (lw.firingUpdateInterval) lines.push(`${p2}firing_update_interval ${lw.firingUpdateInterval}`);
    if (lw.coolingUpdateInterval) lines.push(`${p2}cooling_update_interval ${lw.coolingUpdateInterval}`);
    if (lw.numberOfShots != null) lines.push(`${p2}number_of_shots ${lw.numberOfShots}`);
    if (lw.coolingTime) lines.push(`${p2}cooling_time ${lw.coolingTime}`);
    if (lw.efficiency != null) lines.push(`${p2}efficiency ${lw.efficiency}`);
    if (lw.highTemperatureLimit) lines.push(`${p2}high_temperature_limit ${lw.highTemperatureLimit}`);
    if (lw.lowTemperatureLimit) lines.push(`${p2}low_temperature_limit ${lw.lowTemperatureLimit}`);
    if (lw.minimumTotalFiringTime) lines.push(`${p2}minimum_total_firing_time ${lw.minimumTotalFiringTime}`);
    if (lw.fluenceModel) lines.push(`${p2}fluence_model "${lw.fluenceModel}"`);
    if (lw.beamDirector) lines.push(`${p2}beam_director "${lw.beamDirector}"`);
  }

  lines.push(`${p1}end_weapon`);
  return lines;
}

function launchComputerToConf(lc: AfsimLaunchComputerConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  lines.push(`${p}launch_computer ${lc.type}`);
  if (lc.maximumDeltaAltitude) lines.push(`${pad(indent, 2)}maximum_delta_altitude ${lc.maximumDeltaAltitude}`);
  if (lc.minimumDeltaAltitude) lines.push(`${pad(indent, 2)}minimum_delta_altitude ${lc.minimumDeltaAltitude}`);
  if (lc.maximumSlantRange) lines.push(`${pad(indent, 2)}maximum_slant_range ${lc.maximumSlantRange}`);
  if (lc.minimumSlantRange) lines.push(`${pad(indent, 2)}minimum_slant_range ${lc.minimumSlantRange}`);
  if (lc.maximumTimeOfFlight) lines.push(`${pad(indent, 2)}maximum_time_of_flight ${lc.maximumTimeOfFlight}`);
  if (lc.maximumBoresightAngle) lines.push(`${pad(indent, 2)}maximum_boresight_angle ${lc.maximumBoresightAngle}`);
  if (lc.thrustDuration) lines.push(`${pad(indent, 2)}thrust_duration ${lc.thrustDuration}`);
  if (lc.coastDuration) lines.push(`${pad(indent, 2)}coast_duration ${lc.coastDuration}`);
  if (lc.burnoutSpeed) lines.push(`${pad(indent, 2)}burnout_speed ${lc.burnoutSpeed}`);
  if (lc.minimumTerminalSpeed) lines.push(`${pad(indent, 2)}minimum_terminal_speed ${lc.minimumTerminalSpeed}`);
  if (lc.maximumClosingSpeed) lines.push(`${pad(indent, 2)}maximum_closing_speed ${lc.maximumClosingSpeed}`);
  if (lc.minimumClosingSpeed) lines.push(`${pad(indent, 2)}minimum_closing_speed ${lc.minimumClosingSpeed}`);
  if (lc.maximumOpeningSpeed) lines.push(`${pad(indent, 2)}maximum_opening_speed ${lc.maximumOpeningSpeed}`);
  if (lc.minimumOpeningSpeed) lines.push(`${pad(indent, 2)}minimum_opening_speed ${lc.minimumOpeningSpeed}`);
  lines.push(`${p}end_launch_computer`);

  return lines;
}

function rfJammerModeToConf(mode: RfJammerMode, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (mode.transmitter) lines.push(...transmitterToConf(mode.transmitter, indent));
  if (mode.antenna) lines.push(...antennaToConf(mode.antenna, indent));
  if (mode.maximumSpotsPerBeam != null) lines.push(`${p}maximum_spots_per_beam ${mode.maximumSpotsPerBeam}`);
  if (mode.maximumNumberOfBeams != null) lines.push(`${p}maximum_number_of_beams ${mode.maximumNumberOfBeams}`);
  if (mode.maximumNumberOfSpots != null) lines.push(`${p}maximum_number_of_spots ${mode.maximumNumberOfSpots}`);
  if (mode.frequencyFollowing != null) lines.push(`${p}frequency_following ${mode.frequencyFollowing}`);
  if (mode.signalFollowing != null) lines.push(`${p}signal_following ${mode.signalFollowing}`);
  if (mode.beamPowerDistribution) lines.push(`${p}beam_power_distribution ${mode.beamPowerDistribution}`);
  if (mode.repeaterOperatingMode) lines.push(`${p}repeater_operating_mode ${mode.repeaterOperatingMode}`);

  return lines;
}

// ============================================================
// Comm serialization
// ============================================================

function commToConf(comm: AfsimCommConfig, baseIndent: number): string[] {
  const lines: string[] = [];
  const p1 = pad(baseIndent, 1);
  const p2 = pad(baseIndent, 2);

  // comm NAME TYPE
  lines.push(`${p1}comm ${comm.name} ${comm.type}`);

  // Base articulated part fields
  lines.push(...articulatedPartToConf(comm, baseIndent + 1));

  // Comm base fields
  if (comm.networkName) lines.push(`${p2}network_name "${comm.networkName}"`);
  if (comm.networkAddress) lines.push(`${p2}network_address "${comm.networkAddress}"`);
  if (comm.address) lines.push(`${p2}address "${comm.address}"`);
  if (comm.routerName) lines.push(`${p2}router_name "${comm.routerName}"`);
  if (comm.channels != null) lines.push(`${p2}channels ${comm.channels}`);

  // Links
  if (comm.links) {
    for (const link of comm.links) {
      lines.push(`${p2}link "${link.platform}" "${link.comm}"`);
    }
  }

  // Medium
  if (comm.medium) {
    const m = comm.medium;
    lines.push(`${p2}comm_medium`);
    if (m.propagationSpeed) lines.push(`${pad(baseIndent, 3)}propagation_speed ${m.propagationSpeed}`);
    if (m.transferRate) lines.push(`${pad(baseIndent, 3)}transfer_rate ${m.transferRate}`);
    if (m.packetLossTime) lines.push(`${pad(baseIndent, 3)}packet_loss_time ${m.packetLossTime}`);
    if (m.bitErrorProbability != null) lines.push(`${pad(baseIndent, 3)}bit_error_probability ${m.bitErrorProbability}`);
    if (m.errorCorrection != null) lines.push(`${pad(baseIndent, 3)}error_correction ${m.errorCorrection}`);
    lines.push(`${p2}end_comm_medium`);
  }

  // Datalink layer
  if (comm.datalinkLayer) {
    const dl = comm.datalinkLayer;
    lines.push(`${p2}datalink_layer`);
    if (dl.queueType) lines.push(`${pad(baseIndent, 3)}queue_type ${dl.queueType}`);
    if (dl.queueLimit != null) lines.push(`${pad(baseIndent, 3)}queue_limit ${dl.queueLimit}`);
    if (dl.retransmitAttempts != null) lines.push(`${pad(baseIndent, 3)}retransmit_attempts ${dl.retransmitAttempts}`);
    if (dl.retransmitDelay) lines.push(`${pad(baseIndent, 3)}retransmit_delay ${dl.retransmitDelay}`);
    if (dl.purgeInterval) lines.push(`${pad(baseIndent, 3)}purge_interval ${dl.purgeInterval}`);
    lines.push(`${p2}end_datalink_layer`);
  }

  // Transceiver-specific: transmitter/receiver
  if ('transmitter' in comm && comm.transmitter) {
    lines.push(...transmitterToConf(comm.transmitter as TransmitterConfig, baseIndent + 1));
  }
  if ('receiver' in comm && comm.receiver) {
    lines.push(...receiverToConf(comm.receiver as ReceiverConfig, baseIndent + 1));
  }

  lines.push(`${p1}end_comm`);
  return lines;
}

// ============================================================
// Processor serialization
// ============================================================

function processorToConf(proc: AfsimProcessorConfig, baseIndent: number): string[] {
  const lines: string[] = [];
  const p1 = pad(baseIndent, 1);
  const p2 = pad(baseIndent, 2);

  // processor NAME TYPE
  lines.push(`${p1}processor ${proc.name} ${proc.type}`);

  // Base PlatformPart fields
  lines.push(...platformPartToConf(proc, baseIndent + 1));
  if (proc.updateInterval) lines.push(`${p2}update_interval ${proc.updateInterval}`);

  // Type-specific fields
  switch (proc.type) {
    case 'WSF_SCRIPT_PROCESSOR':
      if (proc.script) {
        lines.push(`${p2}script`);
        lines.push(proc.script);
        lines.push(`${p2}end_script`);
      }
      if (proc.onInitialize) {
        lines.push(`${p2}on_initialize`);
        lines.push(proc.onInitialize);
        lines.push(`${p2}end_on_initialize`);
      }
      if (proc.onUpdate) {
        lines.push(`${p2}on_update`);
        lines.push(proc.onUpdate);
        lines.push(`${p2}end_on_update`);
      }
      if (proc.states) {
        for (const [stateName, state] of Object.entries(proc.states)) {
          lines.push(`${p2}state ${stateName}`);
          if (state.onEntry) { lines.push(`${pad(baseIndent, 3)}on_entry`); lines.push(state.onEntry); lines.push(`${pad(baseIndent, 3)}end_on_entry`); }
          if (state.onExit) { lines.push(`${pad(baseIndent, 3)}on_exit`); lines.push(state.onExit); lines.push(`${pad(baseIndent, 3)}end_on_exit`); }
          if (state.nextState) lines.push(`${pad(baseIndent, 3)}next_state "${state.nextState}"`);
          lines.push(`${p2}end_state`);
        }
      }
      if (proc.behaviorTree) {
        // 结构化行为树（来自 BehaviorTreeEditor 编辑或完整解析）优先于原始文本序列化
        lines.push(`${p2}advanced_behavior_tree`);
        lines.push(...behaviorTreeToConf(proc.behaviorTree as AdvancedBehaviorTreeConfig, baseIndent, 3));
        lines.push(`${p2}end_advanced_behavior_tree`);
      } else if (proc.advancedBehaviorTree) {
        lines.push(`${p2}advanced_behavior_tree`);
        lines.push(proc.advancedBehaviorTree);
        lines.push(`${p2}end_advanced_behavior_tree`);
      }
      break;

    case 'WSF_TRACK_PROCESSOR':
      if (proc.masterTrackProcessor != null) lines.push(`${p2}master_track_processor ${proc.masterTrackProcessor}`);
      if (proc.reportFusedTracks != null) lines.push(`${p2}report_fused_tracks ${proc.reportFusedTracks}`);
      if (proc.reportCandidateTracks != null) lines.push(`${p2}report_candidate_tracks ${proc.reportCandidateTracks}`);
      if (proc.reportUnchangedTracks != null) lines.push(`${p2}report_unchanged_tracks ${proc.reportUnchangedTracks}`);
      if (proc.reportInterval) lines.push(`${p2}report_interval ${proc.reportInterval}`);
      if (proc.reportMethod) lines.push(`${p2}report_method "${proc.reportMethod}"`);
      if (proc.purgeInterval) lines.push(`${p2}purge_interval ${proc.purgeInterval}`);
      if (proc.dropAfterInactive) lines.push(`${p2}drop_after_inactive ${proc.dropAfterInactive}`);
      if (proc.trackManager) {
        lines.push(...trackManagerToConf(proc.trackManager, baseIndent + 1));
      }
      break;

    case 'WSF_MESSAGE_PROCESSOR':
      if (proc.queuingMethod) lines.push(`${p2}queuing_method ${proc.queuingMethod}`);
      if (proc.numberOfServers != null) lines.push(`${p2}number_of_servers ${proc.numberOfServers}`);
      if (proc.defaultRouting) {
        for (const r of proc.defaultRouting) lines.push(`${p2}default_routing "${r}"`);
      }
      break;

    case 'WSF_EXCHANGE_PROCESSOR':
      if (proc.services) {
        for (const [name, svc] of Object.entries(proc.services)) {
          lines.push(`${p2}service ${name}`);
          if (svc.quantity != null) lines.push(`${pad(baseIndent, 3)}quantity ${svc.quantity}`);
          if (svc.maximumQuantity != null) lines.push(`${pad(baseIndent, 3)}maximum_quantity ${svc.maximumQuantity}`);
          if (svc.rate != null) lines.push(`${pad(baseIndent, 3)}rate ${svc.rate}`);
          if (svc.serviceInterval) lines.push(`${pad(baseIndent, 3)}service_interval ${svc.serviceInterval}`);
          lines.push(`${p2}end_service`);
        }
      }
      if (proc.commodities) {
        for (const [name, com] of Object.entries(proc.commodities)) {
          lines.push(`${p2}commodity ${name}`);
          if (com.quantity != null) lines.push(`${pad(baseIndent, 3)}quantity ${com.quantity}`);
          if (com.maximumQuantity != null) lines.push(`${pad(baseIndent, 3)}maximum_quantity ${com.maximumQuantity}`);
          if (com.rate != null) lines.push(`${pad(baseIndent, 3)}rate ${com.rate}`);
          lines.push(`${p2}end_commodity`);
        }
      }
      break;

    case 'WSF_THREAT_PROCESSOR':
      if (proc.threatVelocity) lines.push(`${p2}threat_velocity ${proc.threatVelocity}`);
      if (proc.threatAngleSpread) lines.push(`${p2}threat_angle_spread ${proc.threatAngleSpread}`);
      if (proc.threatTimeToIntercept) lines.push(`${p2}threat_time_to_intercept ${proc.threatTimeToIntercept}`);
      if (proc.requireIffFoe != null) lines.push(`${p2}require_iff_foe ${proc.requireIffFoe}`);
      if (proc.ignoreLowerAltitudeThreats != null) lines.push(`${p2}ignore_lower_altitude_threats ${proc.ignoreLowerAltitudeThreats}`);
      if (proc.ignoreWithoutLocation != null) lines.push(`${p2}ignore_without_location ${proc.ignoreWithoutLocation}`);
      if (proc.ignoreWithoutVelocity != null) lines.push(`${p2}ignore_without_velocity ${proc.ignoreWithoutVelocity}`);
      break;

    case 'WSF_SA_PROCESSOR':
      lines.push(...saProcessorToConf(proc as any, baseIndent + 1));
      break;

    case 'WSF_GUIDANCE_COMPUTER': {
      const gc = proc as any;
      if (gc.proportionalNavigationGain) lines.push(`${p2}proportional_navigation_gain ${gc.proportionalNavigationGain}`);
      if (gc.velocityPursuitGain) lines.push(`${p2}velocity_pursuit_gain ${gc.velocityPursuitGain}`);
      if (gc.gBias) lines.push(`${p2}g_bias ${gc.gBias}`);
      if (gc.maxCommandedG) lines.push(`${p2}max_commanded_g ${gc.maxCommandedG}`);
      if (gc.maxTimeOfFlight) lines.push(`${p2}max_time_of_flight ${gc.maxTimeOfFlight}`);
      if (gc.coastTime) lines.push(`${p2}coast_time ${gc.coastTime}`);
      if (gc.aeroFile) lines.push(`${p2}aero_file ${gc.aeroFile}`);
      break;
    }

    case 'WSF_AIR_TARGET_FUSE': {
      const atf = proc as any;
      if (atf.maxTimeOfFlight) lines.push(`${p2}max_time_of_flight ${atf.maxTimeOfFlight}`);
      break;
    }

    case 'WSF_INTERSECT_PROCESSOR':
      if ((proc as any).intersectMesh) lines.push(`${p2}intersect_mesh "${(proc as any).intersectMesh}"`);
      break;
  }

  lines.push(`${p1}end_processor`);
  return lines;
}

// ============================================================
// Advanced Behavior Tree serialization
// Mirrors the recursive structure parsed by confParser.parseAdvancedBehaviorTree
// ============================================================

const COMPOSITE_NODE_KINDS = new Set([
  'sequence',
  'sequence_with_memory',
  'selector',
  'selector_with_memory',
  'parallel',
  'priority_selector',
  'weighted_random',
]);

function behaviorTreeToConf(tree: AdvancedBehaviorTreeConfig, baseIndent: number, level: number): string[] {
  const lines: string[] = [];
  const p = pad(baseIndent, level);

  if (tree.name) lines.push(`${p}name ${tree.name}`);
  if (tree.description) lines.push(`${p}desc "${tree.description}"`);
  if (tree.btt !== undefined) lines.push(`${p}btt ${tree.btt}`);
  if (tree.rootNodeType) lines.push(`${p}root_node_type ${tree.rootNodeType}`);
  if (tree.successPolicy) lines.push(`${p}success_policy ${tree.successPolicy}`);

  for (const node of tree.nodes) {
    lines.push(...behaviorNodeToConf(node, baseIndent, level));
  }
  return lines;
}

function behaviorNodeToConf(node: BehaviorTreeNode, baseIndent: number, level: number): string[] {
  const lines: string[] = [];
  const p = pad(baseIndent, level);
  const pInner = pad(baseIndent, level + 1);
  const children = node.children ?? [];

  if (node.kind === 'behavior_node') {
    lines.push(node.name ? `${p}behavior_node ${node.name}` : `${p}behavior_node`);
    return lines;
  }

  if (COMPOSITE_NODE_KINDS.has(node.kind)) {
    lines.push(`${p}${node.kind}`);
    if (node.name) lines.push(`${pInner}name ${node.name}`);
    for (const child of children) lines.push(...behaviorNodeToConf(child, baseIndent, level + 1));
    lines.push(`${p}end_${node.kind}`);
    return lines;
  }

  if (node.kind === 'advanced_behavior_tree') {
    lines.push(`${p}advanced_behavior_tree`);
    if (node.name) lines.push(`${pInner}name ${node.name}`);
    if (node.description) lines.push(`${pInner}desc "${node.description}"`);
    if (node.btt !== undefined) lines.push(`${pInner}btt ${node.btt}`);
    if (node.rootNodeType) lines.push(`${pInner}root_node_type ${node.rootNodeType}`);
    if (node.successPolicy) lines.push(`${pInner}success_policy ${node.successPolicy}`);
    for (const child of children) lines.push(...behaviorNodeToConf(child, baseIndent, level + 1));
    lines.push(`${p}end_advanced_behavior_tree`);
    return lines;
  }

  // decorator_inverter | decorator_negator | decorator_succeeder | decorator_repeater
  const subtype = node.kind.slice('decorator_'.length);
  let header = `${p}decorator ${subtype}`;
  if (subtype === 'repeater' && node.repeaterMode) {
    header += ` ${node.repeaterMode}`;
    if (node.repeaterValue) header += ` ${node.repeaterValue}`;
  }
  lines.push(header);
  for (const child of children) lines.push(...behaviorNodeToConf(child, baseIndent, level + 1));
  lines.push(`${p}end_decorator`);
  return lines;
}

function trackManagerToConf(tm: TrackManagerConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  lines.push(`${p}track_manager`);
  if (tm.framed != null) lines.push(`${pad(indent, 2)}framed ${tm.framed}`);
  if (tm.correlationMethod) lines.push(`${pad(indent, 2)}correlation_method ${tm.correlationMethod}`);
  if (tm.correlationParams) {
    const cp = tm.correlationParams;
    if (cp.trackingSigma != null) lines.push(`${pad(indent, 2)}tracking_sigma ${cp.trackingSigma}`);
    if (cp.turningSigma != null) lines.push(`${pad(indent, 2)}turning_sigma ${cp.turningSigma}`);
    if (cp.coastTime) lines.push(`${pad(indent, 2)}coast_time ${cp.coastTime}`);
    if (cp.preciseMode != null) lines.push(`${pad(indent, 2)}precise_mode ${cp.preciseMode}`);
    if (cp.maximumCorrelationDistance) lines.push(`${pad(indent, 2)}maximum_correlation_distance ${cp.maximumCorrelationDistance}`);
  }
  if (tm.fusionMethod) lines.push(`${pad(indent, 2)}fusion_method ${tm.fusionMethod}`);
  if (tm.trackerType) lines.push(`${pad(indent, 2)}tracker_type "${tm.trackerType}"`);
  if (tm.dropUncorrelatedTracks != null) lines.push(`${pad(indent, 2)}drop_uncorrelated_tracks ${tm.dropUncorrelatedTracks}`);
  if (tm.retainRawTracks != null) lines.push(`${pad(indent, 2)}retain_raw_tracks ${tm.retainRawTracks}`);
  lines.push(`${p}end_track_manager`);

  return lines;
}

function saProcessorToConf(proc: any, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  const timeFields = [
    'reportInterval', 'engagementDataUpdateInterval', 'flightDataUpdateInterval',
    'fuelDataUpdateInterval', 'navDataUpdateInterval', 'weaponsDataUpdateInterval',
    'trackDataUpdateInterval', 'assetDataUpdateInterval', 'assetPurgeLifetime',
    'cognitiveUpdateInterval', 'platformUpdateInterval', 'universalUpdateInterval',
  ];

  for (const field of timeFields) {
    if (proc[field]) {
      const key = field.replace(/([A-Z])/g, '_$1').toLowerCase();
      lines.push(`${p}${key} ${proc[field]}`);
    }
  }

  if (proc.enemySide) lines.push(`${p}enemy_side "${proc.enemySide}"`);
  if (proc.friendlySide) lines.push(`${p}friendly_side "${proc.friendlySide}"`);
  if (proc.neutralSide) lines.push(`${p}neutral_side "${proc.neutralSide}"`);
  if (proc.missileSpeedAnyAlt) lines.push(`${p}missile_speed_any_alt ${proc.missileSpeedAnyAlt}`);
  if (proc.missileDistance) lines.push(`${p}missile_distance ${proc.missileDistance}`);
  if (proc.maxRangeForPerceivedAssets) lines.push(`${p}max_range_for_perceived_assets ${proc.maxRangeForPerceivedAssets}`);
  if (proc.maxRangeForPerceivedBogiesAndBandits) lines.push(`${p}max_range_for_perceived_bogies_and_bandits ${proc.maxRangeForPerceivedBogiesAndBandits}`);
  if (proc.filterRequiresAirDomain != null) lines.push(`${p}filter_requires_air_domain ${proc.filterRequiresAirDomain}`);
  if (proc.filterRequiresNotAirDomain != null) lines.push(`${p}filter_requires_not_air_domain ${proc.filterRequiresNotAirDomain}`);
  if (proc.flightId != null) lines.push(`${p}flight_id ${proc.flightId}`);
  if (proc.idFlag) lines.push(`${p}id_flag "${proc.idFlag}"`);
  if (proc.bingoFuel) lines.push(`${p}bingo_fuel ${proc.bingoFuel}`);
  if (proc.jokerFuel) lines.push(`${p}joker_fuel ${proc.jokerFuel}`);

  // Perceive sub-config
  if (proc.perceive) {
    lines.push(`${p}sa_perceive`);
    const pp = proc.perceive;
    const pp2 = pad(indent, 2);
    if (pp.reportingSelf != null) lines.push(`${pp2}reporting_self ${pp.reportingSelf}`);
    if (pp.reportsSelf != null) lines.push(`${pp2}reports_self ${pp.reportsSelf}`);
    if (pp.reportingOthers != null) lines.push(`${pp2}reporting_others ${pp.reportingOthers}`);
    if (pp.reportsOthers != null) lines.push(`${pp2}reports_others ${pp.reportsOthers}`);
    if (pp.perceiveSelf != null) lines.push(`${pp2}perceive_self ${pp.perceiveSelf}`);
    if (pp.maxThreatLoad != null) lines.push(`${pp2}max_threat_load ${pp.maxThreatLoad}`);
    if (pp.maxAssetLoad != null) lines.push(`${pp2}max_asset_load ${pp.maxAssetLoad}`);
    if (pp.assetCoastTime) lines.push(`${pp2}asset_coast_time ${pp.assetCoastTime}`);
    if (pp.banditCoastTime) lines.push(`${pp2}bandit_coast_time ${pp.banditCoastTime}`);
    if (pp.useSimpleCountermeasures != null) lines.push(`${pp2}use_simple_countermeasures ${pp.useSimpleCountermeasures}`);
    if (pp.numChaff != null) lines.push(`${pp2}num_chaff ${pp.numChaff}`);
    if (pp.numFlares != null) lines.push(`${pp2}num_flares ${pp.numFlares}`);
    if (pp.numDecoys != null) lines.push(`${pp2}num_decoys ${pp.numDecoys}`);
    lines.push(`${p}end_sa_perceive`);
  }

  // Assess sub-config
  if (proc.assess) {
    lines.push(`${p}sa_assess`);
    const ap = proc.assess;
    const ap2 = pad(indent, 2);
    if (ap.bogieThreatScoreMultiplier != null) lines.push(`${ap2}bogie_threat_score_multiplier ${ap.bogieThreatScoreMultiplier}`);
    if (ap.bogieTargetScoreMultiplier != null) lines.push(`${ap2}bogie_target_score_multiplier ${ap.bogieTargetScoreMultiplier}`);
    if (ap.missionTask) lines.push(`${ap2}mission_task "${ap.missionTask}"`);
    if (ap.maxPrioritizedThreats != null) lines.push(`${ap2}max_prioritized_threats ${ap.maxPrioritizedThreats}`);
    if (ap.maxPrioritizedTargets != null) lines.push(`${ap2}max_prioritized_targets ${ap.maxPrioritizedTargets}`);
    if (ap.maxGroupingDistanceCentroid) lines.push(`${ap2}max_grouping_distance_centroid ${ap.maxGroupingDistanceCentroid}`);
    if (ap.maxGroupingDistanceNeighbor) lines.push(`${ap2}max_grouping_distance_neighbor ${ap.maxGroupingDistanceNeighbor}`);
    if (ap.maxGroupingSpeedDifference) lines.push(`${ap2}max_grouping_speed_difference ${ap.maxGroupingSpeedDifference}`);
    if (ap.maxGroupingHeadingDifference) lines.push(`${ap2}max_grouping_heading_difference ${ap.maxGroupingHeadingDifference}`);
    if (ap.useCentroidGrouping != null) lines.push(`${ap2}use_centroid_grouping ${ap.useCentroidGrouping}`);
    if (ap.useNeighborGrouping != null) lines.push(`${ap2}use_neighbor_grouping ${ap.useNeighborGrouping}`);
    if (ap.useSpeedGrouping != null) lines.push(`${ap2}use_speed_grouping ${ap.useSpeedGrouping}`);
    if (ap.useHeadingGrouping != null) lines.push(`${ap2}use_heading_grouping ${ap.useHeadingGrouping}`);
    if (ap.useTypeGrouping != null) lines.push(`${ap2}use_type_grouping ${ap.useTypeGrouping}`);
    if (ap.missileWezParameters) {
      for (const wez of ap.missileWezParameters) {
        lines.push(`${ap2}missile_wez`);
        if (wez.side) lines.push(`${pad(indent, 3)}side ${wez.side}`);
        if (wez.type) lines.push(`${pad(indent, 3)}type ${wez.type}`);
        if (wez.avgSpeed) lines.push(`${pad(indent, 3)}avg_speed ${wez.avgSpeed}`);
        if (wez.maxTimeOfFlight) lines.push(`${pad(indent, 3)}max_time_of_flight ${wez.maxTimeOfFlight}`);
        if (wez.maxOffBoresightAngle) lines.push(`${pad(indent, 3)}max_off_boresight_angle ${wez.maxOffBoresightAngle}`);
        if (wez.nominalPk != null) lines.push(`${pad(indent, 3)}nominal_pk ${wez.nominalPk}`);
        lines.push(`${ap2}end_missile_wez`);
      }
    }
    lines.push(`${p}end_sa_assess`);
  }

  return lines;
}

// ============================================================
// Fuel serialization
// ============================================================

function fuelToConf(fuel: AfsimFuelConfig, baseIndent: number): string[] {
  const lines: string[] = [];
  const p1 = pad(baseIndent, 1);
  const p2 = pad(baseIndent, 2);

  // fuel NAME TYPE
  lines.push(`${p1}fuel ${fuel.name} ${fuel.type}`);

  // Base PlatformPart fields
  lines.push(...platformPartToConf(fuel, baseIndent + 1));

  // Fuel base fields
  if (fuel.maximumQuantity) lines.push(`${p2}maximum_quantity ${fuel.maximumQuantity}`);
  if (fuel.initialQuantity) lines.push(`${p2}initial_quantity ${fuel.initialQuantity}`);
  if (fuel.reserveQuantity) lines.push(`${p2}reserve_quantity ${fuel.reserveQuantity}`);
  if (fuel.reserveFuel) lines.push(`${p2}reserve_fuel ${fuel.reserveFuel}`);
  if (fuel.bingoQuantity) lines.push(`${p2}bingo_quantity ${fuel.bingoQuantity}`);
  if (fuel.consumptionRate) lines.push(`${p2}consumption_rate ${fuel.consumptionRate}`);
  if (fuel.mode) lines.push(`${p2}mode "${fuel.mode}"`);

  // Variable rate fuel
  if (fuel.type === 'WSF_VARIABLE_RATE_FUEL') {
    const vrf = fuel as any;
    if (vrf.rate) lines.push(`${p2}rate ${vrf.rate}`);
    if (vrf.rates) {
      for (const r of vrf.rates) {
        const parts = [r.rate];
        if (r.altitude) parts.unshift(r.altitude);
        if (r.speed) parts.push(r.speed);
        lines.push(`${p2}rate ${parts.join(' ')}`);
      }
    }
    if (vrf.tableForMode) lines.push(`${p2}table_for_mode "${vrf.tableForMode}"`);
  }

  // Tabular rate fuel
  if (fuel.type === 'WSF_TABULAR_RATE_FUEL' || fuel.type === 'WSF_TANKED_FUEL') {
    const trf = fuel as any;
    if (trf.fuelTable) {
      for (const entry of trf.fuelTable) {
        lines.push(`${p2}fuel_table`);
        if (entry.mode) lines.push(`${pad(baseIndent, 3)}mode "${entry.mode}"`);
        if (entry.speeds) lines.push(`${pad(baseIndent, 3)}speeds ${entry.speeds.join(' ')}`);
        if (entry.altitudes) lines.push(`${pad(baseIndent, 3)}altitudes ${entry.altitudes.join(' ')}`);
        if (entry.masses) lines.push(`${pad(baseIndent, 3)}masses ${entry.masses.join(' ')}`);
        if (entry.rates) lines.push(`${pad(baseIndent, 3)}rates ${entry.rates.join(' ')}`);
        lines.push(`${p2}end_fuel_table`);
      }
    }
  }

  // Tanked fuel specific
  if (fuel.type === 'WSF_TANKED_FUEL') {
    const tf = fuel as any;
    if (tf.maximumRefuelQuantity) lines.push(`${p2}maximum_refuel_quantity ${tf.maximumRefuelQuantity}`);
    if (tf.desiredTopOffQuantity) lines.push(`${p2}desired_top_off_quantity ${tf.desiredTopOffQuantity}`);
    if (tf.receiveMethod) lines.push(`${p2}receive_method ${tf.receiveMethod}`);
    if (tf.maximumReceiveRate) lines.push(`${p2}maximum_receive_rate ${tf.maximumReceiveRate}`);
    if (tf.supplyMethodPreference) lines.push(`${p2}supply_method_preference ${tf.supplyMethodPreference}`);
    if (tf.supplyLocationPreference) lines.push(`${p2}supply_location_preference ${tf.supplyLocationPreference}`);
  }

  lines.push(`${p1}end_fuel`);
  return lines;
}

// ============================================================
// Shared sub-serialization helpers
// ============================================================

function platformPartToConf(part: PlatformPartBase, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (!part.on) lines.push(`${p}off`);
  if (!part.operational) lines.push(`${p}operational false`);
  if (!part.restorable) lines.push(`${p}restorable false`);
  if (part.debug) lines.push(`${p}debug`);
  if (part.automaticRecoveryTime && part.automaticRecoveryTime !== '0.0 sec') {
    lines.push(`${p}automatic_recovery_time ${part.automaticRecoveryTime}`);
  }
  if (part.damageFactor != null && part.damageFactor !== 1) {
    lines.push(`${p}damage_factor ${part.damageFactor}`);
  }
  if (part.critical) lines.push(`${p}critical`);
  if (part.categories && part.categories.length > 0) {
    lines.push(`${p}categories ${part.categories.join(' ')}`);
  }

  return lines;
}

function articulatedPartToConf(part: ArticulatedPartBase, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  // PlatformPart base
  lines.push(...platformPartToConf(part, indent));

  // Location
  const [locX, locY, locZ] = part.location ?? [0, 0, 0];
  if (locX !== 0 || locY !== 0 || locZ !== 0) {
    lines.push(`${p}location ${locX} ${locY} ${locZ}`);
  }

  // Orientation
  if (part.yaw && part.yaw !== '0 deg') lines.push(`${p}yaw ${part.yaw}`);
  if (part.pitch && part.pitch !== '0 deg') lines.push(`${p}pitch ${part.pitch}`);
  if (part.roll && part.roll !== '0 deg') lines.push(`${p}roll ${part.roll}`);
  if (part.tilt && part.tilt !== '0 deg') lines.push(`${p}tilt ${part.tilt}`);

  // Slew rates
  if (part.azimuthSlewRate) lines.push(`${p}azimuth_slew_rate ${part.azimuthSlewRate}`);
  if (part.elevationSlewRate) lines.push(`${p}elevation_slew_rate ${part.elevationSlewRate}`);

  // Azimuth/elevation limits
  if (part.azimuthMin && part.azimuthMin !== '-180 deg') lines.push(`${p}azimuth_min ${part.azimuthMin}`);
  if (part.azimuthMax && part.azimuthMax !== '180 deg') lines.push(`${p}azimuth_max ${part.azimuthMax}`);
  if (part.elevationMin && part.elevationMin !== '-90 deg') lines.push(`${p}elevation_min ${part.elevationMin}`);
  if (part.elevationMax && part.elevationMax !== '90 deg') lines.push(`${p}elevation_max ${part.elevationMax}`);

  if (part.slewMode && part.slewMode !== 'both') lines.push(`${p}slew_mode ${part.slewMode}`);

  return lines;
}

function sensorModeToConf(mode: any, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  // Cueing
  if (mode.azimuthCueRate) lines.push(`${p}azimuth_cue_rate ${mode.azimuthCueRate}`);
  if (mode.elevationCueRate) lines.push(`${p}elevation_cue_rate ${mode.elevationCueRate}`);
  if (mode.azimuthCueMin) lines.push(`${p}azimuth_cue_min ${mode.azimuthCueMin}`);
  if (mode.azimuthCueMax) lines.push(`${p}azimuth_cue_max ${mode.azimuthCueMax}`);
  if (mode.elevationCueMin) lines.push(`${p}elevation_cue_min ${mode.elevationCueMin}`);
  if (mode.elevationCueMax) lines.push(`${p}elevation_cue_max ${mode.elevationCueMax}`);
  if (mode.cueMode) lines.push(`${p}cue_mode ${mode.cueMode}`);
  if (mode.maximumRequestCount != null) lines.push(`${p}maximum_request_count ${mode.maximumRequestCount}`);

  // Timing
  if (mode.frameTime) lines.push(`${p}frame_time ${mode.frameTime}`);
  if (mode.revisitTime) lines.push(`${p}revisit_time ${mode.revisitTime}`);
  if (mode.dwellTime) lines.push(`${p}dwell_time ${mode.dwellTime}`);

  // Detection
  if (mode.requiredPD != null) lines.push(`${p}required_pd ${mode.requiredPD}`);
  if (mode.trackQuality != null) lines.push(`${p}track_quality ${mode.trackQuality}`);

  // Search/Track
  if (mode.searchWhileTrack != null) lines.push(`${p}search_while_track ${mode.searchWhileTrack}`);
  if (mode.disablesSearch != null) lines.push(`${p}disables_search ${mode.disablesSearch}`);
  if (mode.moonLOS_Block != null) lines.push(`${p}moon_los_block ${mode.moonLOS_Block}`);

  // Measurement errors
  if (mode.azimuthErrorSigma) lines.push(`${p}azimuth_error_sigma ${mode.azimuthErrorSigma}`);
  if (mode.elevationErrorSigma) lines.push(`${p}elevation_error_sigma ${mode.elevationErrorSigma}`);
  if (mode.rangeErrorSigma) lines.push(`${p}range_error_sigma ${mode.rangeErrorSigma}`);
  if (mode.rangeRateErrorSigma) lines.push(`${p}range_rate_error_sigma ${mode.rangeRateErrorSigma}`);

  // Track establishment
  if (mode.establishTrackProbability != null) lines.push(`${p}establish_track_probability ${mode.establishTrackProbability}`);
  if (mode.maintainTrackProbability != null) lines.push(`${p}maintain_track_probability ${mode.maintainTrackProbability}`);
  if (mode.hitsToEstablishTrack != null) lines.push(`${p}hits_to_establish_track ${mode.hitsToEstablishTrack}`);
  if (mode.hitsToMaintainTrack != null) lines.push(`${p}hits_to_maintain_track ${mode.hitsToMaintainTrack}`);

  // Exclusion
  if (mode.solarExclusionAngle) lines.push(`${p}solar_exclusion_angle ${mode.solarExclusionAngle}`);
  if (mode.lunarExclusionAngle) lines.push(`${p}lunar_exclusion_angle ${mode.lunarExclusionAngle}`);

  // Reporting
  if (mode.reportsLocation != null) lines.push(`${p}reports_location`);
  if (mode.reportsVelocity != null) lines.push(`${p}reports_velocity`);
  if (mode.reportsRange != null) lines.push(`${p}reports_range`);
  if (mode.reportsBearing != null) lines.push(`${p}reports_bearing`);
  if (mode.reportsElevation != null) lines.push(`${p}reports_elevation`);
  if (mode.reportsRangeRate != null) lines.push(`${p}reports_range_rate`);
  if (mode.reportsSide != null) lines.push(`${p}reports_side`);
  if (mode.reportsType != null) lines.push(`${p}reports_type`);
  if (mode.reportsIFF != null) lines.push(`${p}reports_iff`);
  if (mode.reportsSignalToNoise != null) lines.push(`${p}reports_signal_to_noise`);
  if (mode.reportsFrequency != null) lines.push(`${p}reports_frequency`);

  return lines;
}

function transmitterToConf(tx: TransmitterConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  lines.push(`${p}transmitter`);
  lines.push(...antennaToConf(tx, indent + 1));
  if (tx.bandwidth) lines.push(`${pad(indent, 2)}bandwidth ${tx.bandwidth}`);
  if (tx.frequency) lines.push(`${pad(indent, 2)}frequency ${tx.frequency}`);
  if (tx.power) lines.push(`${pad(indent, 2)}power ${tx.power}`);
  if (tx.internalLoss) lines.push(`${pad(indent, 2)}internal_loss ${tx.internalLoss}`);
  if (tx.polarization) lines.push(`${pad(indent, 2)}polarization ${tx.polarization}`);
  if (tx.pulseCompressionRatio) lines.push(`${pad(indent, 2)}pulse_compression_ratio ${tx.pulseCompressionRatio}`);
  if (tx.pulseRepetitionFrequency) lines.push(`${pad(indent, 2)}pulse_repetition_frequency ${tx.pulseRepetitionFrequency}`);
  if (tx.pulseRepetitionInterval) lines.push(`${pad(indent, 2)}pulse_repetition_interval ${tx.pulseRepetitionInterval}`);
  if (tx.pulseWidth) lines.push(`${pad(indent, 2)}pulse_width ${tx.pulseWidth}`);
  if (tx.dutyCycle != null) lines.push(`${pad(indent, 2)}duty_cycle ${tx.dutyCycle}`);
  if (tx.wavelength) lines.push(`${pad(indent, 2)}wavelength ${tx.wavelength}`);
  lines.push(`${p}end_transmitter`);

  return lines;
}

function receiverToConf(rx: ReceiverConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  lines.push(`${p}receiver`);
  lines.push(...antennaToConf(rx, indent + 1));
  if (rx.bandwidth) lines.push(`${pad(indent, 2)}bandwidth ${rx.bandwidth}`);
  if (rx.frequency) lines.push(`${pad(indent, 2)}frequency ${rx.frequency}`);
  if (rx.internalLoss) lines.push(`${pad(indent, 2)}internal_loss ${rx.internalLoss}`);
  if (rx.noisePower) lines.push(`${pad(indent, 2)}noise_power ${rx.noisePower}`);
  if (rx.noiseFigure) lines.push(`${pad(indent, 2)}noise_figure ${rx.noiseFigure}`);
  if (rx.polarization) lines.push(`${pad(indent, 2)}polarization ${rx.polarization}`);
  if (rx.detectionThreshold) lines.push(`${pad(indent, 2)}detection_threshold ${rx.detectionThreshold}`);
  if (rx.instantaneousBandwidth) lines.push(`${pad(indent, 2)}instantaneous_bandwidth ${rx.instantaneousBandwidth}`);
  if (rx.wavelength) lines.push(`${pad(indent, 2)}wavelength ${rx.wavelength}`);
  lines.push(`${p}end_receiver`);

  return lines;
}

function antennaToConf(ant: AntennaConfig, indent: number): string[] {
  const lines: string[] = [];
  const p = pad(indent, 1);

  if (ant.antennaPattern) lines.push(`${p}antenna_pattern "${ant.antennaPattern}"`);
  if (ant.beamTilt) lines.push(`${p}beam_tilt ${ant.beamTilt}`);
  if (ant.checkTerrainMasking != null) lines.push(`${p}check_terrain_masking ${ant.checkTerrainMasking}`);

  return lines;
}

// ============================================================
// Formatting helpers
// ============================================================

function pad(baseIndent: number, level: number): string {
  return ' '.repeat(baseIndent * level);
}
