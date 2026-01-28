import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ConsolidatedPartsService } from '../../services/consolidated-parts.service';
import { UtilsService } from '../../services/utils.service';
import { ConsolidatedPart } from '../../models';

@Component({
  selector: 'app-consolidated-parts',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div>
      <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h1 class="h3 fw-bold mb-1">Consolidated Parts</h1>
          <p class="text-muted mb-0">View all parts needed across active orders</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
          <div class="card">
            <div class="card-body">
              <p class="text-muted small mb-1">Total Parts</p>
              <h3 class="mb-0 fw-bold">{{ parts.length }}</h3>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="card">
            <div class="card-body">
              <p class="text-muted small mb-1">Total Quantity</p>
              <h3 class="mb-0 fw-bold">{{ totalNeeded | number }}</h3>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="card">
            <div class="card-body">
              <p class="text-muted small mb-1">Picked</p>
              <h3 class="mb-0 fw-bold text-success">{{ totalPicked | number }}</h3>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="card">
            <div class="card-body">
              <p class="text-muted small mb-1">Remaining</p>
              <h3 class="mb-0 fw-bold text-warning">{{ totalRemaining | number }}</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" placeholder="Search by part number or description..."
                       [(ngModel)]="searchQuery">
              </div>
            </div>
            <div class="col-md-6">
              <div class="d-flex gap-2">
                <button class="btn btn-sm"
                        [class.btn-primary]="filter === 'all'"
                        [class.btn-outline-secondary]="filter !== 'all'"
                        (click)="filter = 'all'">All</button>
                <button class="btn btn-sm"
                        [class.btn-primary]="filter === 'remaining'"
                        [class.btn-outline-secondary]="filter !== 'remaining'"
                        (click)="filter = 'remaining'">Remaining</button>
                <button class="btn btn-sm"
                        [class.btn-primary]="filter === 'complete'"
                        [class.btn-outline-secondary]="filter !== 'complete'"
                        (click)="filter = 'complete'">Complete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Parts List -->
      <div *ngIf="loading" class="card">
        <div class="card-body text-center py-5 text-muted">Loading parts...</div>
      </div>

      <div *ngIf="!loading && filteredParts.length === 0" class="card">
        <div class="card-body text-center py-5 text-muted">
          {{ searchQuery || filter !== 'all' ? 'No parts match your filters' : 'No parts found' }}
        </div>
      </div>

      <div *ngIf="!loading && filteredParts.length > 0" class="card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Part Number</th>
                <th>Description</th>
                <th>Location</th>
                <th class="text-center">Needed</th>
                <th class="text-center">Picked</th>
                <th class="text-center">Remaining</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let part of filteredParts"
                  [class.table-success]="part.remaining === 0"
                  [class.table-warning]="part.total_picked > 0 && part.remaining > 0">
                <td class="font-mono fw-medium">{{ part.part_number }}</td>
                <td class="text-muted">{{ part.description || '-' }}</td>
                <td>{{ part.location || '-' }}</td>
                <td class="text-center">{{ part.total_needed }}</td>
                <td class="text-center">{{ part.total_picked }}</td>
                <td class="text-center">
                  <span class="badge" [ngClass]="part.remaining === 0 ? 'bg-success' : 'bg-warning text-dark'">
                    {{ part.remaining }}
                  </span>
                </td>
                <td>
                  <div class="d-flex flex-wrap gap-1">
                    <a *ngFor="let order of part.orders"
                       [routerLink]="['/orders', order.order_id]"
                       class="badge bg-light text-dark border text-decoration-none">
                      SO-{{ order.so_number }}
                      <span class="text-muted">({{ order.picked }}/{{ order.needed }})</span>
                    </a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ConsolidatedPartsComponent implements OnInit, OnDestroy {
  parts: ConsolidatedPart[] = [];
  loading = true;
  searchQuery = '';
  filter: 'all' | 'remaining' | 'complete' = 'all';

  private subscriptions: Subscription[] = [];

  constructor(
    private partsService: ConsolidatedPartsService,
    public utils: UtilsService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.partsService.parts$.subscribe(parts => {
        this.parts = parts;
      }),
      this.partsService.loading$.subscribe(loading => {
        this.loading = loading;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  get filteredParts(): ConsolidatedPart[] {
    return this.parts.filter(part => {
      const matchesSearch =
        part.part_number.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        part.description?.toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesFilter =
        this.filter === 'all' ||
        (this.filter === 'remaining' && part.remaining > 0) ||
        (this.filter === 'complete' && part.remaining === 0);

      return matchesSearch && matchesFilter;
    });
  }

  get totalNeeded(): number {
    return this.parts.reduce((sum, p) => sum + p.total_needed, 0);
  }

  get totalPicked(): number {
    return this.parts.reduce((sum, p) => sum + p.total_picked, 0);
  }

  get totalRemaining(): number {
    return this.parts.reduce((sum, p) => sum + p.remaining, 0);
  }
}
