import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { ImportedOrder, ImportedTool, ImportedLineItem, Order, Tool, LineItemWithPicks, Pick, OrderWithProgress } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  async parseEnhancedExcelFile(file: File): Promise<{
    success: boolean;
    order?: ImportedOrder;
    errors: string[];
    warnings: string[];
  }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const errors: string[] = [];
      const warnings: string[] = [];

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          // Check for Order Info sheet
          const orderInfoSheet = workbook.SheetNames.find(
            name => name.toLowerCase().includes('order') || name.toLowerCase().includes('info')
          );

          const partsSheet = workbook.SheetNames.find(
            name => name.toLowerCase() === 'parts' || name.toLowerCase() === 'bom'
          );

          let soNumber = '';
          let poNumber = '';
          let customerName = '';
          let orderDate = '';
          let dueDate = '';
          let toolQty = 1;
          let toolModel = '';

          // Parse Order Info sheet if exists
          if (orderInfoSheet) {
            const sheet = workbook.Sheets[orderInfoSheet];
            const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

            for (const row of json) {
              if (!row || row.length < 2) continue;
              const label = String(row[0] || '').toLowerCase().trim();
              const value = row[1];

              if (label.includes('so') && label.includes('number')) {
                soNumber = String(value || '').trim();
              } else if (label.includes('po') && label.includes('number')) {
                poNumber = String(value || '').trim();
              } else if (label.includes('customer')) {
                customerName = String(value || '').trim();
              } else if (label.includes('order') && label.includes('date')) {
                orderDate = this.parseDate(value);
              } else if (label.includes('due') && label.includes('date')) {
                dueDate = this.parseDate(value);
              } else if (label.includes('tool') && label.includes('qty')) {
                toolQty = parseInt(String(value || '1'), 10) || 1;
              } else if (label.includes('model')) {
                toolModel = String(value || '').trim();
              }
            }
          }

          // Extract SO number from filename if not found
          if (!soNumber) {
            const match = file.name.match(/SO[-_]?(\d+)/i);
            if (match) {
              soNumber = match[1];
            } else {
              errors.push('Could not determine SO number');
              resolve({ success: false, errors, warnings });
              return;
            }
          }

          // Generate tools
          const tools: ImportedTool[] = [];
          for (let i = 1; i <= toolQty; i++) {
            tools.push({
              tool_number: `${soNumber}-${i}`,
              tool_model: toolModel || undefined,
            });
          }

          // Parse Parts sheet
          const lineItems: ImportedLineItem[] = [];

          if (partsSheet) {
            const sheet = workbook.Sheets[partsSheet];
            const json = XLSX.utils.sheet_to_json<any>(sheet);

            for (const row of json) {
              const partNumber = this.findValue(row, ['part', 'part number', 'part_number', 'partnumber', 'pn']);
              if (!partNumber) continue;

              const description = this.findValue(row, ['description', 'desc', 'name']);
              const location = this.findValue(row, ['location', 'loc', 'bin', 'position']);
              const qtyPerUnit = parseInt(this.findValue(row, ['qty', 'quantity', 'qty/unit', 'qty_per_unit']) || '1', 10) || 1;

              lineItems.push({
                part_number: String(partNumber).trim(),
                description: description ? String(description).trim() : undefined,
                location: location ? String(location).trim() : undefined,
                qty_per_unit: qtyPerUnit,
                total_qty_needed: qtyPerUnit * toolQty,
              });
            }
          } else {
            // Try first sheet as parts sheet
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<any>(firstSheet);

            for (const row of json) {
              const partNumber = this.findValue(row, ['part', 'part number', 'part_number', 'partnumber', 'pn']);
              if (!partNumber) continue;

              const description = this.findValue(row, ['description', 'desc', 'name']);
              const location = this.findValue(row, ['location', 'loc', 'bin', 'position']);
              const qtyPerUnit = parseInt(this.findValue(row, ['qty', 'quantity', 'qty/unit', 'qty_per_unit']) || '1', 10) || 1;

              lineItems.push({
                part_number: String(partNumber).trim(),
                description: description ? String(description).trim() : undefined,
                location: location ? String(location).trim() : undefined,
                qty_per_unit: qtyPerUnit,
                total_qty_needed: qtyPerUnit * toolQty,
              });
            }
          }

          if (lineItems.length === 0) {
            warnings.push('No line items found in the file');
          }

          const order: ImportedOrder = {
            so_number: soNumber,
            po_number: poNumber || undefined,
            customer_name: customerName || undefined,
            order_date: orderDate || undefined,
            due_date: dueDate || undefined,
            tools,
            line_items: lineItems,
          };

          resolve({ success: true, order, errors, warnings });
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'Failed to parse Excel file');
          resolve({ success: false, errors, warnings });
        }
      };

      reader.onerror = () => {
        errors.push('Failed to read file');
        resolve({ success: false, errors, warnings });
      };

      reader.readAsArrayBuffer(file);
    });
  }

  async parseCsvFile(file: File): Promise<{
    success: boolean;
    order?: ImportedOrder;
    errors: string[];
    warnings: string[];
  }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const errors: string[] = [];
      const warnings: string[] = [];

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const workbook = XLSX.read(text, { type: 'string' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<any>(sheet);

          // Extract SO number from filename
          const match = file.name.match(/SO[-_]?(\d+)/i);
          const soNumber = match ? match[1] : 'Unknown';

          if (soNumber === 'Unknown') {
            warnings.push('Could not determine SO number from filename');
          }

          const lineItems: ImportedLineItem[] = [];

          for (const row of json) {
            const partNumber = this.findValue(row, ['part', 'part number', 'part_number', 'partnumber', 'pn']);
            if (!partNumber) continue;

            const description = this.findValue(row, ['description', 'desc', 'name']);
            const location = this.findValue(row, ['location', 'loc', 'bin', 'position']);
            const qtyPerUnit = parseInt(this.findValue(row, ['qty', 'quantity', 'qty/unit', 'qty_per_unit']) || '1', 10) || 1;

            lineItems.push({
              part_number: String(partNumber).trim(),
              description: description ? String(description).trim() : undefined,
              location: location ? String(location).trim() : undefined,
              qty_per_unit: qtyPerUnit,
              total_qty_needed: qtyPerUnit,
            });
          }

          const order: ImportedOrder = {
            so_number: soNumber,
            tools: [{ tool_number: `${soNumber}-1` }],
            line_items: lineItems,
          };

          resolve({ success: true, order, errors, warnings });
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'Failed to parse CSV file');
          resolve({ success: false, errors, warnings });
        }
      };

      reader.onerror = () => {
        errors.push('Failed to read file');
        resolve({ success: false, errors, warnings });
      };

      reader.readAsText(file);
    });
  }

  exportOrderToExcel(order: Order, tools: Tool[], lineItems: LineItemWithPicks[], picks: Pick[]): void {
    const workbook = XLSX.utils.book_new();

    // Order Info sheet
    const orderInfo = [
      ['SO Number', order.so_number],
      ['PO Number', order.po_number || ''],
      ['Customer', order.customer_name || ''],
      ['Order Date', order.order_date || ''],
      ['Due Date', order.due_date || ''],
      ['Status', order.status],
      ['Notes', order.notes || ''],
    ];
    const orderInfoSheet = XLSX.utils.aoa_to_sheet(orderInfo);
    XLSX.utils.book_append_sheet(workbook, orderInfoSheet, 'Order Info');

    // Parts sheet
    const partsHeader = ['Part Number', 'Description', 'Location', 'Qty/Unit', 'Total Needed', 'Total Picked', 'Remaining'];
    const partsData = lineItems.map(item => [
      item.part_number,
      item.description || '',
      item.location || '',
      item.qty_per_unit,
      item.total_qty_needed,
      item.total_picked,
      item.remaining,
    ]);
    const partsSheet = XLSX.utils.aoa_to_sheet([partsHeader, ...partsData]);
    XLSX.utils.book_append_sheet(workbook, partsSheet, 'Parts');

    // Tools sheet
    const toolsHeader = ['Tool Number', 'Serial Number', 'Status'];
    const toolsData = tools.map(tool => [
      tool.tool_number,
      tool.serial_number || '',
      tool.status,
    ]);
    const toolsSheet = XLSX.utils.aoa_to_sheet([toolsHeader, ...toolsData]);
    XLSX.utils.book_append_sheet(workbook, toolsSheet, 'Tools');

    // Download
    XLSX.writeFile(workbook, `SO-${order.so_number}.xlsx`);
  }

  exportOrdersSummaryToExcel(orders: OrderWithProgress[]): void {
    const workbook = XLSX.utils.book_new();

    const header = ['SO Number', 'PO Number', 'Customer', 'Status', 'Tools', 'Total Parts', 'Picked', 'Progress %', 'Order Date', 'Due Date'];
    const data = orders.map(order => [
      order.so_number,
      order.po_number || '',
      order.customer_name || '',
      order.status,
      order.tools.length,
      order.total_items,
      order.picked_items,
      order.progress_percent,
      order.order_date || '',
      order.due_date || '',
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');

    XLSX.writeFile(workbook, `Orders-Export-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  downloadImportTemplate(type: 'single' | 'multi' = 'single'): void {
    const workbook = XLSX.utils.book_new();

    // Order Info sheet
    const orderInfo = [
      ['SO Number', '3137'],
      ['PO Number', 'PO-12345'],
      ['Customer', 'ACME Corp'],
      ['Order Date', new Date().toISOString().split('T')[0]],
      ['Due Date', ''],
      ['Tool Qty', type === 'single' ? '5' : ''],
      ['Tool Model', '230Q'],
    ];
    const orderInfoSheet = XLSX.utils.aoa_to_sheet(orderInfo);
    XLSX.utils.book_append_sheet(workbook, orderInfoSheet, 'Order Info');

    // Parts sheet
    const partsHeader = ['Part Number', 'Description', 'Location', 'Qty/Unit'];
    const partsData = [
      ['PART-001', 'Widget Assembly', 'A1-01', '1'],
      ['PART-002', 'Bracket Kit', 'B2-15', '2'],
      ['PART-003', 'Fastener Set', 'C3-08', '4'],
    ];
    const partsSheet = XLSX.utils.aoa_to_sheet([partsHeader, ...partsData]);
    XLSX.utils.book_append_sheet(workbook, partsSheet, 'Parts');

    XLSX.writeFile(workbook, `Import-Template-${type}.xlsx`);
  }

  private findValue(row: any, keys: string[]): string | undefined {
    for (const key of keys) {
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toLowerCase().includes(key.toLowerCase())) {
          return row[rowKey];
        }
      }
    }
    return undefined;
  }

  private parseDate(value: any): string {
    if (!value) return '';
    if (typeof value === 'number') {
      // Excel date serial number
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return '';
  }
}
