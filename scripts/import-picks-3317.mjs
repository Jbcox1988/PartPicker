#!/usr/bin/env node

/**
 * Import picks from SO-3317 Excel file
 */

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const filePath = 'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3317.xlsx';

async function inspectAndImport() {
  console.log('Reading SO-3317 Excel file...\n');

  const data = readFileSync(filePath);
  const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Show header row
  const headerRow = jsonData[0];
  console.log('Header columns:');
  headerRow.forEach((col, idx) => {
    if (col) console.log(`  ${idx}: ${col}`);
  });

  // Find tool columns (look for patterns like "3317-1", "Tool 1", "SN1", etc.)
  const toolColumns = {};
  headerRow.forEach((col, idx) => {
    const colStr = String(col).trim();
    // Match patterns like "3317-1", "3317-2" or letter+number like "NG1"
    if (/^\d+-\d+$/.test(colStr) || /^[A-Z]{1,3}\d+$/i.test(colStr)) {
      toolColumns[colStr] = idx;
    }
  });

  console.log('\nTool columns found:', toolColumns);

  // Find part number column
  let partNumCol = -1;
  for (let i = 0; i < headerRow.length; i++) {
    const col = String(headerRow[i]).toLowerCase();
    if (col.includes('ref_pn') || col.includes('part') || col === 'pn') {
      partNumCol = i;
      break;
    }
  }
  console.log('Part number column:', partNumCol);

  // Check if order exists in database
  const { data: order } = await supabase
    .from('orders')
    .select('id, so_number')
    .eq('so_number', '3317')
    .single();

  if (!order) {
    console.log('\n⚠️  Order SO-3317 not found in database. Need to import the order first.');
    return;
  }

  console.log(`\nOrder found: ${order.id}`);

  // Get tools from database
  const { data: tools } = await supabase
    .from('tools')
    .select('id, tool_number')
    .eq('order_id', order.id);

  console.log('Tools in database:', tools?.map(t => t.tool_number) || 'none');

  if (!tools || tools.length === 0) {
    console.log('\n⚠️  No tools found for this order.');
    return;
  }

  const toolMap = {};
  tools.forEach(t => {
    toolMap[t.tool_number.toUpperCase()] = t.id;
  });

  // Get line items from database
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('id, part_number')
    .eq('order_id', order.id);

  console.log(`Line items in database: ${lineItems?.length || 0}`);

  if (!lineItems || lineItems.length === 0) {
    console.log('\n⚠️  No line items found for this order.');
    return;
  }

  const lineItemMap = {};
  lineItems.forEach(li => {
    lineItemMap[li.part_number] = li.id;
  });

  // Build grey rows set to skip
  const greyRows = new Set();
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let row = 0; row <= range.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
    const cell = sheet[cellAddress];
    if (cell?.s?.fgColor?.rgb === '7F7F7F') {
      greyRows.add(row);
    }
  }

  // Parse picks from Excel
  const picksToInsert = [];
  let skipped = 0;

  for (let rowIdx = 1; rowIdx < jsonData.length; rowIdx++) {
    if (greyRows.has(rowIdx)) continue;

    const row = jsonData[rowIdx];
    const partNumber = String(row[partNumCol] || '').trim();
    if (!partNumber) continue;

    const lineItemId = lineItemMap[partNumber];
    if (!lineItemId) {
      skipped++;
      continue;
    }

    // Check each tool column for picks
    for (const [toolNum, colIdx] of Object.entries(toolColumns)) {
      const pickedQty = parseInt(row[colIdx]) || 0;

      if (pickedQty > 0) {
        const toolId = toolMap[toolNum.toUpperCase()];
        if (toolId) {
          picksToInsert.push({
            line_item_id: lineItemId,
            tool_id: toolId,
            qty_picked: pickedQty,
            picked_by: 'Excel Import',
            notes: 'Imported from spreadsheet'
          });
        }
      }
    }
  }

  console.log(`\nPicks to insert: ${picksToInsert.length}`);
  console.log(`Parts skipped (not in DB): ${skipped}`);

  if (picksToInsert.length === 0) {
    console.log('\nNo picks to import.');
    return;
  }

  // Show sample
  console.log('\nSample picks:');
  picksToInsert.slice(0, 10).forEach(p => {
    const toolNum = Object.entries(toolMap).find(([, id]) => id === p.tool_id)?.[0];
    const partNum = Object.entries(lineItemMap).find(([, id]) => id === p.line_item_id)?.[0];
    console.log(`  ${partNum} - ${toolNum}: ${p.qty_picked}`);
  });

  console.log('\nInserting picks...');

  // Insert in batches
  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < picksToInsert.length; i += batchSize) {
    const batch = picksToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('picks').insert(batch);

    if (error) {
      console.error(`Error inserting batch:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\n✅ Inserted ${inserted} picks for SO-3317`);
}

inspectAndImport().catch(console.error);
