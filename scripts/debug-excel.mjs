#!/usr/bin/env node

/**
 * Debug script to see the structure of Excel files
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCEL_DIR = path.resolve(__dirname, '../../');
const EXCEL_FILES = [
  'SO-3548.xlsx',
];

for (const fileName of EXCEL_FILES) {
  const filePath = path.join(EXCEL_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${fileName}`);
    continue;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`File: ${fileName}`);
  console.log('='.repeat(60));

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  console.log(`\nSheets: ${workbook.SheetNames.join(', ')}`);

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: ''
    });

    // Print first 15 rows
    console.log(`\nFirst 15 rows:`);
    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
      const row = jsonData[i];
      if (row && row.length > 0) {
        console.log(`Row ${i}: ${JSON.stringify(row.slice(0, 10))}`);
      }
    }
  }
}
