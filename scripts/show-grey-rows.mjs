#!/usr/bin/env node

/**
 * Show the grey rows in the Excel file
 */

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const filePath = 'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3548.xlsx';

const data = readFileSync(filePath);
const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

// Find grey rows (color 7F7F7F)
const greyRows = [];

for (let row = 0; row <= range.e.r; row++) {
  const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
  const cell = sheet[cellAddress];

  if (cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb === '7F7F7F') {
    const rowData = jsonData[row];
    greyRows.push({
      row: row + 1,
      partNumber: rowData[0],
      description: rowData[1],
      location: rowData[2],
      qtyEa: rowData[3],
      totalQty: rowData[4]
    });
  }
}

console.log('Grey rows to remove from SO-3548:\n');
console.log('Row | Part Number | Description | Location');
console.log('----|-------------|-------------|----------');
greyRows.forEach(r => {
  console.log(`${r.row.toString().padStart(3)} | ${r.partNumber.toString().padEnd(11)} | ${(r.description || '').toString().substring(0, 20).padEnd(20)} | ${r.location || ''}`);
});

console.log(`\nTotal grey rows: ${greyRows.length}`);
console.log('\nPart numbers to delete:');
greyRows.forEach(r => console.log(`  - ${r.partNumber}`));
