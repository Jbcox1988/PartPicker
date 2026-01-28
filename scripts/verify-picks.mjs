#!/usr/bin/env node

/**
 * Show the actual pick values from Excel for each tool
 */

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const filePath = 'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3548.xlsx';

const data = readFileSync(filePath);
const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Column indices
const PART_COL = 0;
const NG1_COL = 8;
const NG2_COL = 9;
const NG3_COL = 10;
const NG4_COL = 11;
const NG5_COL = 12;

// Build grey rows set
const greyRows = new Set();
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
for (let row = 0; row <= range.e.r; row++) {
  const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
  const cell = sheet[cellAddress];
  if (cell?.s?.fgColor?.rgb === '7F7F7F') {
    greyRows.add(row);
  }
}

console.log('Part Number      | NG1 | NG2 | NG3 | NG4 | NG5 | Notes');
console.log('-----------------|-----|-----|-----|-----|-----|------');

let hasDifferences = false;

for (let rowIdx = 1; rowIdx < jsonData.length; rowIdx++) {
  if (greyRows.has(rowIdx)) continue;

  const row = jsonData[rowIdx];
  const partNumber = String(row[PART_COL] || '').trim();
  if (!partNumber) continue;

  const ng1 = parseInt(row[NG1_COL]) || 0;
  const ng2 = parseInt(row[NG2_COL]) || 0;
  const ng3 = parseInt(row[NG3_COL]) || 0;
  const ng4 = parseInt(row[NG4_COL]) || 0;
  const ng5 = parseInt(row[NG5_COL]) || 0;

  // Check if values differ between tools
  const allSame = ng1 === ng2 && ng2 === ng3 && ng3 === ng4 && ng4 === ng5;
  const note = allSame ? '' : '*** DIFFERS ***';

  if (!allSame) {
    hasDifferences = true;
  }

  console.log(
    `${partNumber.padEnd(16)} | ${String(ng1).padStart(3)} | ${String(ng2).padStart(3)} | ${String(ng3).padStart(3)} | ${String(ng4).padStart(3)} | ${String(ng5).padStart(3)} | ${note}`
  );
}

console.log('\n');
if (hasDifferences) {
  console.log('⚠️  Some parts have DIFFERENT quantities between tools!');
} else {
  console.log('✓ All parts have the same quantity for each tool.');
}
