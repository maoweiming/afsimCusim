// ============================================================
// Equipment I/O - JSON Exporter
// AFSIM-native: exports AfsimEquipment
// ============================================================

import type { AfsimEquipment } from '../afsim/types';

// ============ Types ============

export interface ExportSelection {
  equipmentNames: string[];
  includeComponents: {
    sensors?: boolean;
    weapons?: boolean;
    comms?: boolean;
    mover?: boolean;
    processors?: boolean;
    fuel?: boolean;
    signature?: boolean;
    zones?: boolean;
    routers?: boolean;
  };
}

export interface AfsimExportBundle {
  formatVersion: string;
  format: 'afsim';
  exportedAt: string;
  count: number;
  data: AfsimEquipment[];
}

// ============ API ============

/**
 * Export AfsimEquipment array as JSON string.
 */
export function exportAfsimJson(
  equipmentList: AfsimEquipment[],
  selection?: ExportSelection,
  pretty = true,
): string {
  let data = [...equipmentList];

  if (selection && selection.equipmentNames.length > 0) {
    data = data.filter((eq) => selection.equipmentNames.includes(eq.name));
  }

  if (selection) {
    data = data.map((eq) => applyComponentSelection(eq, selection.includeComponents));
  }

  const bundle: AfsimExportBundle = {
    formatVersion: '2.0',
    format: 'afsim',
    exportedAt: new Date().toISOString(),
    count: data.length,
    data,
  };

  return JSON.stringify(bundle, null, pretty ? 2 : undefined);
}

/**
 * Export AfsimEquipment list as JSON Blob for download.
 */
export function exportAfsimJsonBlob(
  equipmentList: AfsimEquipment[],
  selection?: ExportSelection,
): Blob {
  const json = exportAfsimJson(equipmentList, selection);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Trigger browser download of AFSIM JSON file.
 */
export function downloadAfsimExport(
  equipmentList: AfsimEquipment[],
  selection?: ExportSelection,
): void {
  const blob = exportAfsimJsonBlob(equipmentList, selection);
  downloadBlob(blob, `afsim_equipment_${dateStamp()}.json`);
}

// ============ Component selection ============

function applyComponentSelection(
  eq: AfsimEquipment,
  include: ExportSelection['includeComponents'],
): AfsimEquipment {
  const allSelected = include.sensors !== false &&
    include.weapons !== false &&
    include.comms !== false &&
    include.mover !== false &&
    include.processors !== false &&
    include.fuel !== false &&
    include.zones !== false &&
    include.routers !== false;

  if (allSelected) return eq;

  return {
    ...eq,
    platform: {
      ...eq.platform,
      sensors: include.sensors === false ? {} : eq.platform.sensors,
      weapons: include.weapons === false ? {} : eq.platform.weapons,
      comms: include.comms === false ? {} : eq.platform.comms,
      processors: include.processors === false ? {} : eq.platform.processors,
      movers: include.mover === false ? {} : eq.platform.movers,
      fuels: include.fuel === false ? {} : eq.platform.fuels,
      zones: include.zones === false ? {} : eq.platform.zones,
      routers: include.routers === false ? {} : eq.platform.routers,
      radarSignature: include.signature === false ? undefined : eq.platform.radarSignature,
    },
  };
}

// ============ Helpers ============

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
