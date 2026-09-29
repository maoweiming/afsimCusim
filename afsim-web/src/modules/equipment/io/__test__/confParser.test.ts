import { describe, it, expect } from 'vitest';
import { parseAfsimConf, parseRawBlocks } from '../confParser';

// Real AFSIM syntax samples
const SIMPLE_PLATFORM = `
platform_type BLUE_STRIKER BLUE_ADV_FIGHTER_1_BASE
   side blue
   category fighter
   icon F-22

   mover WSF_AIR_MOVER
      maximum_speed 1095.3 knots
      maximum_altitude 50000 ft
      minimum_altitude 50 ft
      maximum_linear_acceleration 9 g
      at_end_of_path extrapolate
   end_mover

   fuel WSF_VARIABLE_RATE_FUEL
      rate 7.0 lb/s
      initial_quantity 14000 lb
      maximum_quantity 14000 lb
   end_fuel

   sensor blue_a2a_radar BLUE_A2A_RADAR
      on
      internal_link track_manager
      ignore_same_side
   end_sensor

   processor track_manager WSF_TRACK_PROCESSOR
      purge_interval 60 sec
      update_interval 1 sec
   end_processor

   weapon int_missile SIMPLE_A2A_MISSILE_WEAPON end_weapon

end_platform_type
`;

const PLATFORM_WITH_MODES = `
platform_type DCA BRAWLER_TEST
   icon f15c
   side blue

   radar_signature 10dB_FuzzBall

   mover WSF_BRAWLER_MOVER
      aero_file platforms/fxw/dca.fxw
      update_time_tolerance 1.0 sec
   end_mover

   sensor rdr1 AESA
      on
   end_sensor

   sensor rwr GENERIC_ESM
      on
   end_sensor

   weapon fox3 MEDIUM_RANGE_RADAR_MISSILE
      quantity 4
   end_weapon

   weapon fox2 SHORT_RANGE_IR_MISSILE
      quantity 2
   end_weapon

   processor radar_track_cueing WSF_SENSOR_CUE_PROCESSOR
      update_interval 1 sec
   end_processor

end_platform_type
`;

const SENSOR_DEFINITION = `
sensor BLUE_A2A_RADAR WSF_RADAR_SENSOR
   slew_mode azimuth

   mode_template
      transmitter
         frequency 9.6 ghz
         power 2.0 mw
         antenna_pattern BLUE_A2A_RADAR_ANTENNA_PATTERN
      end_transmitter

      range_product 201.8 db
      frame_time 1 sec
      reports_location
      reports_velocity
   end_mode_template

   mode 120X10
      azimuth_field_of_view 120 deg
      elevation_field_of_view 10 deg
      range_product 195.0 db
   end_mode

   mode 40X20
      azimuth_field_of_view 40 deg
      elevation_field_of_view 20 deg
   end_mode

   filter WSF_ALPHA_BETA_FILTER
      alpha 0.4
      beta 0.1
   end_filter

end_sensor
`;

const WEAPON_DEFINITION = `
weapon MEDIUM_RANGE_RADAR_MISSILE WSF_EXPLICIT_WEAPON
   launched_platform_type MEDIUM_RANGE_RADAR_MISSILE
   weapon_effects SIMPLE_EFFECT
   launch_computer MRM_LC end_launch_computer
   firing_delay 0.5 sec
   firing_interval 1 sec
   salvo_interval 5.0 sec
   quantity 4
end_weapon
`;

const MISSILE_PLATFORM = `
platform_type MEDIUM_RANGE_RADAR_MISSILE WSF_PLATFORM
   category missile

   mover WSF_GUIDED_MOVER
      mass 150.0 kg
      fuel 50.0 kg
      specific_impulse 250.0 s
      thrust 5000.0 n
      thrust_duration 10.0 s
   end_mover

   processor mrm_autopilot WSF_GUIDANCE_COMPUTER
      update_interval 0.1 sec
      proportional_navigation_gain 4.0
      velocity_pursuit_gain 1.5
      max_commanded_g 30.0 g
   end_processor

   processor fuse WSF_AIR_TARGET_FUSE
      max_time_of_flight 120.0 s
   end_processor

   sensor seeker RADAR_SEEKER
      on
   end_sensor

end_platform_type
`;

