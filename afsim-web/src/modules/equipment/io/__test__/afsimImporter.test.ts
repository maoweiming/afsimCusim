import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  importAfsimText,
  importAfsimFiles,
  createMapFileProvider,
} from '../afsimImporter';

// ============================================================
// Single-file import tests
// ============================================================

describe('importAfsimText', () => {
  it('should parse a simple platform_type', () => {
    const text = `
platform_type SIMPLE_FIGHTER WSF_PLATFORM
   side blue
   category fighter
   icon F-16
end_platform_type
`;
    const result = importAfsimText(text);
    expect(result.errors).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0].name).toBe('SIMPLE_FIGHTER');
    expect(result.equipment[0].parentType).toBe('WSF_PLATFORM');
    expect(result.equipment[0].platform.side).toBe('blue');
    expect(result.equipment[0].platform.icon).toBe('F-16');
    expect(result.equipment[0].platform.categories).toContain('fighter');
  });

  it('should parse a platform with mover and fuel', () => {
    const text = `
platform_type FAST_JET WSF_PLATFORM
   side blue

   mover WSF_AIR_MOVER
      maximum_speed 1095.3 knots
      maximum_altitude 50000 ft
   end_mover

   fuel WSF_VARIABLE_RATE_FUEL
      rate 7.0 lb/s
      initial_quantity 14000 lb
      maximum_quantity 14000 lb
   end_fuel
end_platform_type
`;
    const result = importAfsimText(text);
    expect(result.errors).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);

    const platform = result.equipment[0].platform;
    expect(platform.movers['WSF_AIR_MOVER']).toBeDefined();
    expect((platform.movers['WSF_AIR_MOVER'] as any).type).toBe('WSF_AIR_MOVER');
    expect((platform.movers['WSF_AIR_MOVER'] as any).maximumSpeed).toBe('1095.3 knots');

    expect(platform.fuels['WSF_VARIABLE_RATE_FUEL']).toBeDefined();
    expect((platform.fuels['WSF_VARIABLE_RATE_FUEL'] as any).type).toBe('WSF_VARIABLE_RATE_FUEL');
    expect((platform.fuels['WSF_VARIABLE_RATE_FUEL'] as any).rate).toBe('7.0 lb/s');
  });

  it('should parse sensor with inline end keyword', () => {
    const text = `
platform_type RADAR_JET WSF_PLATFORM
   sensor my_radar WSF_RADAR_SENSOR
      on
      initial_mode search
   end_sensor
end_platform_type
`;
    const result = importAfsimText(text);
    expect(result.errors).toHaveLength(0);
    const sensors = result.equipment[0].platform.sensors;
    expect(sensors['my_radar']).toBeDefined();
    expect(sensors['my_radar'].type).toBe('WSF_RADAR_SENSOR');
    expect(sensors['my_radar'].on).toBe(true);
  });

  it('should parse weapon with inline end keyword', () => {
    const text = `
platform_type MISSILE_JET WSF_PLATFORM
   weapon fox2 WSF_IMPLICIT_WEAPON end_weapon
end_platform_type
`;
    const result = importAfsimText(text);
    expect(result.errors).toHaveLength(0);
    const weapons = result.equipment[0].platform.weapons;
    expect(weapons['fox2']).toBeDefined();
    expect(weapons['fox2'].type).toBe('WSF_IMPLICIT_WEAPON');
  });

  it('should parse multiple platform types', () => {
    const text = `
platform_type FIGHTER_A WSF_PLATFORM
   side blue
end_platform_type

platform_type FIGHTER_B WSF_PLATFORM
   side red
end_platform_type
`;
    const result = importAfsimText(text);
    expect(result.equipment).toHaveLength(2);
    expect(result.equipment[0].name).toBe('FIGHTER_A');
    expect(result.equipment[1].name).toBe('FIGHTER_B');
  });

  it('should build type registry from standalone definitions', () => {
    const text = `
sensor BLUE_A2A_RADAR WSF_RADAR_SENSOR
   mode_template
      one_m2_detect_range 80 nm
   end_mode_template
end_sensor

platform_type MY_FIGHTER WSF_PLATFORM
   sensor my_radar BLUE_A2A_RADAR
      on
   end_sensor
end_platform_type
`;
    const result = importAfsimText(text);
    expect(result.errors).toHaveLength(0);

    // Registry should contain the standalone sensor type
    expect(result.typeRegistry.has('BLUE_A2A_RADAR')).toBe(true);
    expect(result.typeRegistry.get('BLUE_A2A_RADAR')!.keyword).toBe('sensor');

    // Equipment should resolve the sensor reference
    const sensors = result.equipment[0].platform.sensors;
    expect(sensors['my_radar']).toBeDefined();
    expect(sensors['my_radar'].on).toBe(true);
  });

  it('should resolve type inheritance', () => {
    const text = `
platform_type BASE_FIGHTER WSF_PLATFORM
   side blue
   category fighter
   mover WSF_AIR_MOVER
      maximum_speed 500 knots
   end_mover
end_platform_type

platform_type ADVANCED_FIGHTER BASE_FIGHTER
   icon F-22
   mover WSF_AIR_MOVER
      maximum_speed 1000 knots
   end_mover
end_platform_type
`;
    const result = importAfsimText(text);
    expect(result.errors).toHaveLength(0);
    expect(result.equipment).toHaveLength(2);

    const advanced = result.equipment.find(e => e.name === 'ADVANCED_FIGHTER')!;
    expect(advanced.parentType).toBe('BASE_FIGHTER');
    // Should inherit side from parent
    expect(advanced.platform.side).toBe('blue');
    // Should have its own icon
    expect(advanced.platform.icon).toBe('F-22');
    // Mover speed should be overridden
    expect((advanced.platform.movers['WSF_AIR_MOVER'] as any).maximumSpeed).toBe('1000 knots');
  });

  it('should report stats correctly', () => {
    const text = `
sensor MY_SENSOR WSF_RADAR_SENSOR end_sensor
weapon MY_WEAPON WSF_IMPLICIT_WEAPON end_weapon
platform_type MY_PLATFORM WSF_PLATFORM end_platform_type
`;
    const result = importAfsimText(text);
    expect(result.stats.platformTypes).toBe(1);
    expect(result.stats.sensorTypes).toBe(1);
    expect(result.stats.weaponTypes).toBe(1);
    expect(result.stats.filesProcessed).toBe(1);
  });

  it('should handle parse errors gracefully', () => {
    const text = `this is not valid AFSIM syntax at all !!!`;
    const result = importAfsimText(text);
    // Should not crash, may have errors but equipment should be empty
    expect(result.equipment).toHaveLength(0);
  });
});

