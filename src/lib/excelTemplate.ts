import * as XLSX from 'xlsx';

/**
 * Generate and download an Excel template for importing orders
 */
export function downloadImportTemplate(format: 'single' | 'multi' = 'single') {
  const workbook = XLSX.utils.book_new();

  if (format === 'single') {
    // Single tool type format
    createSingleToolTypeTemplate(workbook);
  } else {
    // Multiple tool types format
    createMultiToolTypeTemplate(workbook);
  }

  // Create Instructions sheet
  createInstructionsSheet(workbook);

  // Download
  const filename = format === 'single'
    ? 'order-template-single.xlsx'
    : 'order-template-multi.xlsx';
  XLSX.writeFile(workbook, filename);
}

function createSingleToolTypeTemplate(workbook: XLSX.WorkBook) {
  // Order Info sheet
  const orderInfoData = [
    ['Order Information', ''],
    ['', ''],
    ['SO Number', '3137'],
    ['PO Number', 'PO-12345'],
    ['Customer', 'ACME Corporation'],
    ['Tool Qty', '5'],
    ['Tool Model', '230Q'],
    ['Order Date', '2024-01-15'],
    ['Due Date', '2024-02-15'],
  ];
  const orderInfoSheet = XLSX.utils.aoa_to_sheet(orderInfoData);
  XLSX.utils.book_append_sheet(workbook, orderInfoSheet, 'Order Info');

  // Parts sheet
  const partsData = [
    ['Part Number', 'Description', 'Location', 'Qty/Unit'],
    ['ABC-123', 'Widget Assembly', 'A-01', 2],
    ['DEF-456', 'Spring Kit', 'B-02', 1],
    ['GHI-789', 'Gasket Set', 'C-03', 4],
    ['JKL-012', 'Bearing Pack', 'A-05', 2],
    ['MNO-345', 'Seal Ring', 'D-01', 3],
  ];
  const partsSheet = XLSX.utils.aoa_to_sheet(partsData);

  // Set column widths
  partsSheet['!cols'] = [
    { wch: 15 }, // Part Number
    { wch: 30 }, // Description
    { wch: 12 }, // Location
    { wch: 10 }, // Qty/Unit
  ];

  XLSX.utils.book_append_sheet(workbook, partsSheet, 'Parts');
}

function createMultiToolTypeTemplate(workbook: XLSX.WorkBook) {
  // Order Info sheet
  const orderInfoData = [
    ['Order Information', ''],
    ['', ''],
    ['SO Number', '3137'],
    ['PO Number', 'PO-12345'],
    ['Customer', 'ACME Corporation'],
    ['Order Date', '2024-01-15'],
    ['Due Date', '2024-02-15'],
    ['', ''],
    ['Note: Each additional sheet represents a tool type with its own BOM', ''],
  ];
  const orderInfoSheet = XLSX.utils.aoa_to_sheet(orderInfoData);
  XLSX.utils.book_append_sheet(workbook, orderInfoSheet, 'Order Info');

  // 230Q Tool Type sheet
  const tool230QData = [
    ['Qty', 'Part Number', 'Description', 'Location', 'Qty/Unit'],
    [2, 'ABC-123', 'Widget Assembly', 'A-01', 2],
    ['', 'DEF-456', '230Q Spring Kit', 'B-02', 1],
    ['', 'GHI-789', '230Q Gasket Set', 'C-03', 4],
    ['', 'QRS-230', '230Q Specific Part', 'E-01', 1],
  ];
  const tool230QSheet = XLSX.utils.aoa_to_sheet(tool230QData);
  tool230QSheet['!cols'] = [
    { wch: 6 },  // Qty
    { wch: 15 }, // Part Number
    { wch: 30 }, // Description
    { wch: 12 }, // Location
    { wch: 10 }, // Qty/Unit
  ];
  XLSX.utils.book_append_sheet(workbook, tool230QSheet, '230Q');

  // 450Q Tool Type sheet
  const tool450QData = [
    ['Qty', 'Part Number', 'Description', 'Location', 'Qty/Unit'],
    [1, 'ABC-123', 'Widget Assembly', 'A-01', 2],
    ['', 'TUV-450', '450Q Spring Kit', 'B-05', 1],
    ['', 'WXY-450', '450Q Gasket Set', 'C-08', 4],
    ['', 'ZAB-450', '450Q Specific Part', 'F-01', 2],
  ];
  const tool450QSheet = XLSX.utils.aoa_to_sheet(tool450QData);
  tool450QSheet['!cols'] = [
    { wch: 6 },  // Qty
    { wch: 15 }, // Part Number
    { wch: 30 }, // Description
    { wch: 12 }, // Location
    { wch: 10 }, // Qty/Unit
  ];
  XLSX.utils.book_append_sheet(workbook, tool450QSheet, '450Q');
}

function createInstructionsSheet(workbook: XLSX.WorkBook) {
  const instructionsData = [
    ['Import Template Instructions'],
    [''],
    ['SINGLE TOOL TYPE FORMAT'],
    ['========================='],
    ['Use this format when all tools in the order have the same parts list.'],
    [''],
    ['Order Info Sheet:'],
    ['- SO Number: Sales order number (required)'],
    ['- PO Number: Customer purchase order number (optional)'],
    ['- Customer: Customer name (optional)'],
    ['- Tool Qty: Number of tools to create (default: 1)'],
    ['- Tool Model: Model name for all tools (optional)'],
    ['- Order Date: Order date in YYYY-MM-DD format (optional)'],
    ['- Due Date: Due date in YYYY-MM-DD format (optional)'],
    [''],
    ['Parts Sheet:'],
    ['- Part Number: Part number (required)'],
    ['- Description: Part description (optional)'],
    ['- Location: Bin/location code (optional)'],
    ['- Qty/Unit: Quantity needed per tool (required)'],
    [''],
    [''],
    ['MULTIPLE TOOL TYPES FORMAT'],
    ['==========================='],
    ['Use this format when tools in the order have different parts lists.'],
    [''],
    ['Order Info Sheet:'],
    ['- Same as single format, but no Tool Qty or Tool Model fields'],
    [''],
    ['Tool Type Sheets (e.g., "230Q", "450Q"):'],
    ['- Sheet name becomes the tool model'],
    ['- First column "Qty" in first data row = number of tools of this type'],
    ['- Part Number: Part number (required)'],
    ['- Description: Part description (optional)'],
    ['- Location: Bin/location code (optional)'],
    ['- Qty/Unit: Quantity needed per tool (required)'],
    [''],
    ['Example: Sheet "230Q" with Qty=2 creates tools 3137-1 and 3137-2'],
    ['         Sheet "450Q" with Qty=1 creates tool 3137-3'],
    [''],
    [''],
    ['LEGACY FORMAT'],
    ['============='],
    ['The importer also supports the legacy format with tool columns:'],
    ['- Single sheet with Part Number, Description, Location columns'],
    ['- Tool-specific columns like "3137-1", "3137-2" for quantities'],
    ['- Tools are created based on column headers'],
    [''],
    [''],
    ['TIPS'],
    ['===='],
    ['- Delete this Instructions sheet before importing (optional)'],
    ['- Part numbers are used to match parts across tool types'],
    ['- Parts with the same part number will be combined'],
    ['- Grey rows in Excel files are automatically skipped'],
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
}
