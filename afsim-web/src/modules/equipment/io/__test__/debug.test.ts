import { describe, it, expect } from 'vitest';
import { parseAfsimConf } from '../confParser';

describe('debug', () => {
  it('weapon with launch_computer inline', () => {
    const text = `
weapon MEDIUM_RANGE_RADAR_MISSILE WSF_EXPLICIT_WEAPON
   launched_platform_type MEDIUM_RANGE_RADAR_MISSILE
   weapon_effects SIMPLE_EFFECT
   launch_computer MRM_LC end_launch_computer
   firing_delay 0.5 sec
   quantity 4
end_weapon
`;
    const result = parseAfsimConf(text);
    expect(result.errors).toEqual([]);
    expect(result.equipment).toHaveLength(0);
  });

  it('platform with radar_signature ref', () => {
    const text = `
platform_type DCA BRAWLER_TEST
   icon f15c
   side blue
   radar_signature 10dB_FuzzBall
   mover WSF_BRAWLER_MOVER
      aero_file platforms/fxw/dca.fxw
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
end_platform_type
`;
    const result = parseAfsimConf(text);
    expect(result.errors).toEqual([]);
    expect(result.equipment).toHaveLength(1);
  });

  it('missile platform', () => {
    const text = `
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
    const result = parseAfsimConf(text);
    expect(result.errors).toEqual([]);
    expect(result.equipment).toHaveLength(1);
  });

  it('sensor with modes', () => {
    const text = `
sensor BLUE_A2A_RADAR WSF_RADAR_SENSOR
   slew_mode azimuth
   mode_template
      transmitter
         frequency 9.6 ghz
         power 2.0 mw
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
    const result = parseAfsimConf(text);
    expect(result.errors).toEqual([]);
    expect(result.equipment).toHaveLength(0);
  });
});
