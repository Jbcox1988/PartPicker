#!/usr/bin/env node

/**
 * Import existing SO Excel files into Supabase
 * Usage: node scripts/import-excel.mjs
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Excel files to import (parent directory)
const EXCEL_DIR = path.resolve(__dirname, '../../');
const EXCEL_FILES = [
  'SO-3137.xlsx',
  'SO-3138.xlsx',
  'SO-3317.xlsx',
  'SO-3444.xlsx',
  'SO-3548.xlsx',
];

/**
 * Parse a cell value as a quantity number
 */
function parseQty(value) {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num));
  }
  return 0;
}

/**
 * Detect column positions in the spreadsheet
 */
function detectColumns(data) {
  const defaultMapping = {
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

    const mapping = { ...defaultMapping, toolColumns: new Map() };

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
        let toolNum;
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
function extractTools(headerRow, mapping) {
  const tools = [];

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
 * Parse an Excel file and return structured order data
 */
function parseExcelFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\nParsing ${fileName}...`);

  const errors = [];
  const warnings = [];

  try {
    // Read file as buffer and parse
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, errors: ['No sheets found in workbook'], warnings };
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: ''
    });

    if (jsonData.length < 2) {
      return { success: false, errors: ['Sheet has no data rows'], warnings };
    }

    // Extract SO number from filename (e.g., "SO-3137.xlsx" -> "3137")
    const soMatch = fileName.match(/SO[- ]?(\d+)/i);
    const soNumber = soMatch ? soMatch[1] : fileName.replace(/\.xlsx?$/i, '');

    // Find header row and detect column mapping
    const { headerRowIndex, mapping } = detectColumns(jsonData);

    if (headerRowIndex === -1) {
      return {
        success: false,
        errors: ['Could not find header row with Part Number column'],
        warnings
      };
    }

    console.log(`  Found header at row ${headerRowIndex + 1}`);
    console.log(`  Column mapping: Part#=${mapping.partNumber}, Desc=${mapping.description}, Loc=${mapping.location}`);
    console.log(`  Tool columns: ${Array.from(mapping.toolColumns.entries()).map(([k,v]) => `${k}@${v}`).join(', ') || 'none'}`);

    // Extract tools from column headers
    const tools = extractTools(jsonData[headerRowIndex], mapping);

    // Parse line items
    const lineItems = [];

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !Array.isArray(row)) continue;

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

      // Get qty per unit (from first tool column or dedicated column)
      let qtyPerUnit = 0;
      if (mapping.qtyPerUnit >= 0) {
        qtyPerUnit = parseQty(row[mapping.qtyPerUnit]);
      } else if (mapping.toolColumns.size > 0) {
        // Use first tool's qty as qty per unit
        const firstToolCol = mapping.toolColumns.values().next().value;
        if (firstToolCol !== undefined) {
          qtyPerUnit = parseQty(row[firstToolCol]);
        }
      }

      // Calculate total qty needed
      let totalQty = 0;
      if (mapping.totalQty >= 0) {
        totalQty = parseQty(row[mapping.totalQty]);
      } else {
        // Sum all tool columns
        for (const colIdx of mapping.toolColumns.values()) {
          totalQty += parseQty(row[colIdx]);
        }
      }

      // If we still don't have totals, use qty per unit * tool count
      if (totalQty === 0 && qtyPerUnit > 0) {
        totalQty = qtyPerUnit * Math.max(tools.length, 1);
      }

      if (qtyPerUnit === 0 && totalQty > 0) {
        qtyPerUnit = Math.ceil(totalQty / Math.max(tools.length, 1));
      }

      if (qtyPerUnit > 0 || totalQty > 0) {
        lineItems.push({
          part_number: partNumber,
          description: description || null,
          location: location || null,
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

    console.log(`  Found ${finalTools.length} tool(s): ${finalTools.map(t => t.tool_number).join(', ')}`);
    console.log(`  Found ${lineItems.length} line item(s)`);

    return {
      success: true,
      order: {
        so_number: soNumber,
        tools: finalTools,
        line_items: lineItems,
      },
      errors,
      warnings
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to parse Excel file: ${error.message}`],
      warnings
    };
  }
}

/**
 * Import a parsed order into Supabase
 */
async function importOrder(orderData) {
  const { so_number, tools, line_items } = orderData;

  console.log(`\nImporting SO-${so_number} to Supabase...`);

  // Check if order already exists
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('so_number', so_number)
    .single();

  if (existingOrder) {
    console.log(`  Order SO-${so_number} already exists (id: ${existingOrder.id}), skipping...`);
    return { success: true, skipped: true };
  }

  // Create the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      so_number,
      status: 'active',
    })
    .select()
    .single();

  if (orderError) {
    console.error(`  Failed to create order: ${orderError.message}`);
    return { success: false, error: orderError.message };
  }

  console.log(`  Created order with id: ${order.id}`);

  // Create tools
  const toolsToInsert = tools.map(t => ({
    order_id: order.id,
    tool_number: t.tool_number,
    serial_number: t.serial_number || null,
    status: 'pending',
  }));

  const { data: insertedTools, error: toolsError } = await supabase
    .from('tools')
    .insert(toolsToInsert)
    .select();

  if (toolsError) {
    console.error(`  Failed to create tools: ${toolsError.message}`);
    return { success: false, error: toolsError.message };
  }

  console.log(`  Created ${insertedTools.length} tool(s)`);

  // Create line items
  const lineItemsToInsert = line_items.map(li => ({
    order_id: order.id,
    part_number: li.part_number,
    description: li.description,
    location: li.location,
    qty_per_unit: li.qty_per_unit,
    total_qty_needed: li.total_qty_needed,
  }));

  const { data: insertedLineItems, error: lineItemsError } = await supabase
    .from('line_items')
    .insert(lineItemsToInsert)
    .select();

  if (lineItemsError) {
    console.error(`  Failed to create line items: ${lineItemsError.message}`);
    return { success: false, error: lineItemsError.message };
  }

  console.log(`  Created ${insertedLineItems.length} line item(s)`);

  return { success: true, orderId: order.id };
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Excel Import Script for Tool Pick List Tracker');
  console.log('='.repeat(60));
  console.log(`\nLooking for Excel files in: ${EXCEL_DIR}`);

  const results = {
    success: [],
    skipped: [],
    failed: [],
  };

  for (const fileName of EXCEL_FILES) {
    const filePath = path.join(EXCEL_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`\n[SKIP] ${fileName} - File not found`);
      results.failed.push({ file: fileName, error: 'File not found' });
      continue;
    }

    // Parse the Excel file
    const parseResult = parseExcelFile(filePath);

    if (!parseResult.success) {
      console.log(`  [ERROR] ${parseResult.errors.join(', ')}`);
      results.failed.push({ file: fileName, error: parseResult.errors.join(', ') });
      continue;
    }

    // Import to Supabase
    const importResult = await importOrder(parseResult.order);

    if (!importResult.success) {
      results.failed.push({ file: fileName, error: importResult.error });
    } else if (importResult.skipped) {
      results.skipped.push(fileName);
    } else {
      results.success.push(fileName);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Import Summary');
  console.log('='.repeat(60));
  console.log(`\nSuccessfully imported: ${results.success.length}`);
  results.success.forEach(f => console.log(`  ✓ ${f}`));

  console.log(`\nSkipped (already exists): ${results.skipped.length}`);
  results.skipped.forEach(f => console.log(`  - ${f}`));

  console.log(`\nFailed: ${results.failed.length}`);
  results.failed.forEach(f => console.log(`  ✗ ${f.file}: ${f.error}`));

  console.log('\nDone!');
}

main().catch(console.error);
