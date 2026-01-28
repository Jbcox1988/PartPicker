import * as XLSX from 'xlsx';
import type { ImportedOrder, ImportedTool, ImportedLineItem } from '@/types';

export interface ParseResult {
  success: boolean;
  order?: ImportedOrder;
  errors: string[];
  warnings: string[];
}

// Info extracted from Order Info sheet
interface OrderInfo {
  so_number?: string;
  po_number?: string;
  customer_name?: string;
  order_date?: string;
  due_date?: string;
  tool_qty?: number;
  tool_model?: string;
}

// Tool type sheet info
interface ToolTypeSheet {
  sheetName: string;
  toolModel: string;
  toolQty: number;
  lineItems: ImportedLineItem[];
}

interface ColumnMapping {
  partNumber: number;
  description: number;
  location: number;
  qtyPerUnit: number;
  totalQty: number;
  // Tool-specific quantity columns (tool number -> column index)
  toolColumns: Map<string, number>;
}

/**
 * Parse an Excel file (SO-*.xlsx) into an ImportedOrder structure
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellStyles: true });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, errors: ['No sheets found in workbook'], warnings };
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: ''
    });

    // Build a set of grey row indices to skip (rows with grey background color 7F7F7F)
    const greyRows = new Set<number>();
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    for (let row = 0; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cell = sheet[cellAddress] as { s?: { fgColor?: { rgb?: string } } } | undefined;
      if (cell?.s?.fgColor?.rgb === '7F7F7F') {
        greyRows.add(row);
      }
    }

    if (jsonData.length < 2) {
      return { success: false, errors: ['Sheet has no data rows'], warnings };
    }

    // Extract SO number from filename (e.g., "SO-3137.xlsx" -> "3137")
    const soMatch = file.name.match(/SO[- ]?(\d+)/i);
    const soNumber = soMatch ? soMatch[1] : file.name.replace(/\.xlsx?$/i, '');

    // Find header row and detect column mapping
    const { headerRowIndex, mapping } = detectColumns(jsonData);

    if (headerRowIndex === -1) {
      return {
        success: false,
        errors: ['Could not find header row with Part Number column'],
        warnings
      };
    }

    // Extract tools from column headers
    const tools = extractTools(jsonData[headerRowIndex] as string[], mapping);

    // Parse line items
    const lineItems: ImportedLineItem[] = [];

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !Array.isArray(row)) continue;

      // Skip grey rows (greyed out parts that shouldn't be picked)
      if (greyRows.has(i)) {
        continue;
      }

      const partNumber = String(row[mapping.partNumber] || '').trim();
      if (!partNumber || partNumber === '') continue;

      // Skip header-like rows that might appear mid-data
      if (partNumber.toLowerCase().includes('part') &&
          partNumber.toLowerCase().includes('number')) {
        continue;
      }

      const description = mapping.description >= 0
        ? String(row[mapping.description] || '').trim()
        : '';

      const location = mapping.location >= 0
        ? String(row[mapping.location] || '').trim()
        : '';

      // Get qty per unit and total qty
      // Priority: If we have tool columns, use them as the source of truth for qty_per_unit
      // because generic "Qty" columns often contain the TOTAL, not per-unit values
      let qtyPerUnit = 0;
      let totalQty = 0;

      if (mapping.toolColumns.size > 0) {
        // We have tool-specific columns - use first tool's qty as qty per unit
        const firstToolCol = mapping.toolColumns.values().next().value;
        if (firstToolCol !== undefined) {
          qtyPerUnit = parseQty(row[firstToolCol]);
        }

        // Sum all tool columns for total qty
        for (const colIdx of mapping.toolColumns.values()) {
          totalQty += parseQty(row[colIdx]);
        }
      } else {
        // No tool columns - fall back to dedicated qty columns
        if (mapping.qtyPerUnit >= 0) {
          qtyPerUnit = parseQty(row[mapping.qtyPerUnit]);
        }
        if (mapping.totalQty >= 0) {
          totalQty = parseQty(row[mapping.totalQty]);
        }
      }

      // If we have a total qty column but no per-unit calculated yet, derive it
      if (qtyPerUnit === 0 && mapping.totalQty >= 0) {
        totalQty = parseQty(row[mapping.totalQty]);
        qtyPerUnit = Math.ceil(totalQty / Math.max(tools.length, 1));
      }

      // If we still don't have totals, use qty per unit * tool count
      if (totalQty === 0 && qtyPerUnit > 0) {
        totalQty = qtyPerUnit * Math.max(tools.length, 1);
      }

      // Final fallback: derive qty per unit from total if we have tools
      if (qtyPerUnit === 0 && totalQty > 0) {
        qtyPerUnit = Math.ceil(totalQty / Math.max(tools.length, 1));
      }

      if (qtyPerUnit > 0 || totalQty > 0) {
        lineItems.push({
          part_number: partNumber,
          description: description || undefined,
          location: location || undefined,
          qty_per_unit: qtyPerUnit || 1,
          total_qty_needed: totalQty || qtyPerUnit,
        });
      }
    }

    if (lineItems.length === 0) {
      return {
        success: false,
        errors: ['No valid line items found in the file'],
        warnings
      };
    }

    // Create default tool if none detected
    const finalTools = tools.length > 0 ? tools : [{ tool_number: `${soNumber}-1` }];

    const order: ImportedOrder = {
      so_number: soNumber,
      tools: finalTools,
      line_items: lineItems,
    };

    return { success: true, order, errors, warnings };

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    };
  }
}

/**
 * Detect column positions in the spreadsheet
 */
