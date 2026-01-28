#!/usr/bin/env node

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const filePath = 'C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3317.xlsx';

const data = readFileSync(filePath);
const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('All header columns:');
const headerRow = jsonData[0];
headerRow.forEach((col, idx) => {
  console.log(`  Col ${idx}: "${col}"`);
});

console.log('\n\nFirst 10 data rows:');
for (let i = 1; i <= 10 && i < jsonData.length; i++) {
  const row = jsonData[i];
  console.log(`Row ${i}: ${row.slice(0, 10).join(' | ')}`);
}
