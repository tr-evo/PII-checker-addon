import { settingsService } from '../../src/settings/settings-service';
import { piiLogger } from '../../src/logging/logger';
import { exportService } from '../../src/logging/export-service';
import type { AppSettings, PresetType } from '../../src/settings/settings-storage';
import type { EffectiveSettings } from '../../src/settings/managed-storage';
import type { PIITypeInfo } from '../../src/settings/settings-service';

class OptionsUI {
  private currentSettings: EffectiveSettings | null = null;
  private currentPage = 1;
  private pageSize = 20;
  private isEnterpriseMode = false;

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupTabs();
    await this.renderUI();
  }

  private async loadSettings() {
    try {
      this.currentSettings = await settingsService.getSettings();
      this.isEnterpriseMode = this.currentSettings._managedSettings?.locked || false;
      this.updateGlobalStatus();
      this.updateEnterpriseNotice();
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
    const presetsLocked = this.isFieldLocked('preset') || this.isFieldLocked('uiRestrictions.disablePresetChanges');

    container.innerHTML = presets.map(preset => `
      <div class="preset-option ${preset.value === currentPreset ? 'active' : ''} ${presetsLocked ? 'locked' : ''}" 
           data-preset="${preset.value}" ${presetsLocked ? 'title="This setting is locked by enterprise policy"' : ''}>
        <h4>${preset.label} ${presetsLocked ? '🔒' : ''}</h4>
        <p>${preset.description}</p>
      </div>
    `).join('');

    // Add custom preset if current is custom
    if (currentPreset === 'custom') {
      container.innerHTML += `
        <div class="preset-option active ${presetsLocked ? 'locked' : ''}" data-preset="custom"
             ${presetsLocked ? 'title="This setting is locked by enterprise policy"' : ''}>
          <h4>Custom ${presetsLocked ? '🔒' : ''}</h4>
          <p>Your personalized settings</p>
        </div>
      `;
    }

    // Add event listeners
    container.querySelectorAll('.preset-option').forEach(option => {
      option.addEventListener('click', async () => {
        if (presetsLocked) {
          this.showNotification('Preset changes are disabled by enterprise policy', 'error');
          return;
        }
        
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
    const isToggleLocked = this.isFieldLocked(`pii.enabledTypes.${typeInfo.type}`);
    const isSliderLocked = this.isFieldLocked(`pii.confidenceThresholds.${typeInfo.type}`);
    const isRequired = this.currentSettings._managedSettings && 
      this.currentSettings._managedSettings.lockedFields?.some(field => 
        field.includes('compliance.requiredPiiTypes') && 
        field.includes(typeInfo.type)
      );

    return `
      <div class="pii-item ${isToggleLocked || isSliderLocked ? 'locked-item' : ''}">
        <div class="pii-info">
          <h4>${typeInfo.label} ${isToggleLocked ? '🔒' : ''} ${isRequired ? '⚠️' : ''}</h4>
          <p>${typeInfo.description}${isRequired ? ' (Required by policy)' : ''}</p>
        </div>
        <div class="pii-controls">
          <input type="range" class="confidence-slider" 
                 data-type="${typeInfo.type}"
                 min="50" max="100" value="${confidence}" 
                 ${!isEnabled || isSliderLocked ? 'disabled' : ''}
                 ${isSliderLocked ? 'title="This setting is locked by enterprise policy"' : ''}>
          <span class="confidence-value">${confidence}%</span>
          <label class="toggle-switch ${isToggleLocked ? 'locked' : ''}"
                 ${isToggleLocked ? 'title="This setting is locked by enterprise policy"' : ''}>
            <input type="checkbox" data-type="${typeInfo.type}" 
                   ${isEnabled ? 'checked' : ''} 
                   ${isToggleLocked ? 'disabled' : ''}>
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
          if (this.isFieldLocked(`pii.enabledTypes.${type}`)) {
            this.showNotification('This PII type is locked by enterprise policy', 'error');
            target.checked = !enabled; // Revert change
            return;
          }

          this.currentSettings.pii.enabledTypes[type as keyof typeof this.currentSettings.pii.enabledTypes] = enabled;
          this.currentSettings.preset = 'custom';
          
          // Enable/disable corresponding confidence slider
          const slider = document.querySelector(`input[type="range"][data-type="${type}"]`) as HTMLInputElement;
          if (slider && !this.isFieldLocked(`pii.confidenceThresholds.${type}`)) {
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
          if (this.isFieldLocked(`pii.confidenceThresholds.${type}`)) {
            this.showNotification('This confidence threshold is locked by enterprise policy', 'error');
            return;
          }

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
    const exportBtn = document.getElementById('export-settings') as HTMLButtonElement;
    const importBtn = document.getElementById('import-settings') as HTMLButtonElement;

    if (timeoutInput) {
      timeoutInput.value = (this.currentSettings.timeout.processingTimeoutMs / 1000).toString();
      if (this.isFieldLocked('timeout.processingTimeoutMs')) {
        timeoutInput.disabled = true;
        timeoutInput.title = 'This setting is locked by enterprise policy';
      }
    }

    if (actionSelect) {
      actionSelect.value = this.currentSettings.timeout.onTimeoutAction;
      if (this.isFieldLocked('timeout.onTimeoutAction')) {
        actionSelect.disabled = true;
        actionSelect.title = 'This setting is locked by enterprise policy';
      }
    }

    // Disable export/import buttons if restricted
    if (exportBtn && this.isExportDisabled()) {
      exportBtn.disabled = true;
      exportBtn.title = 'Data export is disabled by enterprise policy';
      exportBtn.style.opacity = '0.5';
    }

    if (importBtn && this.isExportDisabled()) {
      importBtn.disabled = true;
      importBtn.title = 'Settings import is disabled by enterprise policy';
      importBtn.style.opacity = '0.5';
    }
  }

  private async loadLogData() {
    try {
      const stats = await piiLogger.getStats();
      this.renderStatsGrid(stats);
      await this.renderLogTable();
      this.updateLogButtons();
    } catch (error) {
      console.error('Failed to load log data:', error);
    }
  }

  private updateLogButtons() {
    const exportBtn = document.getElementById('export-logs') as HTMLButtonElement;
    const clearBtn = document.getElementById('clear-logs') as HTMLButtonElement;

    if (exportBtn && this.isExportDisabled()) {
      exportBtn.disabled = true;
      exportBtn.title = 'Log export is disabled by enterprise policy';
      exportBtn.style.opacity = '0.5';
    }

    if (clearBtn && this.isFieldLocked('logging.enabled')) {
      clearBtn.disabled = true;
      clearBtn.title = 'Log management is disabled by enterprise policy';
      clearBtn.style.opacity = '0.5';
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
    if (this.isExportDisabled()) {
      this.showNotification('Data export is disabled by enterprise policy', 'error');
      return;
    }
    
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
    if (this.isExportDisabled()) {
      this.showNotification('Log export is disabled by enterprise policy', 'error');
      return;
    }
    
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

  // Enterprise policy helper methods
  private isFieldLocked(fieldPath: string): boolean {
    if (!this.currentSettings?._managedSettings) return false;
    return this.currentSettings._managedSettings.lockedFields?.includes(fieldPath) || false;
  }

  private isExportDisabled(): boolean {
    return this.currentSettings?._managedSettings?.lockedFields?.includes('features.exportDisabled') || false;
  }

  private updateEnterpriseNotice() {
    if (!this.isEnterpriseMode) return;
    
    const header = document.querySelector('.header');
    if (header && !header.querySelector('.enterprise-notice')) {
      const notice = document.createElement('div');
      notice.className = 'enterprise-notice';
      notice.style.cssText = `
        margin-top: 10px;
        padding: 10px 15px;
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        color: #856404;
        font-size: 14px;
        font-weight: 500;
      `;
      notice.innerHTML = '🏢 Some settings are managed by your organization and cannot be changed.';
      header.appendChild(notice);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const ui = new OptionsUI();
  ui.init().catch(console.error);
});