function detectColumns(data: unknown[][]): { headerRowIndex: number; mapping: ColumnMapping } {
  const defaultMapping: ColumnMapping = {
    partNumber: -1,
    description: -1,
    location: -1,
    qtyPerUnit: -1,
    totalQty: -1,
    toolColumns: new Map(),
  };

  // Search first 10 rows for header
  for (let rowIdx = 0; rowIdx < Math.min(10, data.length); rowIdx++) {
    const row = data[rowIdx];
    if (!row || !Array.isArray(row)) continue;

    const mapping = { ...defaultMapping, toolColumns: new Map<string, number>() };

    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = String(row[colIdx] || '').toLowerCase().trim();

      // Part number detection
      if (cell.includes('part') && (cell.includes('num') || cell.includes('#') || cell.includes('no'))) {
        mapping.partNumber = colIdx;
      } else if (cell === 'part' || cell === 'part#' || cell === 'pn' || cell === 'ref_pn') {
        mapping.partNumber = colIdx;
      }

      // Description detection
      if (cell.includes('desc') || cell === 'description' || cell === 'name') {
        mapping.description = colIdx;
      }

      // Location detection
      if (cell.includes('loc') || cell === 'location' || cell === 'bin' || cell.includes('stock')) {
        mapping.location = colIdx;
      }

      // Qty per unit detection
      if (cell.includes('qty') && (cell.includes('per') || cell.includes('unit'))) {
        mapping.qtyPerUnit = colIdx;
      } else if (cell === 'qty' || cell === 'qty.' || cell === 'quantity') {
        mapping.qtyPerUnit = colIdx;
      } else if (cell.includes('qty') && cell.includes('ea')) {
        // "QTY. EA" or "Qty EA" column - qty each/per unit
        mapping.qtyPerUnit = colIdx;
      } else if (cell.includes('qty') && cell.includes('need') && !cell.includes('tool')) {
        // "QTY. Needed" or "Qty Needed" column (but not "Tool Qty Need")
        mapping.qtyPerUnit = colIdx;
      }

      // Total qty detection
      if (cell.includes('total') && cell.includes('qty')) {
        mapping.totalQty = colIdx;
      } else if (cell === 'total' || (cell.includes('ext') && cell.includes('qty'))) {
        mapping.totalQty = colIdx;
      } else if (cell.includes('tool') && cell.includes('qty') && cell.includes('need')) {
        // "Tool Qty Need" column
        mapping.totalQty = colIdx;
      }

      // Tool-specific columns (e.g., "3137-1", "Tool 1", "Unit 1", "SN1", "NG1", "PT1")
      // Pattern 1: SO-style "3137-1", "3137-2"
      // Pattern 2: "Tool 1", "Unit 1", "SN1"
      // Pattern 3: Letter prefix + number like "NG1", "NG2", "PT1", "PT2"
      const toolMatch = cell.match(/^(\d+-\d+)$|^tool\s*(\d+)$|^unit\s*(\d+)$|^sn(\d+)$|^([a-z]{1,3})(\d+)$/i);
      if (toolMatch) {
        let toolNum: string | undefined;
        if (toolMatch[1]) {
          // Pattern like "3137-1"
          toolNum = toolMatch[1];
        } else if (toolMatch[2]) {
          toolNum = `Tool-${toolMatch[2]}`;
        } else if (toolMatch[3]) {
          toolNum = `Unit-${toolMatch[3]}`;
        } else if (toolMatch[4]) {
          toolNum = `SN${toolMatch[4]}`;
        } else if (toolMatch[5] && toolMatch[6]) {
          // Pattern like "NG1", "PT1" - keep original format
          toolNum = `${toolMatch[5].toUpperCase()}${toolMatch[6]}`;
        }
        if (toolNum) {
          mapping.toolColumns.set(toolNum, colIdx);
        }
      }
    }

    // If we found a part number column, this is likely our header row
    if (mapping.partNumber >= 0) {
      return { headerRowIndex: rowIdx, mapping };
    }
  }

  return { headerRowIndex: -1, mapping: defaultMapping };
}

