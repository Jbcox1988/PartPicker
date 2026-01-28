import * as XLSX from 'xlsx';

export interface InventoryRecord {
  partNumber: string;
  location: string;
  qtyAvailable: number;
  lotId: string;
}

export interface InventoryMap {
  // Map of part number -> { location, qtyAvailable, lotId }
  [partNumber: string]: {
    location: string;
    qtyAvailable: number;
    lotId: string;
  };
}

interface ParseInventoryResult {
  success: boolean;
  inventory: InventoryMap;
  totalRecords: number;
  uniqueParts: number;
  errors: string[];
}

/**
 * Parse inventory Excel file and return a map of part numbers to their
 * newest inventory record (based on Lot ID timestamp)
 */
export async function parseInventoryFile(file: File): Promise<ParseInventoryResult> {
  const errors: string[] = [];

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, inventory: {}, totalRecords: 0, uniqueParts: 0, errors: ['No sheets found in workbook'] };
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: ''
    });

    if (jsonData.length < 2) {
      return { success: false, inventory: {}, totalRecords: 0, uniqueParts: 0, errors: ['Sheet has no data rows'] };
    }

    // Detect column indices from header row
    const headerRow = jsonData[0] as string[];
    const columnMap = detectInventoryColumns(headerRow);

    if (columnMap.productId === -1) {
      return {
        success: false,
        inventory: {},
        totalRecords: 0,
        uniqueParts: 0,
        errors: ['Could not find Product Id column in inventory file']
      };
    }

    // Parse all inventory records
    const allRecords: InventoryRecord[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[];
      if (!row || row.length === 0) continue;

      // Convert part number to string - handle both numeric and string values from Excel
      const rawPartNumber = row[columnMap.productId];
      const partNumber = rawPartNumber !== null && rawPartNumber !== undefined
        ? String(rawPartNumber).trim()
        : '';
      if (!partNumber) continue;

      const lotId = String(row[columnMap.lotId] || '');
      const location = String(row[columnMap.location] || '').trim();
      const qtyAvailable = parseNumber(row[columnMap.qtyAvailable]);

      // Skip records with no location or "AWAITING INSPECTION" type locations
      const skipLocations = ['awaiting inspection', 'receiving', 'qa', 'quarantine'];
      if (!location || skipLocations.some(skip => location.toLowerCase().includes(skip))) {
        continue;
      }

      allRecords.push({
        partNumber,
        location,
        qtyAvailable,
        lotId
      });
    }

    // Group by part number and keep only the newest lot (highest lotId)
    const inventory: InventoryMap = {};

    for (const record of allRecords) {
      const existing = inventory[record.partNumber];

      if (!existing || record.lotId > existing.lotId) {
        inventory[record.partNumber] = {
          location: record.location,
          qtyAvailable: record.qtyAvailable,
          lotId: record.lotId
        };
      }
    }

    return {
      success: true,
      inventory,
      totalRecords: allRecords.length,
      uniqueParts: Object.keys(inventory).length,
      errors
    };

  } catch (error) {
    return {
      success: false,
      inventory: {},
      totalRecords: 0,
      uniqueParts: 0,
      errors: [`Failed to parse inventory file: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

interface ColumnMap {
  productId: number;
  lotId: number;
  location: number;
  qtyAvailable: number;
}

function detectInventoryColumns(headerRow: string[]): ColumnMap {
  const map: ColumnMap = {
    productId: -1,
    lotId: -1,
    location: -1,
    qtyAvailable: -1
  };

  for (let i = 0; i < headerRow.length; i++) {
    const header = String(headerRow[i] || '').toLowerCase().trim();

    if (header.includes('product') && header.includes('id')) {
      map.productId = i;
    } else if (header === 'product id' || header === 'productid' || header === 'part number' || header === 'part_number') {
      map.productId = i;
    }

    if (header.includes('lot') && header.includes('id')) {
      map.lotId = i;
    } else if (header === 'lot id' || header === 'lotid') {
      map.lotId = i;
    }

    if (header === 'location' || header === 'loc' || header === 'bin') {
      map.location = i;
    }

    if (header.includes('qty') && header.includes('available')) {
      map.qtyAvailable = i;
    } else if (header === 'qty available' || header === 'qtyavailable' || header === 'available') {
      map.qtyAvailable = i;
    }
  }

  return map;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num));
  }
  return 0;
}
