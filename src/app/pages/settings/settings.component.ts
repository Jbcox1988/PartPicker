import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { UserSettings } from '../../models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="mb-4">
        <h1 class="h3 fw-bold mb-1">Settings</h1>
        <p class="text-muted mb-0">Configure your preferences</p>
      </div>

      <div class="row">
        <div class="col-lg-6">
          <!-- User Settings -->
          <div class="card mb-4">
            <div class="card-header">
              <span class="fw-semibold">User Settings</span>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label class="form-label">Your Name</label>
                <input type="text" class="form-control" placeholder="Enter your name"
                       [(ngModel)]="userName"
                       (blur)="saveUserName()">
                <div class="form-text">This name will be recorded when you pick items</div>
              </div>
            </div>
          </div>

          <!-- Theme Settings -->
          <div class="card mb-4">
            <div class="card-header">
              <span class="fw-semibold">Appearance</span>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label class="form-label">Theme</label>
                <select class="form-select" [(ngModel)]="theme" (change)="saveTheme()">
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System (auto)</option>
                </select>
                <div class="form-text">Choose your preferred color scheme</div>
              </div>
            </div>
          </div>

          <!-- About -->
          <div class="card">
            <div class="card-header">
              <span class="fw-semibold">About</span>
            </div>
            <div class="card-body">
              <p class="mb-2"><strong>Tool Pick List Tracker</strong></p>
              <p class="text-muted small mb-2">
                A comprehensive application for managing pick lists and tracking picking progress for sales orders.
              </p>
              <p class="text-muted small mb-0">
                Built with Angular and Bootstrap. Data stored in Supabase.
              </p>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <!-- Database Info -->
          <div class="card mb-4">
            <div class="card-header">
              <span class="fw-semibold">Database</span>
            </div>
            <div class="card-body">
              <p class="small text-muted mb-3">
                This application uses Supabase as its database backend.
                Make sure to configure your Supabase credentials in the environment files.
              </p>
              <div class="alert alert-info small mb-0">
                <i class="bi bi-info-circle me-2"></i>
                Check <code>src/environments/environment.ts</code> to set your Supabase URL and anonymous key.
              </div>
            </div>
          </div>

          <!-- Keyboard Shortcuts -->
          <div class="card">
            <div class="card-header">
              <span class="fw-semibold">Tips</span>
            </div>
            <div class="card-body">
              <ul class="small text-muted mb-0">
                <li class="mb-2">Use the search bar to quickly find orders by SO#, PO#, or customer name</li>
                <li class="mb-2">Click on any order to view details and start picking</li>
                <li class="mb-2">The Dashboard shows orders that are due soon or overdue</li>
                <li class="mb-2">Import Excel files to quickly create orders with their parts lists</li>
                <li>Export orders to Excel for offline reference or sharing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit, OnDestroy {
  userName = '';
  theme: 'light' | 'dark' | 'system' = 'system';

  private subscriptions: Subscription[] = [];

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.settingsService.settings$.subscribe(settings => {
        this.userName = settings.user_name;
        this.theme = settings.theme;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  saveUserName(): void {
    this.settingsService.setUserName(this.userName);
  }

  saveTheme(): void {
    this.settingsService.setTheme(this.theme);
  }
}
