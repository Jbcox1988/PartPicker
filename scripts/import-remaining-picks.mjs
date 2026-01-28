#!/usr/bin/env node

/**
 * Import picks from SO-3317 and SO-3444
 */

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function importPicks(soNumber, filePath, partNumCol, toolColumnMapping) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Importing picks for SO-${soNumber}`);
  console.log('='.repeat(50));

  const data = readFileSync(filePath);
  const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Show headers for debugging
  console.log('Header columns with data:');
  jsonData[0].forEach((col, idx) => {
    if (col) console.log(`  ${idx}: "${col}"`);
  });

  // Get order from database
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('so_number', soNumber)
    .single();

  if (!order) {
    console.log(`Order not found in database`);
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

  console.log('\nTools in DB:', Object.keys(toolMap).join(', '));

  // Get line items
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('id, part_number')
    .eq('order_id', order.id);

  const lineItemMap = {};
  lineItems.forEach(li => {
    lineItemMap[li.part_number] = li.id;
  });

  console.log(`Line items: ${lineItems.length}`);

  // Build grey rows set
  const greyRows = new Set();
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let row = 0; row <= range.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: partNumCol });
    const cell = sheet[cellAddress];
    if (cell?.s?.fgColor?.rgb === '7F7F7F') {
      greyRows.add(row);
    }
  }

  // Parse picks
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

    // Check each tool column
    for (const [dbToolName, excelColIdx] of Object.entries(toolColumnMapping)) {
      const pickedQty = parseInt(row[excelColIdx]) || 0;

      if (pickedQty > 0) {
        const toolId = toolMap[dbToolName];
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
  console.log(`Parts skipped: ${skipped}`);

  if (picksToInsert.length === 0) {
    console.log('No picks to import.');
    return;
  }

  // Sample
  console.log('\nSample picks:');
  picksToInsert.slice(0, 5).forEach(p => {
    const toolNum = Object.entries(toolMap).find(([, id]) => id === p.tool_id)?.[0];
    const partNum = Object.entries(lineItemMap).find(([, id]) => id === p.line_item_id)?.[0];
    console.log(`  ${partNum} - ${toolNum}: ${p.qty_picked}`);
  });

  // Insert
  console.log('\nInserting...');
  let inserted = 0;
  const batchSize = 50;

  for (let i = 0; i < picksToInsert.length; i += batchSize) {
    const batch = picksToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('picks').insert(batch);
    if (!error) inserted += batch.length;
  }

  console.log(`✅ Inserted ${inserted} picks`);
}

async function main() {
  // SO-3317: "Tink 1" column at index 4 maps to tool "3317-1"
  await importPicks(
    '3317',
    'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3317.xlsx',
    0,  // REF_PN at column 0
    { '3317-1': 4 }  // "Tink 1" column
  );

  // SO-3444: Need to check the structure first
  console.log('\n\nInspecting SO-3444...');
  const data3444 = readFileSync('C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3444.xlsx');
  const wb3444 = XLSX.read(data3444, { type: 'buffer' });
  const sheet3444 = wb3444.Sheets[wb3444.SheetNames[0]];
  const json3444 = XLSX.utils.sheet_to_json(sheet3444, { header: 1, defval: '' });

  console.log('SO-3444 headers:');
  json3444[0].forEach((col, idx) => {
    if (col) console.log(`  ${idx}: "${col}"`);
  });

  console.log('\nFirst 3 data rows:');
  for (let i = 1; i <= 3; i++) {
    console.log(`  Row ${i}: ${json3444[i].slice(0, 10).join(' | ')}`);
  }

  // Find PT1 column
  const pt1Col = json3444[0].findIndex(col => String(col).toUpperCase() === 'PT1');
  console.log(`\nPT1 column index: ${pt1Col}`);

  if (pt1Col >= 0) {
    await importPicks(
      '3444',
      'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3444.xlsx',
      0,  // Part number column
      { 'PT1': pt1Col }
    );
  }
}

main().catch(console.error);
