// ============================================================
// Equipment I/O - Import/Export System
// AFSIM .conf format + JSON standard format
// ============================================================

// afsimImporter
export {
  importAfsimFiles,
  importAfsimText,
  createMapFileProvider,
  createUrlFileProvider,
} from './afsimImporter';
export type { AfsimBatchImportResult, FileProvider } from './afsimImporter';

// confWriter
export { writeAfsimConf, writeSingleAfsimConf } from './confWriter';
export type { ConfWriterOptions } from './confWriter';

// confParser
export { parseAfsimConf, parseSingleAfsimConf } from './confParser';
export type { AfsimParseResult, AfsimParseError } from './confParser';

// jsonExporter
export {
  exportAfsimJson,
  exportAfsimJsonBlob,
  downloadAfsimExport,
} from './jsonExporter';
export type { ExportSelection, AfsimExportBundle } from './jsonExporter';

// jsonImporter
export {
  importAfsimJson,
  importAfsimJsonFile,
  isAfsimFormat,
} from './jsonImporter';
export type { AfsimImportResult, AfsimImportError } from './jsonImporter';