/**
 * Extract tool definitions from column headers
 */
function extractTools(_headerRow: string[], mapping: ColumnMapping): ImportedTool[] {
  const tools: ImportedTool[] = [];

  for (const [toolNumber] of mapping.toolColumns) {
    tools.push({ tool_number: toolNumber });
  }

  // Sort tools by number
  tools.sort((a, b) => {
    const numA = parseInt(a.tool_number.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.tool_number.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  return tools;
}

/**
 * Parse a cell value as a quantity number
 */
function parseQty(value: unknown): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num));
  }
  return 0;
}

/**
 * Parse a CSV file into an ImportedOrder structure
 */
export async function parseCsvFile(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return { success: false, errors: ['No data found in CSV'], warnings };
    }

    // Convert to array format and reuse Excel parsing logic
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: ''
    });

    if (jsonData.length < 2) {
      return { success: false, errors: ['CSV has no data rows'], warnings };
    }

    // Similar logic to parseExcelFile...
    const soMatch = file.name.match(/SO[- ]?(\d+)/i);
    const soNumber = soMatch ? soMatch[1] : file.name.replace(/\.csv$/i, '');

    const { headerRowIndex, mapping } = detectColumns(jsonData);

    if (headerRowIndex === -1) {
      return {
        success: false,
        errors: ['Could not find header row with Part Number column'],
        warnings
      };
    }

    const tools = extractTools(jsonData[headerRowIndex] as string[], mapping);
    const lineItems: ImportedLineItem[] = [];

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !Array.isArray(row)) continue;

      const partNumber = String(row[mapping.partNumber] || '').trim();
      if (!partNumber) continue;

      const description = mapping.description >= 0
        ? String(row[mapping.description] || '').trim()
        : '';

      const location = mapping.location >= 0
        ? String(row[mapping.location] || '').trim()
        : '';

      let qtyPerUnit = mapping.qtyPerUnit >= 0 ? parseQty(row[mapping.qtyPerUnit]) : 1;
      let totalQty = mapping.totalQty >= 0 ? parseQty(row[mapping.totalQty]) : qtyPerUnit;

      if (qtyPerUnit > 0 || totalQty > 0) {
        lineItems.push({
          part_number: partNumber,
          description: description || undefined,
          location: location || undefined,
          qty_per_unit: qtyPerUnit || 1,
          total_qty_needed: totalQty || qtyPerUnit,
        });
      }
    }

    if (lineItems.length === 0) {
      return {
        success: false,
        errors: ['No valid line items found in the CSV'],
        warnings
      };
    }

    const finalTools = tools.length > 0 ? tools : [{ tool_number: `${soNumber}-1` }];

    const order: ImportedOrder = {
      so_number: soNumber,
      tools: finalTools,
      line_items: lineItems,
    };

    return { success: true, order, errors, warnings };

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    };
  }
}

/**
 * Parse Order Info sheet to extract header information
 */