// ============================================================
// Multi-file import tests
// ============================================================

describe('importAfsimFiles', () => {
  it('should resolve include_once directives', () => {
    const files = new Map<string, string>();
    files.set('sensors/radar.txt', `
sensor MY_RADAR WSF_RADAR_SENSOR
   mode_template
      one_m2_detect_range 80 nm
   end_mode_template
end_sensor
`);
    files.set('platforms/fighter.txt', `
include_once ../sensors/radar.txt

platform_type MY_FIGHTER WSF_PLATFORM
   sensor my_radar MY_RADAR
      on
   end_sensor
end_platform_type
`);

    const provider = createMapFileProvider(files);
    const result = importAfsimFiles(['platforms/fighter.txt'], provider);

    expect(result.errors.filter(e => !e.message.includes('File not found'))).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0].name).toBe('MY_FIGHTER');
    expect(result.typeRegistry.has('MY_RADAR')).toBe(true);
  });

  it('should handle include_once deduplication', () => {
    const files = new Map<string, string>();
    files.set('common.txt', `
sensor SHARED_SENSOR WSF_RADAR_SENSOR end_sensor
`);
    files.set('platform_a.txt', `
include_once common.txt
platform_type PLATFORM_A WSF_PLATFORM end_platform_type
`);
    files.set('platform_b.txt', `
include_once common.txt
platform_type PLATFORM_B WSF_PLATFORM end_platform_type
`);

    const provider = createMapFileProvider(files);
    const result = importAfsimFiles(
      ['platform_a.txt', 'platform_b.txt'],
      provider,
    );

    // SHARED_SENSOR should be in registry only once (deduplication)
    expect(result.typeRegistry.has('SHARED_SENSOR')).toBe(true);
    expect(result.equipment).toHaveLength(2);
  });

  it('should report missing files as errors', () => {
    const files = new Map<string, string>();
    files.set('main.txt', `
include_once missing.txt
platform_type MY_PLATFORM WSF_PLATFORM end_platform_type
`);

    const provider = createMapFileProvider(files);
    const result = importAfsimFiles(['main.txt'], provider);

    const missingErrors = result.errors.filter(e => e.message.includes('File not found'));
    expect(missingErrors.length).toBeGreaterThan(0);
    // Platform should still be parsed despite missing include
    expect(result.equipment).toHaveLength(1);
  });

  it('should handle nested includes', () => {
    const files = new Map<string, string>();
    files.set('base/sensors.txt', `
sensor BASE_SENSOR WSF_RADAR_SENSOR end_sensor
`);
    files.set('base/platforms.txt', `
include_once sensors.txt
platform_type BASE_PLATFORM WSF_PLATFORM end_platform_type
`);
    files.set('main.txt', `
include_once base/platforms.txt
platform_type MAIN_PLATFORM WSF_PLATFORM end_platform_type
`);

    const provider = createMapFileProvider(files);
    const result = importAfsimFiles(['main.txt'], provider);

    expect(result.typeRegistry.has('BASE_SENSOR')).toBe(true);
    expect(result.equipment).toHaveLength(2);
  });
});

