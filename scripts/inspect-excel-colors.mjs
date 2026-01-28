#!/usr/bin/env node

/**
 * Inspect Excel file for different row colors
 */

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const filePath = process.argv[2] || 'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3548.xlsx';

console.log(`Reading: ${filePath}\n`);

const data = readFileSync(filePath);
const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

// Group rows by color
const colorGroups = new Map();

for (let row = 0; row <= range.e.r; row++) {
  // Check first cell for color
  const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
  const cell = sheet[cellAddress];

  let colorKey = 'no-style';
  let colorInfo = null;

  if (cell && cell.s) {
    if (cell.s.fgColor) {
      colorKey = cell.s.fgColor.rgb || cell.s.fgColor.theme?.toString() || 'themed';
      colorInfo = cell.s.fgColor;
    } else if (cell.s.fill) {
      colorKey = JSON.stringify(cell.s.fill);
      colorInfo = cell.s.fill;
    }
  }

  if (!colorGroups.has(colorKey)) {
    colorGroups.set(colorKey, { rows: [], colorInfo, sample: cell?.v });
  }
  colorGroups.get(colorKey).rows.push(row + 1);
}

console.log('Color groups found:\n');
for (const [color, data] of colorGroups) {
  console.log(`Color: ${color}`);
  console.log(`  Count: ${data.rows.length} rows`);
  console.log(`  Sample: ${data.sample}`);
  console.log(`  Color info: ${JSON.stringify(data.colorInfo)}`);
  console.log(`  Rows: ${data.rows.slice(0, 10).join(', ')}${data.rows.length > 10 ? '...' : ''}`);
  console.log();
}

// Also check column headers for tool columns
console.log('--- Column Headers ---');
const headerRow = 0;
for (let col = 0; col <= range.e.c; col++) {
  const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
  const cell = sheet[cellAddress];
  if (cell && cell.v) {
    console.log(`Col ${col}: ${cell.v}`);
  }
}