function parseOrderInfoSheet(sheet: XLSX.WorkSheet): OrderInfo {
  const info: OrderInfo = {};

  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: ''
  });

  // Look for key-value pairs in the sheet
  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row || !Array.isArray(row)) continue;

    const label = String(row[0] || '').toLowerCase().trim();
    const value = String(row[1] || '').trim();

    if (!label || !value) continue;

    if (label.includes('so') && (label.includes('number') || label.includes('#') || label.includes('no'))) {
      info.so_number = value.replace(/^SO[- ]?/i, '');
    } else if (label === 'so number' || label === 'so#' || label === 'so') {
      info.so_number = value.replace(/^SO[- ]?/i, '');
    } else if (label.includes('po') && (label.includes('number') || label.includes('#') || label.includes('no'))) {
      info.po_number = value;
    } else if (label === 'po number' || label === 'po#' || label === 'po') {
      info.po_number = value;
    } else if (label.includes('customer') || label.includes('client')) {
      info.customer_name = value;
    } else if (label.includes('tool') && label.includes('qty')) {
      info.tool_qty = parseQty(value);
    } else if (label.includes('tool') && label.includes('model')) {
      info.tool_model = value;
    } else if (label.includes('order') && label.includes('date')) {
      info.order_date = value;
    } else if (label.includes('due') && label.includes('date')) {
      info.due_date = value;
    }
  }

  return info;
}

/**
 * Parse a tool type sheet (e.g., "230Q" sheet with parts for that tool type)
 */
function parseToolTypeSheet(sheet: XLSX.WorkSheet, sheetName: string): ToolTypeSheet | null {
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: ''
  });

  if (jsonData.length < 2) return null;

  const { headerRowIndex, mapping } = detectColumns(jsonData);
  if (headerRowIndex === -1) return null;

  // Look for tool quantity in first column of first data row
  let toolQty = 1;
  const headerRow = jsonData[headerRowIndex] as unknown[];

  // Check if first column header suggests it's a quantity
  const firstColHeader = String(headerRow[0] || '').toLowerCase();
  if (firstColHeader.includes('qty') || firstColHeader.includes('quantity')) {
    // The first data row's first column contains tool quantity
    const firstDataRow = jsonData[headerRowIndex + 1];
    if (firstDataRow && Array.isArray(firstDataRow)) {
      toolQty = parseQty(firstDataRow[0]) || 1;
    }
  }

  // Parse line items
  const lineItems: ImportedLineItem[] = [];

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || !Array.isArray(row)) continue;

    const partNumber = String(row[mapping.partNumber] || '').trim();
    if (!partNumber || partNumber === '') continue;

    const description = mapping.description >= 0
      ? String(row[mapping.description] || '').trim()
      : '';

    const location = mapping.location >= 0
      ? String(row[mapping.location] || '').trim()
      : '';

    let qtyPerUnit = mapping.qtyPerUnit >= 0 ? parseQty(row[mapping.qtyPerUnit]) : 1;
    let totalQty = mapping.totalQty >= 0 ? parseQty(row[mapping.totalQty]) : qtyPerUnit * toolQty;

    if (qtyPerUnit === 0 && totalQty > 0) {
      qtyPerUnit = Math.ceil(totalQty / toolQty);
    }

    if (qtyPerUnit > 0 || totalQty > 0) {
      lineItems.push({
        part_number: partNumber,
        description: description || undefined,
        location: location || undefined,
        qty_per_unit: qtyPerUnit || 1,
        total_qty_needed: totalQty || qtyPerUnit * toolQty,
      });
    }
  }

  if (lineItems.length === 0) return null;

  return {
    sheetName,
    toolModel: sheetName,
    toolQty,
    lineItems,
  };
}

/**
 * Enhanced Excel parser that handles multi-sheet formats
 *
 * Supported formats:
 * 1. Single sheet with parts list (original format)
 * 2. "Order Info" sheet + "Parts" sheet
 * 3. "Order Info" sheet + multiple tool type sheets (e.g., "230Q", "450Q")
 */