// ============================================================
// File provider tests
// ============================================================

describe('createMapFileProvider', () => {
  it('should return content for existing paths', () => {
    const files = new Map<string, string>();
    files.set('test.txt', 'content');

    const provider = createMapFileProvider(files);
    expect(provider('test.txt')).toBe('content');
  });

  it('should return null for missing paths', () => {
    const files = new Map<string, string>();
    const provider = createMapFileProvider(files);
    expect(provider('missing.txt')).toBeNull();
  });

  it('should normalize path separators', () => {
    const files = new Map<string, string>();
    files.set('a/b/c.txt', 'content');

    const provider = createMapFileProvider(files);
    expect(provider('a\\b\\c.txt')).toBe('content');
  });
});

// ============================================================
// Sample file parsing tests
// ============================================================

describe('sample files', () => {
  const samplesDir = resolve(__dirname, '../../samples');

  it('should parse F-35A.txt without errors', () => {
    const text = readFileSync(resolve(samplesDir, 'F-35A.txt'), 'utf-8');
    const result = importAfsimText(text);
    const realErrors = result.errors.filter(e => !e.message.includes('File not found'));
    expect(realErrors).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0].name).toBe('F-35A_LIGHTNING_II');
    expect(result.equipment[0].platform.side).toBe('blue');
    expect(Object.keys(result.equipment[0].platform.sensors).length).toBeGreaterThan(0);
    expect(Object.keys(result.equipment[0].platform.weapons).length).toBeGreaterThan(0);
  });

  it('should parse J-20.txt without errors', () => {
    const text = readFileSync(resolve(samplesDir, 'J-20.txt'), 'utf-8');
    const result = importAfsimText(text);
    const realErrors = result.errors.filter(e => !e.message.includes('File not found'));
    expect(realErrors).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0].name).toBe('J-20_WEILONG');
    expect(result.equipment[0].platform.side).toBe('red');
  });

  it('should parse Ford-Carrier.txt without errors', () => {
    const text = readFileSync(resolve(samplesDir, 'Ford-Carrier.txt'), 'utf-8');
    const result = importAfsimText(text);
    const realErrors = result.errors.filter(e => !e.message.includes('File not found'));
    expect(realErrors).toHaveLength(0);
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0].name).toBe('CVN-78_FORD');
    expect(result.equipment[0].platform.side).toBe('blue');
    expect(result.equipment[0].platform.categories).toContain('carrier');
  });
});
