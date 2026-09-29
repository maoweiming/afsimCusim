/**
 * Generate seed equipment data from ALL AFSIM demos.
 *
 * Usage: npx tsx scripts/generateAfsimSeedData.ts
 *
 * Reads all .txt files from AFSIM demos/, parses platform_type definitions
 * with the afsimImporter, and outputs:
 *   1. seedAfsimData.ts  — Equipment[] (compact list-display projection)
 *   2. seedAfsimConfigs.ts — Record<string, AfsimEquipment> (full AFSIM data, indexed by id)
 *
 * AfsimEquipment is the source of truth. Equipment is a derived projection.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

import { importAfsimFiles, createMapFileProvider } from '../src/modules/equipment/io/afsimImporter';
import type { AfsimEquipment } from '../src/modules/equipment/afsim/types';
import type { Equipment, EquipmentCategory } from '../src/modules/equipment/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEMOS_DIR = join(__dirname, '..', '..', 'AFSim', 'afsim-2.9.0-win64', 'demos');
const DATA_DIR = join(__dirname, '..', 'src', 'modules', 'equipment', 'data');

// ── Helpers ──────────────────────────────────────────────────

function walkDir(dir: string, baseDir: string, files: Map<string, string>) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, baseDir, files);
    } else if (entry.name.endsWith('.txt')) {
      const relPath = relative(baseDir, fullPath).replace(/\\/g, '/');
      files.set(relPath, readFileSync(fullPath, 'utf-8'));
    }
  }
}

const MOVER_TO_DOMAIN: Record<string, string> = {
  WSF_AIR_MOVER: 'air',
  WSF_ROTORCRAFT_MOVER: 'air',
  WSF_HYBRID_MOVER: 'air',
  WSF_GROUND_MOVER: 'land',
  WSF_ROAD_MOVER: 'land',
  WSF_SURFACE_MOVER: 'surface',
  WSF_SUBSURFACE_MOVER: 'subsurface',
  WSF_SPACE_MOVER: 'space',
  WSF_KINEMATIC_MOVER: 'space',
  WSF_GUIDED_MOVER: 'air',
  WSF_BRAWLER_MOVER: 'air',
  WSF_POINT_MASS_SIX_DOF_MOVER: 'air',
};

const DOMAIN_TO_CATEGORY: Record<string, EquipmentCategory> = {
  air: 'aircraft',
  ground: 'vehicle',
  land: 'vehicle',
  surface: 'ship',
  subsurface: 'submarine',
  space: 'space_system',
};

function inferDomain(eq: AfsimEquipment): string {
  // Try to infer from mover type (most reliable)
  const movers = eq.platform.movers || {};
  for (const [, mover] of Object.entries(movers)) {
    const moverType = (mover as any).type || '';
    if (MOVER_TO_DOMAIN[moverType]) return MOVER_TO_DOMAIN[moverType];
  }
  // Fallback to platform.spatialDomain
  return eq.platform.spatialDomain || 'air';
}

function inferCategory(eq: AfsimEquipment): EquipmentCategory {
  const domain = inferDomain(eq);
  return DOMAIN_TO_CATEGORY[domain] || 'aircraft';
}

/** Derive a compact Equipment projection from AfsimEquipment for list display */
function flattenForDisplay(eq: AfsimEquipment, index: number): Equipment {
  return {
    id: `import-${index}`,
    code: eq.name,
    name: eq.name,
    category: inferCategory(eq),
    platformType: eq.name,
    description: eq.description || '',
    version: eq.version || 1,
    status: 'draft',
    icon: eq.platform.icon || undefined,
    domain: eq.platform.spatialDomain || undefined,
    tags: eq.platform.categories || [],
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: eq.createdAt || new Date().toISOString(),
    updatedAt: eq.updatedAt || new Date().toISOString(),
  };
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  console.log(`Reading ALL AFSIM demos from: ${DEMOS_DIR}`);

  const files = new Map<string, string>();
  walkDir(DEMOS_DIR, DEMOS_DIR, files);
  console.log(`  Found ${files.size} .txt files`);

  const provider = createMapFileProvider(files);

  // Collect entry points
  const entryPoints: string[] = [];
  for (const [path, content] of files) {
    if (
      content.includes('platform_type ') &&
      !path.includes('/alternatives/') &&
      !path.includes('\\alternatives\\') &&
      !path.includes('/training/') &&
      !path.includes('\\training\\')
    ) {
      entryPoints.push(path);
    }
  }
  console.log(`  ${entryPoints.length} platform entry points`);

  // Parse
  const result = importAfsimFiles(entryPoints, provider);
  const realErrors = result.errors.filter((e) => !e.message.includes('File not found'));
  console.log(`  Parsed: ${result.equipment.length} platform types`);
  console.log(`  Type registry: ${result.typeRegistry.size} entries`);
  console.log(`  Errors (excluding missing files): ${realErrors.length}`);

  if (realErrors.length > 0) {
    console.warn('  Non-fatal parse errors:');
    for (const err of realErrors.slice(0, 10)) {
      console.warn(`    Line ${err.line}: ${err.message}`);
    }
  }

  // Deduplicate by name (keep first occurrence)
  const seen = new Map<string, AfsimEquipment>();
  for (const eq of result.equipment) {
    const key = eq.name.toUpperCase();
    if (!seen.has(key)) {
      seen.set(key, eq);
    }
  }
  const uniqueEquipment = [...seen.values()];
  console.log(`  After dedup: ${uniqueEquipment.length} unique platform types`);

  // Generate Equipment[] projections
  const equipmentList: Equipment[] = uniqueEquipment.map((eq, i) => flattenForDisplay(eq, i));

  // Build AfsimEquipment map (indexed by id)
  const afsimConfigs: Record<string, AfsimEquipment> = {};
  for (let i = 0; i < uniqueEquipment.length; i++) {
    afsimConfigs[`import-${i}`] = uniqueEquipment[i];
  }

  // Log category distribution
  const catCounts = new Map<string, number>();
  for (const eq of equipmentList) {
    catCounts.set(eq.category, (catCounts.get(eq.category) || 0) + 1);
  }
  console.log('  Category distribution:');
  for (const [cat, count] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }

  // ── Write seedAfsimData.ts (compact Equipment[]) ──
  mkdirSync(DATA_DIR, { recursive: true });

  const equipmentJson = JSON.stringify(equipmentList, null, 2);
  const equipmentOutput = `// ============================================================
// AFSIM Seed Equipment Data (List Display Projection)
// Auto-generated by scripts/generateAfsimSeedData.ts
// Source: AFSIM demos/ (all categories)
// DO NOT EDIT — regenerate with: npm run generate:seed
//
// This is a compact projection for list display.
// The source of truth is seedAfsimConfigs.ts (AfsimEquipment).
// ============================================================

import type { Equipment } from '../types';

export const SEED_EQUIPMENT: Equipment[] = ${equipmentJson};
`;

  const eqFile = join(DATA_DIR, 'seedAfsimData.ts');
  writeFileSync(eqFile, equipmentOutput, 'utf-8');
  console.log(`\nWrote ${eqFile} (${equipmentList.length} records)`);

  // ── Write seedAfsimConfigs.ts (full AfsimEquipment) ──
  const configsJson = JSON.stringify(afsimConfigs, null, 2);
  const configsOutput = `// ============================================================
// AFSIM Seed Equipment Configs (Source of Truth)
// Auto-generated by scripts/generateAfsimSeedData.ts
// Full AFSIM platform_type definitions parsed from demos/
// DO NOT EDIT — regenerate with: npm run generate:seed
// ============================================================

export const SEED_AFSIM_CONFIGS: Record<string, any> = ${configsJson};
`;

  const cfgFile = join(DATA_DIR, 'seedAfsimConfigs.ts');
  writeFileSync(cfgFile, configsOutput, 'utf-8');
  console.log(`Wrote ${cfgFile} (${Object.keys(afsimConfigs).length} configs)`);

  // Report sizes
  const eqSize = Buffer.byteLength(equipmentOutput, 'utf-8');
  const cfgSize = Buffer.byteLength(configsOutput, 'utf-8');
  console.log(`\nFile sizes:`);
  console.log(`  seedAfsimData.ts:    ${(eqSize / 1024).toFixed(0)} KB`);
  console.log(`  seedAfsimConfigs.ts: ${(cfgSize / 1024 / 1024).toFixed(1)} MB`);
}

main();
