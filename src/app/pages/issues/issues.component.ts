import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { IssuesService } from '../../services/issues.service';
import { SettingsService } from '../../services/settings.service';
import { UtilsService } from '../../services/utils.service';
import { IssueWithDetails, IssueStatus } from '../../models';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div>
      <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h1 class="h3 fw-bold mb-1">Issues</h1>
          <p class="text-muted mb-0">Track and resolve picking issues</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
          <div class="card border-danger">
            <div class="card-body">
              <p class="text-muted small mb-1">Open Issues</p>
              <h3 class="mb-0 fw-bold text-danger">{{ openIssuesCount }}</h3>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="card border-success">
            <div class="card-body">
              <p class="text-muted small mb-1">Resolved</p>
              <h3 class="mb-0 fw-bold text-success">{{ resolvedIssuesCount }}</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-4">
        <div class="card-body">
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm"
                    [class.btn-primary]="statusFilter === 'all'"
                    [class.btn-outline-secondary]="statusFilter !== 'all'"
                    (click)="statusFilter = 'all'">All</button>
            <button class="btn btn-sm"
                    [class.btn-danger]="statusFilter === 'open'"
                    [class.btn-outline-danger]="statusFilter !== 'open'"
                    (click)="statusFilter = 'open'">
              Open ({{ openIssuesCount }})
            </button>
            <button class="btn btn-sm"
                    [class.btn-success]="statusFilter === 'resolved'"
                    [class.btn-outline-success]="statusFilter !== 'resolved'"
                    (click)="statusFilter = 'resolved'">
              Resolved ({{ resolvedIssuesCount }})
            </button>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="card">
        <div class="card-body text-center py-5 text-muted">Loading issues...</div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading && filteredIssues.length === 0" class="card">
        <div class="card-body text-center py-5">
          <i class="bi bi-check-circle display-4 text-success mb-3"></i>
          <p class="text-muted mb-0">
            {{ statusFilter === 'open' ? 'No open issues!' : 'No issues found' }}
          </p>
        </div>
      </div>

      <!-- Issues List -->
      <div *ngIf="!loading && filteredIssues.length > 0" class="d-flex flex-column gap-3">
        <div *ngFor="let issue of filteredIssues" class="card"
             [class.border-danger]="issue.status === 'open'"
             [class.border-success]="issue.status === 'resolved'"
             [class.opacity-75]="issue.status === 'resolved'">
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div class="flex-grow-1">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <span class="badge" [ngClass]="utils.getIssueTypeBadgeClass(issue.issue_type)">
                    {{ utils.getIssueTypeLabel(issue.issue_type) }}
                  </span>
                  <span class="badge" [ngClass]="issue.status === 'open' ? 'bg-danger' : 'bg-success'">
                    {{ issue.status | titlecase }}
                  </span>
                  <a [routerLink]="['/orders', issue.order_id]" class="text-decoration-none small">
                    SO-{{ issue.order?.so_number }}
                  </a>
                </div>
                <p class="fw-medium mb-1" *ngIf="issue.line_item">
                  {{ issue.line_item.part_number }}
                  <span class="text-muted fw-normal" *ngIf="issue.line_item.description">
                    - {{ issue.line_item.description }}
                  </span>
                </p>
                <p class="text-muted mb-2" *ngIf="issue.description">{{ issue.description }}</p>
                <div class="small text-muted">
                  <span *ngIf="issue.reported_by">Reported by {{ issue.reported_by }}</span>
                  <span> on {{ utils.formatDateTime(issue.created_at) }}</span>
                  <span *ngIf="issue.status === 'resolved' && issue.resolved_at">
                    | Resolved by {{ issue.resolved_by || 'Unknown' }} on {{ utils.formatDateTime(issue.resolved_at) }}
                  </span>
                </div>
              </div>
              <div>
                <button *ngIf="issue.status === 'open'"
                        class="btn btn-sm btn-success"
                        (click)="handleResolveIssue(issue.id)">
                  <i class="bi bi-check-lg me-1"></i> Resolve
                </button>
                <button *ngIf="issue.status === 'resolved'"
                        class="btn btn-sm btn-outline-warning"
                        (click)="handleReopenIssue(issue.id)">
                  <i class="bi bi-arrow-counterclockwise me-1"></i> Reopen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class IssuesComponent implements OnInit, OnDestroy {
  issues: IssueWithDetails[] = [];
  loading = true;
  statusFilter: 'all' | 'open' | 'resolved' = 'open';

  private subscriptions: Subscription[] = [];

  constructor(
    private issuesService: IssuesService,
    private settingsService: SettingsService,
    public utils: UtilsService
  ) {}

  ngOnInit(): void {
    this.issuesService.loadAllIssues();

    this.subscriptions.push(
      this.issuesService.issues$.subscribe(issues => {
        this.issues = issues;
      }),
      this.issuesService.loading$.subscribe(loading => {
        this.loading = loading;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  get filteredIssues(): IssueWithDetails[] {
    if (this.statusFilter === 'all') return this.issues;
    return this.issues.filter(i => i.status === this.statusFilter);
  }

  get openIssuesCount(): number {
    return this.issues.filter(i => i.status === 'open').length;
  }

  get resolvedIssuesCount(): number {
    return this.issues.filter(i => i.status === 'resolved').length;
  }

  async handleResolveIssue(issueId: string): Promise<void> {
    const userName = this.settingsService.getUserName();
    await this.issuesService.resolveIssue(issueId, userName);
  }

  async handleReopenIssue(issueId: string): Promise<void> {
    await this.issuesService.reopenIssue(issueId);
  }
}
