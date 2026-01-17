import { parse } from 'csv-parse/sync';

export interface CSVParseOptions {
  columns?: boolean | string[];
  skip_empty_lines?: boolean;
  trim?: boolean;
  cast?: boolean;
  cast_date?: boolean;
}

/**
 * Parse CSV content into an array of objects
 */
export function parseCSV<T>(
  content: string | Buffer,
  options: CSVParseOptions = {}
): T[] {
  const defaultOptions: CSVParseOptions = {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: true,
    ...options,
  };

  return parse(content, defaultOptions) as T[];
}

/**
 * Parse boolean values from CSV (handles various formats)
 */
export function parseCSVBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return ['true', 'yes', '1', 'y', 't'].includes(lower);
  }
  return false;
}

/**
 * Parse number from CSV (handles empty strings)
 */
export function parseCSVNumber(value: any, defaultValue?: number): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return defaultValue;
  }
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Validate required fields in CSV row
 */
export function validateRequiredFields(
  row: Record<string, any>,
  requiredFields: string[],
  rowIndex: number
): string | null {
  for (const field of requiredFields) {
    if (!row[field] || (typeof row[field] === 'string' && row[field].trim() === '')) {
      return `Row ${rowIndex + 1}: Missing required field "${field}"`;
    }
  }
  return null;
}

/**
 * Generate CSV template header line
 */
export function generateCSVTemplate(fields: { name: string; required: boolean; example: string }[]): string {
  const headers = fields.map(f => f.name).join(',');
  const examples = fields.map(f => f.example).join(',');
  return `${headers}\n${examples}`;
}

// ICD-10 CSV template fields
export const ICD10_CSV_FIELDS = [
  { name: 'code', required: true, example: 'J18.9' },
  { name: 'description', required: true, example: 'Pneumonia, unspecified organism' },
  { name: 'shortDescription', required: false, example: 'Pneumonia NOS' },
  { name: 'category', required: true, example: 'Respiratory' },
  { name: 'subcategory', required: false, example: 'Lower Respiratory' },
  { name: 'dhaApproved', required: false, example: 'true' },
  { name: 'specificityLevel', required: false, example: '4' },
  { name: 'isUnspecified', required: false, example: 'true' },
  { name: 'preferredCode', required: false, example: 'J18.1' },
  { name: 'isBillable', required: false, example: 'true' },
  { name: 'notes', required: false, example: 'Common diagnosis code' },
];

// CPT CSV template fields
export const CPT_CSV_FIELDS = [
  { name: 'code', required: true, example: '99213' },
  { name: 'description', required: true, example: 'Office visit, established patient, low complexity' },
  { name: 'shortDescription', required: false, example: 'Office visit est low' },
  { name: 'category', required: true, example: 'E&M' },
  { name: 'subcategory', required: false, example: 'Office Visit' },
  { name: 'basePrice', required: true, example: '150' },
  { name: 'dhaPrice', required: false, example: '145' },
  { name: 'cashPrice', required: false, example: '135' },
  { name: 'requiresPreAuth', required: false, example: 'false' },
  { name: 'workRVU', required: false, example: '1.30' },
  { name: 'globalPeriod', required: false, example: '0' },
  { name: 'professionalComponent', required: false, example: 'false' },
  { name: 'technicalComponent', required: false, example: 'false' },
  { name: 'notes', required: false, example: 'Common E&M code' },
];

export function generateICD10Template(): string {
  return generateCSVTemplate(ICD10_CSV_FIELDS);
}

export function generateCPTTemplate(): string {
  return generateCSVTemplate(CPT_CSV_FIELDS);
}