export async function parseEnhancedExcelFile(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellStyles: true });

    if (workbook.SheetNames.length === 0) {
      return { success: false, errors: ['No sheets found in workbook'], warnings };
    }

    // Check for Order Info sheet
    const orderInfoSheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('order') && name.toLowerCase().includes('info')
    );

    // If no Order Info sheet, fall back to original parser
    if (!orderInfoSheetName) {
      return parseExcelFile(file);
    }

    const orderInfoSheet = workbook.Sheets[orderInfoSheetName];
    const orderInfo = parseOrderInfoSheet(orderInfoSheet);

    // Extract SO number from order info or filename
    const soMatch = file.name.match(/SO[- ]?(\d+)/i);
    const soNumber = orderInfo.so_number || (soMatch ? soMatch[1] : file.name.replace(/\.xlsx?$/i, ''));

    // Check for Parts sheet (single tool type with quantity)
    const partsSheetName = workbook.SheetNames.find(name =>
      name.toLowerCase() === 'parts' ||
      (name.toLowerCase().includes('part') && !name.toLowerCase().includes('order'))
    );

    // Get all other sheets that might be tool type sheets
    const otherSheets = workbook.SheetNames.filter(name =>
      name !== orderInfoSheetName && name !== partsSheetName
    );

    // Determine which parsing approach to use
    let tools: ImportedTool[] = [];
    let lineItems: ImportedLineItem[] = [];
    const toolIdMap = new Map<string, string[]>(); // part_number -> tool IDs

    if (partsSheetName && otherSheets.length === 0) {
      // Format 2: Order Info + Parts (single tool type)
      const partsSheet = workbook.Sheets[partsSheetName];
      const { headerRowIndex, mapping } = detectColumns(
        XLSX.utils.sheet_to_json<unknown[]>(partsSheet, { header: 1, defval: '' })
      );

      if (headerRowIndex === -1) {
        return { success: false, errors: ['Could not find header row in Parts sheet'], warnings };
      }

      // Get tool qty from order info
      const toolQty = orderInfo.tool_qty || 1;

      // Generate tools
      for (let i = 1; i <= toolQty; i++) {
        tools.push({
          tool_number: `${soNumber}-${i}`,
          tool_model: orderInfo.tool_model,
        });
      }

      // Parse line items
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(partsSheet, { header: 1, defval: '' });

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !Array.isArray(row)) continue;

        const partNumber = String(row[mapping.partNumber] || '').trim();
        if (!partNumber) continue;

        const description = mapping.description >= 0 ? String(row[mapping.description] || '').trim() : '';
        const location = mapping.location >= 0 ? String(row[mapping.location] || '').trim() : '';
        let qtyPerUnit = mapping.qtyPerUnit >= 0 ? parseQty(row[mapping.qtyPerUnit]) : 1;

        if (qtyPerUnit > 0) {
          lineItems.push({
            part_number: partNumber,
            description: description || undefined,
            location: location || undefined,
            qty_per_unit: qtyPerUnit,
            total_qty_needed: qtyPerUnit * toolQty,
          });
        }
      }
    } else if (otherSheets.length > 0) {
      // Format 3: Order Info + multiple tool type sheets
      let toolCounter = 1;

      for (const sheetName of otherSheets) {
        const sheet = workbook.Sheets[sheetName];
        const toolTypeData = parseToolTypeSheet(sheet, sheetName);

        if (!toolTypeData) {
          warnings.push(`Could not parse sheet "${sheetName}" - skipping`);
          continue;
        }

        // Create tools for this type
        const toolIds: string[] = [];
        for (let i = 0; i < toolTypeData.toolQty; i++) {
          const toolNumber = `${soNumber}-${toolCounter}`;
          const toolId = `temp-${toolNumber}`; // Temporary ID for mapping
          tools.push({
            tool_number: toolNumber,
            tool_model: toolTypeData.toolModel,
          });
          toolIds.push(toolId);
          toolCounter++;
        }

        // Add line items with tool associations
        for (const item of toolTypeData.lineItems) {
          // Check if this part already exists
          const existingItem = lineItems.find(li => li.part_number === item.part_number);

          if (existingItem) {
            // Part exists - add to total and update tool associations
            existingItem.total_qty_needed += item.total_qty_needed;
            const existingToolIds = toolIdMap.get(item.part_number) || [];
            toolIdMap.set(item.part_number, [...existingToolIds, ...toolIds]);
          } else {
            // New part
            lineItems.push(item);
            toolIdMap.set(item.part_number, toolIds);
          }
        }
      }
    } else {
      // Fallback to original single-sheet parsing
      return parseExcelFile(file);
    }

    if (lineItems.length === 0) {
      return { success: false, errors: ['No valid line items found in the file'], warnings };
    }

    if (tools.length === 0) {
      tools.push({ tool_number: `${soNumber}-1` });
    }

    const order: ImportedOrder = {
      so_number: soNumber,
      po_number: orderInfo.po_number,
      customer_name: orderInfo.customer_name,
      order_date: orderInfo.order_date,
      due_date: orderInfo.due_date,
      tools,
      line_items: lineItems,
    };

    return { success: true, order, errors, warnings };

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    };
  }
}