describe('confParser - real AFSIM syntax', () => {
  it('parses simple platform_type with subsystems', () => {
    const result = parseAfsimConf(SIMPLE_PLATFORM);
    expect(result.errors).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);

    const eq = result.equipment[0];
    expect(eq.name).toBe('BLUE_STRIKER');
    expect(eq.parentType).toBe('BLUE_ADV_FIGHTER_1_BASE');
    expect(eq.platform.side).toBe('blue');
    expect(eq.platform.categories).toContain('fighter');
    expect(eq.platform.icon).toBe('F-22');
    expect(Object.keys(eq.platform.movers)).toHaveLength(1);
    expect(Object.keys(eq.platform.sensors)).toHaveLength(1);
    expect(Object.keys(eq.platform.weapons)).toHaveLength(1);
    expect(Object.keys(eq.platform.processors)).toHaveLength(1);
    expect(Object.keys(eq.platform.fuels)).toHaveLength(1);
  });

  it('parses mover properties with AFSIM units', () => {
    const result = parseAfsimConf(SIMPLE_PLATFORM);
    const mover = Object.values(result.equipment[0].platform.movers)[0] as any;
    expect(mover.type).toBe('WSF_AIR_MOVER');
    expect(mover.maximumSpeed).toBe('1095.3 knots');
    expect(mover.maximumAltitude).toBe('50000 ft');
    expect(mover.maximumLinearAcceleration).toBe('9 g');
    expect(mover.atEndOfPath).toBe('extrapolate');
  });

  it('parses sensor reference with instance properties', () => {
    const result = parseAfsimConf(SIMPLE_PLATFORM);
    const sensor = result.equipment[0].platform.sensors['blue_a2a_radar'] as any;
    expect(sensor).toBeDefined();
    expect(sensor.type).toBe('WSF_RADAR_SENSOR');
    expect(sensor.on).toBe(true);
    expect(sensor.internalLink).toBe('track_manager');
    expect(sensor.ignoreSameSide).toBe(true);
  });

  it('parses weapon reference with quantity', () => {
    const result = parseAfsimConf(SIMPLE_PLATFORM);
    const weapon = result.equipment[0].platform.weapons['int_missile'] as any;
    expect(weapon).toBeDefined();
    expect(weapon.type).toBe('WSF_IMPLICIT_WEAPON');
  });

  it('parses platform with multiple weapons and sensors', () => {
    const result = parseAfsimConf(PLATFORM_WITH_MODES);
    expect(result.errors).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);

    const eq = result.equipment[0];
    expect(eq.name).toBe('DCA');
    expect(eq.parentType).toBe('BRAWLER_TEST');
    expect(Object.keys(eq.platform.sensors)).toHaveLength(2);
    expect(Object.keys(eq.platform.weapons)).toHaveLength(2);
    expect(eq.platform.radarSignature).toBe('10dB_FuzzBall');

    const fox3 = eq.platform.weapons['fox3'] as any;
    expect(fox3.quantity).toBe('4');
  });

  it('parses standalone sensor definition with modes', () => {
    const result = parseAfsimConf(SENSOR_DEFINITION);
    expect(result.errors).toHaveLength(0);
    // Standalone sensor doesn't produce equipment, but should parse without errors
    // The block parser should handle it as a top-level block
    expect(result.equipment).toHaveLength(0);
  });

  it('parses standalone weapon definition', () => {
    const result = parseAfsimConf(WEAPON_DEFINITION);
    expect(result.errors).toHaveLength(0);
    expect(result.equipment).toHaveLength(0);
  });

  it('parses missile platform with guidance computer', () => {
    const result = parseAfsimConf(MISSILE_PLATFORM);
    expect(result.errors).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);

    const eq = result.equipment[0];
    expect(eq.name).toBe('MEDIUM_RANGE_RADAR_MISSILE');
    expect(eq.platform.categories).toContain('missile');
    expect(Object.keys(eq.platform.movers)).toHaveLength(1);

    const mover = Object.values(eq.platform.movers)[0] as any;
    expect(mover.type).toBe('WSF_GUIDED_MOVER');
    expect(mover.mass).toBe('150.0 kg');
    expect(mover.thrust).toBe('5000.0 n');
  });
});

// afsimToEquipment adapter was removed in the AFSIM-native architecture refactor.
// AfsimEquipment is now the sole data model; no conversion to flat Equipment needed.

describe('parseRawBlocks', () => {
  it('returns raw blocks for mixed content', () => {
    const text = `
sensor MY_RADAR WSF_RADAR_SENSOR
   on
end_sensor

platform_type FIGHTER WSF_PLATFORM
   sensor rdr MY_RADAR
      on
   end_sensor
end_platform_type
`;
    const { blocks, errors } = parseRawBlocks(text);
    expect(errors).toHaveLength(0);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].keyword).toBe('sensor');
    expect(blocks[0].name).toBe('MY_RADAR');
    expect(blocks[1].keyword).toBe('platform_type');
    expect(blocks[1].name).toBe('FIGHTER');
    expect(blocks[1].children).toHaveLength(1);
    expect(blocks[1].children[0].keyword).toBe('sensor');
    expect(blocks[1].children[0].name).toBe('rdr');
    expect(blocks[1].children[0].typeName).toBe('MY_RADAR');
  });
});
