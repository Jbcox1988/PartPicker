#!/usr/bin/env node

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

function inspectFile(filePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FILE: ${filePath}`);
  console.log('='.repeat(60));

  const data = readFileSync(filePath);
  const workbook = XLSX.read(data, { type: 'buffer', cellStyles: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log('\nHeader columns:');
  const headerRow = jsonData[0];
  headerRow.forEach((col, idx) => {
    if (col) console.log(`  Col ${idx}: "${col}"`);
  });

  console.log('\nFirst 5 data rows:');
  for (let i = 1; i <= 5 && i < jsonData.length; i++) {
    const row = jsonData[i];
    console.log(`Row ${i}: ${row.slice(0, 12).join(' | ')}`);
  }
}

inspectFile('C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3137.xlsx');
inspectFile('C:\\Users\\JoshCox\\OneDrive - CORVAER\\Documents\\Tool Pick Lists\\SO-3138.xlsx');
