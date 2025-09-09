import { settingsService } from '../../src/settings/settings-service';
import { piiLogger } from '../../src/logging/logger';
import { exportService } from '../../src/logging/export-service';
import type { AppSettings, PresetType } from '../../src/settings/settings-storage';
import type { PIITypeInfo } from '../../src/settings/settings-service';

class OptionsUI {
  private currentSettings: AppSettings | null = null;
  private currentPage = 1;
  private pageSize = 20;

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupTabs();
    await this.renderUI();
  }

  private async loadSettings() {
    try {
      this.currentSettings = await settingsService.getSettings();
      this.updateGlobalStatus();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showNotification('Failed to load settings', 'error');
    }
  }

  private setupEventListeners() {
    // Save button
    document.getElementById('save-all')?.addEventListener('click', () => this.saveAllSettings());

    // Preset selector will be handled dynamically
    
    // Advanced settings
    document.getElementById('timeout')?.addEventListener('change', (e) => {
      if (this.currentSettings) {
        this.currentSettings.timeout.processingTimeoutMs = parseInt((e.target as HTMLInputElement).value) * 1000;
      }
    });

    document.getElementById('timeout-action')?.addEventListener('change', (e) => {
      if (this.currentSettings) {
        this.currentSettings.timeout.onTimeoutAction = (e.target as HTMLSelectElement).value as 'block' | 'allow' | 'prompt';
      }
    });

    // Data management
    document.getElementById('export-settings')?.addEventListener('click', () => this.exportSettings());
    document.getElementById('import-settings')?.addEventListener('click', () => this.importSettings());
    document.getElementById('reset-settings')?.addEventListener('click', () => this.resetSettings());

    // Log management
    document.getElementById('export-logs')?.addEventListener('click', () => this.exportLogs());
    document.getElementById('clear-logs')?.addEventListener('click', () => this.clearLogs());

    // File import
    document.getElementById('import-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.handleSettingsImport(file);
      }
    });
  }

  private setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        
        // Update tab appearance
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show corresponding content
        tabContents.forEach(content => {
          content.classList.remove('active');
        });
        
        const targetContent = document.getElementById(`${tabId}-tab`);
        targetContent?.classList.add('active');

        // Load tab-specific data
        if (tabId === 'logs') {
          this.loadLogData();
        }
      });
    });
  }

  private async renderUI() {
    if (!this.currentSettings) return;

    this.renderPresets();
    this.renderPIICategories();
    this.renderSiteList();
    this.renderAdvancedSettings();
  }

  private renderPresets() {
    const container = document.getElementById('preset-selector');
    if (!container || !this.currentSettings) return;

    const presets = settingsService.getPresetInfo();
    const currentPreset = this.currentSettings.preset;

    container.innerHTML = presets.map(preset => `
      <div class="preset-option ${preset.value === currentPreset ? 'active' : ''}" data-preset="${preset.value}">
        <h4>${preset.label}</h4>
        <p>${preset.description}</p>
      </div>
    `).join('');

    // Add custom preset if current is custom
    if (currentPreset === 'custom') {
      container.innerHTML += `
        <div class="preset-option active" data-preset="custom">
          <h4>Custom</h4>
          <p>Your personalized settings</p>
        </div>
      `;
    }

    // Add event listeners
    container.querySelectorAll('.preset-option').forEach(option => {
      option.addEventListener('click', async () => {
        const preset = option.getAttribute('data-preset') as PresetType;
        if (preset !== 'custom') {
          await settingsService.applyPreset(preset);
          await this.loadSettings();
          await this.renderUI();
          this.showNotification(`Applied ${preset} preset`, 'success');
        }
      });
    });
  }

  private renderPIICategories() {
    const container = document.getElementById('pii-categories');
    if (!container || !this.currentSettings) return;

    const categoriesData = settingsService.getPIITypesByCategory();

    container.innerHTML = Object.entries(categoriesData).map(([category, types]) => `
      <div class="pii-category">
        <div class="category-header">${category}</div>
        <div class="category-content">
          ${types.map(type => this.renderPIIItem(type)).join('')}
        </div>
      </div>
    `).join('');

    // Add event listeners for toggles and sliders
    this.setupPIIControls();
  }

  private renderPIIItem(typeInfo: PIITypeInfo): string {
    if (!this.currentSettings) return '';

    const isEnabled = this.currentSettings.pii.enabledTypes[typeInfo.type];
    const confidence = Math.round(this.currentSettings.pii.confidenceThresholds[typeInfo.type] * 100);

    return `
      <div class="pii-item">
        <div class="pii-info">
          <h4>${typeInfo.label}</h4>
          <p>${typeInfo.description}</p>
        </div>
        <div class="pii-controls">
          <input type="range" class="confidence-slider" 
                 data-type="${typeInfo.type}"
                 min="50" max="100" value="${confidence}" 
                 ${!isEnabled ? 'disabled' : ''}>
          <span class="confidence-value">${confidence}%</span>
          <label class="toggle-switch">
            <input type="checkbox" data-type="${typeInfo.type}" ${isEnabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;
  }

  private setupPIIControls() {
    // Toggle switches
    document.querySelectorAll('.toggle-switch input').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        const type = target.getAttribute('data-type');
        const enabled = target.checked;

        if (type && this.currentSettings) {
          this.currentSettings.pii.enabledTypes[type as keyof typeof this.currentSettings.pii.enabledTypes] = enabled;
          this.currentSettings.preset = 'custom';
          
          // Enable/disable corresponding confidence slider
          const slider = document.querySelector(`input[type="range"][data-type="${type}"]`) as HTMLInputElement;
          if (slider) {
            slider.disabled = !enabled;
          }
          
          this.updatePresetDisplay();
        }
      });
    });

    // Confidence sliders
    document.querySelectorAll('.confidence-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const type = target.getAttribute('data-type');
        const confidence = parseInt(target.value) / 100;
        
        if (type && this.currentSettings) {
          this.currentSettings.pii.confidenceThresholds[type as keyof typeof this.currentSettings.pii.confidenceThresholds] = confidence;
          this.currentSettings.preset = 'custom';
          
          // Update display
          const valueSpan = target.nextElementSibling;
          if (valueSpan) {
            valueSpan.textContent = `${target.value}%`;
          }
          
          this.updatePresetDisplay();
        }
      });
    });
  }

  private renderSiteList() {
    const container = document.getElementById('site-list');
    if (!container || !this.currentSettings) return;

    const sites = Object.entries(this.currentSettings.sites);

    container.innerHTML = sites.map(([hostname, settings]) => `
      <div class="site-item">
        <div class="site-info">
          <h4>${hostname}</h4>
        </div>
        <div class="site-controls">
          <label class="toggle-switch">
            <input type="checkbox" data-site="${hostname}" ${settings.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const site = target.getAttribute('data-site');
        if (site && this.currentSettings) {
          this.currentSettings.sites[site].enabled = target.checked;
        }
      });
    });
  }

  private renderAdvancedSettings() {
    if (!this.currentSettings) return;

    const timeoutInput = document.getElementById('timeout') as HTMLInputElement;
    const actionSelect = document.getElementById('timeout-action') as HTMLSelectElement;

    if (timeoutInput) {
      timeoutInput.value = (this.currentSettings.timeout.processingTimeoutMs / 1000).toString();
    }

    if (actionSelect) {
      actionSelect.value = this.currentSettings.timeout.onTimeoutAction;
    }
  }

  private async loadLogData() {
    try {
      const stats = await piiLogger.getStats();
      this.renderStatsGrid(stats);
      await this.renderLogTable();
    } catch (error) {
      console.error('Failed to load log data:', error);
    }
  }

  private renderStatsGrid(stats: any) {
    const container = document.getElementById('stats-grid');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card">
        <span class="stat-number">${stats.totalRevisions}</span>
        <div class="stat-label">Total Revisions</div>
      </div>
      <div class="stat-card">
        <span class="stat-number">${stats.totalUploads}</span>
        <div class="stat-label">File Uploads</div>
      </div>
      <div class="stat-card">
        <span class="stat-number">${stats.recentActivity.today.revisions}</span>
        <div class="stat-label">Today's Revisions</div>
      </div>
      <div class="stat-card">
        <span class="stat-number">${Object.keys(stats.revisionsBySite).length}</span>
        <div class="stat-label">Protected Sites</div>
      </div>
    `;
  }

  private async renderLogTable() {
    const tbody = document.querySelector('#log-table tbody');
    if (!tbody) return;

    try {
      const [revisions, uploads] = await Promise.all([
        piiLogger.getRevisions({ limit: this.pageSize, offset: (this.currentPage - 1) * this.pageSize }),
        piiLogger.getUploads({ limit: this.pageSize, offset: (this.currentPage - 1) * this.pageSize })
      ]);

      // Combine and sort by timestamp
      const allEntries = [
        ...revisions.map(r => ({ ...r, entryType: 'revision' as const })),
        ...uploads.map(u => ({ ...u, entryType: 'upload' as const }))
      ].sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.pageSize);

      tbody.innerHTML = allEntries.map(entry => {
        const date = new Date(entry.timestamp).toLocaleString();
        if (entry.entryType === 'revision') {
          return `
            <tr>
              <td>${date}</td>
              <td>${entry.site}</td>
              <td>PII Masking</td>
              <td>${entry.spans.length} items</td>
              <td>Masked</td>
            </tr>
          `;
        } else {
          return `
            <tr>
              <td>${date}</td>
              <td>${entry.site}</td>
              <td>File Upload</td>
              <td>${entry.filename}</td>
              <td>Logged</td>
            </tr>
          `;
        }
      }).join('');

      this.renderPagination(allEntries.length);
    } catch (error) {
      console.error('Failed to render log table:', error);
      tbody.innerHTML = '<tr><td colspan="5">Error loading logs</td></tr>';
    }
  }

  private renderPagination(totalItems: number) {
    const container = document.getElementById('pagination');
    if (!container) return;

    const totalPages = Math.ceil(totalItems / this.pageSize);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    const buttons = [];
    for (let i = 1; i <= totalPages; i++) {
      buttons.push(`
        <button class="${i === this.currentPage ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `);
    }

    container.innerHTML = buttons.join('');

    // Add event listeners
    container.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPage = parseInt(btn.getAttribute('data-page') || '1');
        this.renderLogTable();
      });
    });
  }

  private updateGlobalStatus() {
    const statusEl = document.getElementById('global-status');
    if (!statusEl || !this.currentSettings) return;

    if (this.currentSettings.globalEnabled) {
      statusEl.textContent = '✅ Protection Enabled';
      statusEl.className = 'status enabled';
    } else {
      statusEl.textContent = '❌ Protection Disabled';
      statusEl.className = 'status disabled';
    }
  }

  private updatePresetDisplay() {
    const presetOptions = document.querySelectorAll('.preset-option');
    presetOptions.forEach(option => {
      option.classList.remove('active');
      if (option.getAttribute('data-preset') === 'custom') {
        option.classList.add('active');
      }
    });
  }

  private async saveAllSettings() {
    if (!this.currentSettings) return;

    try {
      await settingsService.updateSettings(this.currentSettings);
      this.showNotification('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showNotification('Failed to save settings', 'error');
    }
  }

  private async exportSettings() {
    try {
      const settingsJson = await settingsService.exportSettings();
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pii-checker-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showNotification('Settings exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export settings:', error);
      this.showNotification('Failed to export settings', 'error');
    }
  }

  private importSettings() {
    document.getElementById('import-file')?.click();
  }

  private async handleSettingsImport(file: File) {
    try {
      const text = await file.text();
      await settingsService.importSettings(text);
      await this.loadSettings();
      await this.renderUI();
      this.showNotification('Settings imported successfully!', 'success');
    } catch (error) {
      console.error('Failed to import settings:', error);
      this.showNotification('Failed to import settings. Please check the file format.', 'error');
    }
  }

  private async resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      try {
        await settingsService.resetToDefaults();
        await this.loadSettings();
        await this.renderUI();
        this.showNotification('Settings reset to defaults', 'success');
      } catch (error) {
        console.error('Failed to reset settings:', error);
        this.showNotification('Failed to reset settings', 'error');
      }
    }
  }

  private async exportLogs() {
    try {
      await exportService.downloadLogs({
        format: 'json',
        type: 'both'
      });
      this.showNotification('Logs exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export logs:', error);
      this.showNotification('Failed to export logs', 'error');
    }
  }

  private async clearLogs() {
    if (confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      try {
        await piiLogger.clearAllLogs();
        await this.loadLogData();
        this.showNotification('All logs cleared', 'success');
      } catch (error) {
        console.error('Failed to clear logs:', error);
        this.showNotification('Failed to clear logs', 'error');
      }
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    // Simple notification implementation
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    switch (type) {
      case 'success':
        notification.style.background = '#28a745';
        break;
      case 'error':
        notification.style.background = '#dc3545';
        break;
      default:
        notification.style.background = '#17a2b8';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const ui = new OptionsUI();
  ui.init().catch(console.error);
});