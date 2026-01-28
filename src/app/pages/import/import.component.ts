import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrdersService } from '../../services/orders.service';
import { ExcelService } from '../../services/excel.service';
import { ImportedOrder } from '../../models';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div>
      <div class="mb-4">
        <h1 class="h3 fw-bold mb-1">Import Order</h1>
        <p class="text-muted mb-0">Upload an Excel or CSV file to import a sales order</p>
      </div>

      <!-- Drop Zone -->
      <div class="card mb-4" *ngIf="!parseResult">
        <div class="card-body">
          <div class="dropzone"
               [class.dragover]="isDragging"
               (drop)="onDrop($event)"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave($event)">
            <i class="bi bi-upload display-4 text-muted mb-3"></i>
            <p class="h5 mb-2">Drag and drop your file here</p>
            <p class="text-muted mb-4">Supports Excel (.xlsx) and CSV files</p>
            <div class="d-flex justify-content-center gap-2">
              <label class="btn btn-primary">
                <i class="bi bi-file-earmark-spreadsheet me-1"></i>
                Browse Files
                <input type="file" class="d-none" accept=".xlsx,.xls,.csv" (change)="onFileSelect($event)">
              </label>
            </div>
          </div>

          <!-- Parse Errors -->
          <div class="alert alert-danger mt-4" *ngIf="parseErrors.length > 0">
            <div class="d-flex align-items-center mb-2">
              <i class="bi bi-exclamation-circle me-2"></i>
              <strong>Import Failed</strong>
            </div>
            <ul class="mb-0 ps-3">
              <li *ngFor="let error of parseErrors">{{ error }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div class="card mb-4" *ngIf="parseResult">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center">
            <i class="bi bi-check-circle-fill text-success me-2"></i>
            <span class="fw-semibold">Preview: SO-{{ parseResult.order.so_number }}</span>
          </div>
          <button class="btn btn-sm btn-outline-secondary" (click)="clearResult()">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="card-body">
          <!-- Warnings -->
          <div class="alert alert-warning" *ngIf="parseResult.warnings.length > 0">
            <strong>Warnings</strong>
            <ul class="mb-0 ps-3">
              <li *ngFor="let warning of parseResult.warnings">{{ warning }}</li>
            </ul>
          </div>

          <!-- Order Info -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-2">Order Details</h6>
            <div class="row g-3 small">
              <div class="col-6 col-md-3">
                <span class="text-muted">SO Number:</span>
                <span class="fw-medium ms-2">{{ parseResult.order.so_number }}</span>
              </div>
              <div class="col-6 col-md-3" *ngIf="parseResult.order.po_number">
                <span class="text-muted">PO Number:</span>
                <span class="fw-medium ms-2">{{ parseResult.order.po_number }}</span>
              </div>
              <div class="col-6 col-md-3" *ngIf="parseResult.order.customer_name">
                <span class="text-muted">Customer:</span>
                <span class="fw-medium ms-2">{{ parseResult.order.customer_name }}</span>
              </div>
            </div>
          </div>

          <!-- Tools -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-2">Tools ({{ parseResult.order.tools.length }})</h6>
            <div class="d-flex flex-wrap gap-2">
              <span *ngFor="let tool of parseResult.order.tools" class="badge bg-secondary">
                {{ tool.tool_number }}
                <span *ngIf="tool.tool_model"> [{{ tool.tool_model }}]</span>
                <span *ngIf="tool.serial_number"> (SN: {{ tool.serial_number }})</span>
              </span>
            </div>
          </div>

          <!-- Line Items -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-2">Line Items ({{ parseResult.order.line_items.length }})</h6>
            <div class="table-responsive border rounded" style="max-height: 300px; overflow-y: auto;">
              <table class="table table-sm mb-0">
                <thead class="table-light sticky-top">
                  <tr>
                    <th>Part Number</th>
                    <th>Description</th>
                    <th>Location</th>
                    <th class="text-center">Qty/Unit</th>
                    <th class="text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of parseResult.order.line_items.slice(0, 50)">
                    <td class="font-mono">{{ item.part_number }}</td>
                    <td class="text-muted">{{ item.description || '-' }}</td>
                    <td>{{ item.location || '-' }}</td>
                    <td class="text-center">{{ item.qty_per_unit }}</td>
                    <td class="text-center">{{ item.total_qty_needed }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="small text-muted text-center mt-2" *ngIf="parseResult.order.line_items.length > 50">
              ...and {{ parseResult.order.line_items.length - 50 }} more items
            </p>
          </div>

          <!-- Actions -->
          <div class="d-flex justify-content-end gap-2">
            <button class="btn btn-outline-secondary" (click)="clearResult()">Cancel</button>
            <button class="btn btn-primary" (click)="handleImport()" [disabled]="isImporting">
              {{ isImporting ? 'Importing...' : 'Import Order' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Template Download -->
      <div class="card mb-4">
        <div class="card-header">
          <span class="fw-semibold">Download Template</span>
        </div>
        <div class="card-body">
          <p class="small text-muted mb-3">Download an Excel template to get started:</p>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-outline-secondary" (click)="downloadTemplate('single')">
              <i class="bi bi-download me-1"></i> Single Tool Type
            </button>
            <button class="btn btn-outline-secondary" (click)="downloadTemplate('multi')">
              <i class="bi bi-download me-1"></i> Multiple Tool Types
            </button>
          </div>
          <p class="small text-muted mt-3 mb-0">
            <strong>Single Tool Type:</strong> All tools share the same parts list.<br>
            <strong>Multiple Tool Types:</strong> Different tools have different BOMs.
          </p>
        </div>
      </div>

      <!-- Help -->
      <div class="card">
        <div class="card-header">
          <span class="fw-semibold">File Format Guide</span>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <h6 class="fw-semibold">Single Tool Type (Simple Format)</h6>
            <p class="small text-muted mb-0">
              Excel file with "Order Info" sheet containing SO Number, PO Number, Customer, Tool Qty, Tool Model.
              "Parts" sheet with Part Number, Description, Location, Qty/Unit columns.
            </p>
          </div>
          <div class="mb-3">
            <h6 class="fw-semibold">Expected Columns</h6>
            <ul class="small text-muted mb-0">
              <li>Part Number (required)</li>
              <li>Description (optional)</li>
              <li>Location/Bin (optional)</li>
              <li>Quantity per unit or tool-specific quantities</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ImportComponent {
  isDragging = false;
  parseResult: {
    order: ImportedOrder;
    errors: string[];
    warnings: string[];
  } | null = null;
  parseErrors: string[] = [];
  isImporting = false;

  constructor(
    private router: Router,
    private ordersService: OrdersService,
    private excelService: ExcelService
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  async handleFile(file: File): Promise<void> {
    this.parseResult = null;
    this.parseErrors = [];

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('spreadsheet');
    const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv';

    if (!isExcel && !isCsv) {
      this.parseErrors = ['Please upload an Excel (.xlsx) or CSV file'];
      return;
    }

    const result = isExcel
      ? await this.excelService.parseEnhancedExcelFile(file)
      : await this.excelService.parseCsvFile(file);

    if (result.success && result.order) {
      this.parseResult = {
        order: result.order,
        errors: result.errors,
        warnings: result.warnings,
      };
    } else {
      this.parseErrors = result.errors;
    }
  }

  async handleImport(): Promise<void> {
    if (!this.parseResult?.order) return;

    this.isImporting = true;
    const result = await this.ordersService.importOrder(this.parseResult.order);
    this.isImporting = false;

    if (result) {
      this.router.navigate(['/orders', result.id]);
    }
  }

  clearResult(): void {
    this.parseResult = null;
    this.parseErrors = [];
  }

  downloadTemplate(type: 'single' | 'multi'): void {
    this.excelService.downloadImportTemplate(type);
  }
}
