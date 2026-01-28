#!/usr/bin/env node

/**
 * Inspect an Excel file to see row colors/styles
 */

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const filePath = process.argv[2] || 'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3548.xlsx';

console.log(`Reading: ${filePath}\n`);

const data = readFileSync(filePath);
const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get the range
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

console.log(`Sheet: ${sheetName}`);
console.log(`Range: ${sheet['!ref']}`);
console.log(`Rows: ${range.e.r + 1}`);
console.log(`\n--- First 20 rows with cell info ---\n`);

for (let row = 0; row <= Math.min(20, range.e.r); row++) {
  const rowData = [];
  let hasStyle = false;
  let styleInfo = '';

  for (let col = 0; col <= Math.min(5, range.e.c); col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet[cellAddress];

    if (cell) {
      rowData.push(String(cell.v || '').substring(0, 15));

      // Check for style
      if (cell.s) {
        hasStyle = true;
        if (cell.s.fgColor || cell.s.bgColor || cell.s.fill) {
          styleInfo = JSON.stringify(cell.s);
        }
      }
    } else {
      rowData.push('');
    }
  }

  const prefix = hasStyle ? '[STYLED] ' : '         ';
  console.log(`Row ${row + 1}: ${prefix}${rowData.join(' | ')}`);
  if (styleInfo) {
    console.log(`         Style: ${styleInfo}`);
  }
}

// Also dump raw JSON for inspection
const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('\n--- All rows (part numbers only) ---\n');
jsonData.forEach((row, idx) => {
  if (row[0]) {
    console.log(`Row ${idx + 1}: ${row[0]}`);
  }
});
