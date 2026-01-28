#!/usr/bin/env node

/**
 * Import picks from SO-3137 and SO-3138 Excel files
 */

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function importPicks(soNumber, filePath, partNumCol, toolColumns) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Importing picks for SO-${soNumber}`);
  console.log('='.repeat(60));

  const data = readFileSync(filePath);
  const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Get order from database
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('so_number', soNumber)
    .single();

  if (!order) {
    console.log(`Order SO-${soNumber} not found in database`);
    return;
  }

  // Get tools from database
  const { data: tools } = await supabase
    .from('tools')
    .select('id, tool_number')
    .eq('order_id', order.id);

  const toolMap = {};
  tools.forEach(t => {
    toolMap[t.tool_number] = t.id;
  });

  console.log('Tools:', Object.keys(toolMap).join(', '));

  // Get line items from database
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('id, part_number')
    .eq('order_id', order.id);

  const lineItemMap = {};
  lineItems.forEach(li => {
    lineItemMap[li.part_number] = li.id;
  });

  console.log(`Line items: ${lineItems.length}`);

  // Build grey rows set to skip
  const greyRows = new Set();
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let row = 0; row <= range.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: partNumCol });
    const cell = sheet[cellAddress];
    if (cell?.s?.fgColor?.rgb === '7F7F7F') {
      greyRows.add(row);
    }
  }

  // Parse picks from Excel
  const picksToInsert = [];
  let skipped = 0;
  let partsWithDiffs = [];

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
    const toolQtys = [];
    for (const [toolNum, colIdx] of Object.entries(toolColumns)) {
      const pickedQty = parseInt(row[colIdx]) || 0;
      toolQtys.push(pickedQty);

      if (pickedQty > 0) {
        const toolId = toolMap[toolNum];
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

    // Track parts with different qtys between tools
    if (toolQtys.some(q => q !== toolQtys[0])) {
      partsWithDiffs.push({ partNumber, toolQtys });
    }
  }

  console.log(`\nPicks to insert: ${picksToInsert.length}`);
  console.log(`Parts skipped (not in DB): ${skipped}`);

  if (partsWithDiffs.length > 0) {
    console.log(`\nParts with different qtys per tool: ${partsWithDiffs.length}`);
    partsWithDiffs.slice(0, 5).forEach(p => {
      console.log(`  ${p.partNumber}: ${p.toolQtys.join(', ')}`);
    });
  }

  if (picksToInsert.length === 0) {
    console.log('\nNo picks to import.');
    return;
  }

  // Show sample
  console.log('\nSample picks:');
  picksToInsert.slice(0, 5).forEach(p => {
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

  console.log(`\n✅ Inserted ${inserted} picks for SO-${soNumber}`);
}

async function main() {
  // SO-3137: Part number at col 1, tools at cols 15, 16, 17
  await importPicks(
    '3137',
    'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3137.xlsx',
    1,
    { '3137-1': 15, '3137-2': 16, '3137-3': 17 }
  );

  // SO-3138: Part number at col 1, tools at cols 10, 11, 12
  await importPicks(
    '3138',
    'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3138.xlsx',
    1,
    { '3138-1': 10, '3138-2': 11, '3138-3': 12 }
  );
}

main().catch(console.error);
