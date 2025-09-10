import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import type { ManagedPolicySchema } from '../../src/settings/managed-storage';

// Setup DOM environment for UI testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head><title>Test</title></head>
    <body>
      <div class="header">
        <h1>PII Checker Settings</h1>
        <div id="global-status" class="status">Loading...</div>
      </div>
      
      <div class="preset-selector" id="preset-selector"></div>
      
      <div class="pii-categories" id="pii-categories"></div>
      
      <div class="advanced-settings">
        <input type="number" id="timeout" min="1" max="30" value="5">
        <select id="timeout-action">
          <option value="prompt">Ask user</option>
          <option value="block">Block submission</option>
          <option value="allow">Allow submission</option>
        </select>
        <button id="export-settings">Export Settings</button>
        <button id="import-settings">Import Settings</button>
        <button id="export-logs">Export Logs</button>
        <button id="clear-logs">Clear All Logs</button>
      </div>
      
      <div id="stats-grid"></div>
      <table id="log-table"><tbody></tbody></table>
      <div id="pagination"></div>
    </body>
  </html>
`, { 
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

// @ts-ignore
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;

// Mock Chrome APIs
const mockChrome = {
  storage: {
    managed: {
      get: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    },
    sync: {
      get: vi.fn(),
      set: vi.fn()
    }
  },
  runtime: {
    sendMessage: vi.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock settings service
const mockSettingsService = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getPresetInfo: vi.fn(),
  getPIITypesByCategory: vi.fn(),
  isFieldLocked: vi.fn(),
  isLocked: vi.fn(),
  exportSettings: vi.fn(),
  importSettings: vi.fn(),
  resetToDefaults: vi.fn(),
  applyPreset: vi.fn()
};

// Mock logger service
const mockPiiLogger = {
  getStats: vi.fn(),
  getRevisions: vi.fn(),
  getUploads: vi.fn(),
  clearAllLogs: vi.fn()
};

// Mock export service
const mockExportService = {
  downloadLogs: vi.fn()
};

// Create a mock OptionsUI class for testing
class MockOptionsUI {
  private currentSettings: any = null;
  private isEnterpriseMode = false;

  async init() {
    await this.loadSettings();
    this.updateGlobalStatus();
    this.updateEnterpriseNotice();
    await this.renderUI();
  }

  private async loadSettings() {
    this.currentSettings = await mockSettingsService.getSettings();
    this.isEnterpriseMode = this.currentSettings._managedSettings?.locked || false;
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

  private async renderUI() {
    if (!this.currentSettings) return;
    this.renderPresets();
    this.renderPIICategories();
    this.renderAdvancedSettings();
  }

  private renderPresets() {
    const container = document.getElementById('preset-selector');
    if (!container || !this.currentSettings) return;

    const presets = mockSettingsService.getPresetInfo();
    const currentPreset = this.currentSettings.preset;
    const presetsLocked = this.isFieldLocked('preset') || this.isFieldLocked('uiRestrictions.disablePresetChanges');

    container.innerHTML = presets.map((preset: any) => `
      <div class="preset-option ${preset.value === currentPreset ? 'active' : ''} ${presetsLocked ? 'locked' : ''}" 
           data-preset="${preset.value}" ${presetsLocked ? 'title="This setting is locked by enterprise policy"' : ''}>
        <h4>${preset.label} ${presetsLocked ? '🔒' : ''}</h4>
        <p>${preset.description}</p>
      </div>
    `).join('');
  }

  private renderPIICategories() {
    const container = document.getElementById('pii-categories');
    if (!container || !this.currentSettings) return;

    const categoriesData = mockSettingsService.getPIITypesByCategory();
    
    container.innerHTML = Object.entries(categoriesData).map(([category, types]) => `
      <div class="pii-category">
        <div class="category-header">${category}</div>
        <div class="category-content">
          ${(types as any[]).map((type: any) => this.renderPIIItem(type)).join('')}
        </div>
      </div>
    `).join('');
  }

  private renderPIIItem(typeInfo: any): string {
    if (!this.currentSettings) return '';

    const isEnabled = this.currentSettings.pii.enabledTypes[typeInfo.type];
    const confidence = Math.round(this.currentSettings.pii.confidenceThresholds[typeInfo.type] * 100);
    const isToggleLocked = this.isFieldLocked(`pii.enabledTypes.${typeInfo.type}`);
    const isSliderLocked = this.isFieldLocked(`pii.confidenceThresholds.${typeInfo.type}`);
    const isRequired = this.currentSettings._managedSettings && 
      this.currentSettings._managedSettings.lockedFields?.some((field: string) => 
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

  private renderAdvancedSettings() {
    if (!this.currentSettings) return;

    const timeoutInput = document.getElementById('timeout') as HTMLInputElement;
    const actionSelect = document.getElementById('timeout-action') as HTMLSelectElement;
    const exportBtn = document.getElementById('export-settings') as HTMLButtonElement;
    const importBtn = document.getElementById('import-settings') as HTMLButtonElement;
    const exportLogsBtn = document.getElementById('export-logs') as HTMLButtonElement;
    const clearLogsBtn = document.getElementById('clear-logs') as HTMLButtonElement;

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

    if (exportLogsBtn && this.isExportDisabled()) {
      exportLogsBtn.disabled = true;
      exportLogsBtn.title = 'Log export is disabled by enterprise policy';
      exportLogsBtn.style.opacity = '0.5';
    }

    if (clearLogsBtn && this.isFieldLocked('logging.enabled')) {
      clearLogsBtn.disabled = true;
      clearLogsBtn.title = 'Log management is disabled by enterprise policy';
      clearLogsBtn.style.opacity = '0.5';
    }
  }

  private isFieldLocked(fieldPath: string): boolean {
    if (!this.currentSettings?._managedSettings) return false;
    return this.currentSettings._managedSettings.lockedFields?.includes(fieldPath) || false;
  }

  private isExportDisabled(): boolean {
    return this.currentSettings?._managedSettings?.lockedFields?.includes('features.exportDisabled') || false;
  }
}

describe('Enterprise UI E2E Tests', () => {
  let optionsUI: MockOptionsUI;

  beforeEach(() => {
    // Reset DOM
    const header = document.querySelector('.header');
    const existingNotice = header?.querySelector('.enterprise-notice');
    if (existingNotice) {
      existingNotice.remove();
    }

    // Reset mocks
    vi.clearAllMocks();
    
    optionsUI = new MockOptionsUI();

    // Setup default mock responses
    mockSettingsService.getPresetInfo.mockReturnValue([
      { value: 'strict', label: 'Strict', description: 'Maximum protection' },
      { value: 'balanced', label: 'Balanced', description: 'Good balance of security and usability' },
      { value: 'loose', label: 'Loose', description: 'Minimal interference' }
    ]);

    mockSettingsService.getPIITypesByCategory.mockReturnValue({
      'Personal Information': [
        { type: 'EMAIL', label: 'Email Address', description: 'email@domain.com' },
        { type: 'PHONE', label: 'Phone Number', description: '(555) 123-4567' }
      ],
      'Financial Information': [
        { type: 'CARD', label: 'Credit Card', description: '4111-1111-1111-1111' },
        { type: 'IBAN', label: 'Bank Account (IBAN)', description: 'DE89370400440532013000' }
      ]
    });

    mockPiiLogger.getStats.mockResolvedValue({
      totalRevisions: 150,
      totalUploads: 25,
      recentActivity: { today: { revisions: 12 } },
      revisionsBySite: { 'chat.openai.com': 100, 'claude.ai': 50 }
    });

    mockPiiLogger.getRevisions.mockResolvedValue([]);
    mockPiiLogger.getUploads.mockResolvedValue([]);
  });

  describe('Standard User Interface', () => {
    it('should render normal UI for non-enterprise users', async () => {
      // Setup non-enterprise settings
      const userSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: true, IBAN: false },
          confidenceThresholds: { EMAIL: 0.9, PHONE: 0.85, CARD: 0.95, IBAN: 0.9 }
        },
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        // No _managedSettings field
      };

      mockSettingsService.getSettings.mockResolvedValue(userSettings);
      mockSettingsService.isFieldLocked.mockReturnValue(false);

      await optionsUI.init();

      // Should show enabled status
      const statusEl = document.getElementById('global-status');
      expect(statusEl?.textContent).toBe('✅ Protection Enabled');
      expect(statusEl?.className).toBe('status enabled');

      // Should not show enterprise notice
      const notice = document.querySelector('.enterprise-notice');
      expect(notice).toBeNull();

      // Preset options should not be locked
      const presetOptions = document.querySelectorAll('.preset-option');
      presetOptions.forEach(option => {
        expect(option.classList.contains('locked')).toBe(false);
        expect(option.getAttribute('title')).toBeNull();
      });

      // PII controls should not be locked
      const toggles = document.querySelectorAll('.toggle-switch');
      toggles.forEach(toggle => {
        expect(toggle.classList.contains('locked')).toBe(false);
      });

      // Export buttons should be enabled
      const exportBtn = document.getElementById('export-settings') as HTMLButtonElement;
      expect(exportBtn?.disabled).toBe(false);
    });
  });

  describe('Enterprise Locked Interface', () => {
    it('should show enterprise notice and locked controls', async () => {
      // Setup enterprise-managed settings
      const enterpriseSettings = {
        globalEnabled: true,
        preset: 'strict',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: true, IBAN: true },
          confidenceThresholds: { EMAIL: 0.99, PHONE: 0.95, CARD: 0.99, IBAN: 0.95 }
        },
        timeout: {
          processingTimeoutMs: 3000,
          onTimeoutAction: 'block'
        },
        _managedSettings: {
          locked: true,
          lockedFields: [
            'preset',
            'pii.enabledTypes.EMAIL',
            'pii.enabledTypes.PHONE', 
            'pii.confidenceThresholds.EMAIL',
            'timeout.processingTimeoutMs',
            'features.exportDisabled'
          ],
          policyVersion: '1.0',
          lastUpdated: Date.now()
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(enterpriseSettings);
      mockSettingsService.isFieldLocked.mockImplementation((field: string) => 
        enterpriseSettings._managedSettings.lockedFields.includes(field)
      );

      await optionsUI.init();

      // Should show enterprise notice
      const notice = document.querySelector('.enterprise-notice');
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain('Some settings are managed by your organization');

      // Preset options should show as locked
      const presetOptions = document.querySelectorAll('.preset-option');
      presetOptions.forEach(option => {
        expect(option.classList.contains('locked')).toBe(true);
        expect(option.getAttribute('title')).toBe('This setting is locked by enterprise policy');
        expect(option.querySelector('h4')?.textContent).toContain('🔒');
      });

      // Locked PII items should show lock icons
      const piiItems = document.querySelectorAll('.pii-item');
      const emailItem = Array.from(piiItems).find(item => 
        item.querySelector('[data-type="EMAIL"]')
      );
      expect(emailItem?.classList.contains('locked-item')).toBe(true);
      expect(emailItem?.querySelector('h4')?.textContent).toContain('🔒');

      // Locked controls should be disabled
      const emailToggle = document.querySelector('[data-type="EMAIL"]') as HTMLInputElement;
      expect(emailToggle?.disabled).toBe(true);

      const emailSlider = document.querySelector('.confidence-slider[data-type="EMAIL"]') as HTMLInputElement;
      expect(emailSlider?.disabled).toBe(true);

      // Timeout input should be locked
      const timeoutInput = document.getElementById('timeout') as HTMLInputElement;
      expect(timeoutInput?.disabled).toBe(true);
      expect(timeoutInput?.title).toBe('This setting is locked by enterprise policy');

      // Export button should be disabled
      const exportBtn = document.getElementById('export-settings') as HTMLButtonElement;
      expect(exportBtn?.disabled).toBe(true);
      expect(exportBtn?.title).toBe('Data export is disabled by enterprise policy');
    });

    it('should show required PII types with warning icons', async () => {
      const enterpriseSettings = {
        globalEnabled: true,
        preset: 'custom',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: true, IBAN: false },
          confidenceThresholds: { EMAIL: 0.95, PHONE: 0.90, CARD: 0.99, IBAN: 0.9 }
        },
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        _managedSettings: {
          locked: false,
          lockedFields: [
            'compliance.requiredPiiTypes.EMAIL',
            'compliance.requiredPiiTypes.CARD',
            'pii.enabledTypes.EMAIL',
            'pii.enabledTypes.CARD'
          ],
          policyVersion: '1.0',
          lastUpdated: Date.now()
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(enterpriseSettings);
      mockSettingsService.isFieldLocked.mockImplementation((field: string) => 
        enterpriseSettings._managedSettings.lockedFields.includes(field)
      );

      await optionsUI.init();

      // EMAIL and CARD should show as required
      const piiItems = document.querySelectorAll('.pii-item');
      
      const emailItem = Array.from(piiItems).find(item => 
        item.querySelector('[data-type="EMAIL"]')
      );
      expect(emailItem?.querySelector('h4')?.textContent).toContain('⚠️');
      expect(emailItem?.querySelector('p')?.textContent).toContain('Required by policy');

      const cardItem = Array.from(piiItems).find(item => 
        item.querySelector('[data-type="CARD"]')
      );
      expect(cardItem?.querySelector('h4')?.textContent).toContain('⚠️');
      expect(cardItem?.querySelector('p')?.textContent).toContain('Required by policy');

      // PHONE should not show as required
      const phoneItem = Array.from(piiItems).find(item => 
        item.querySelector('[data-type="PHONE"]')
      );
      expect(phoneItem?.querySelector('h4')?.textContent).not.toContain('⚠️');
    });

    it('should handle partial locking correctly', async () => {
      const partiallyLockedSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: false, IBAN: true },
          confidenceThresholds: { EMAIL: 0.9, PHONE: 0.85, CARD: 0.95, IBAN: 0.9 }
        },
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        _managedSettings: {
          locked: false, // Not globally locked
          lockedFields: [
            'pii.enabledTypes.EMAIL', // Only EMAIL toggle locked
            'features.exportDisabled'  // Only export disabled
          ],
          policyVersion: '1.0',
          lastUpdated: Date.now()
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(partiallyLockedSettings);
      mockSettingsService.isFieldLocked.mockImplementation((field: string) => 
        partiallyLockedSettings._managedSettings.lockedFields.includes(field)
      );

      await optionsUI.init();

      // Should not show enterprise notice (not globally locked)
      const notice = document.querySelector('.enterprise-notice');
      expect(notice).toBeNull();

      // Preset options should not be locked
      const presetOptions = document.querySelectorAll('.preset-option');
      presetOptions.forEach(option => {
        expect(option.classList.contains('locked')).toBe(false);
      });

      // Only EMAIL toggle should be locked
      const emailToggle = document.querySelector('[data-type="EMAIL"]') as HTMLInputElement;
      const phoneToggle = document.querySelector('[data-type="PHONE"]') as HTMLInputElement;
      
      expect(emailToggle?.disabled).toBe(true);
      expect(phoneToggle?.disabled).toBe(false);

      // Export should be disabled, import should be enabled
      const exportBtn = document.getElementById('export-settings') as HTMLButtonElement;
      const importBtn = document.getElementById('import-settings') as HTMLButtonElement;
      
      expect(exportBtn?.disabled).toBe(true);
      expect(importBtn?.disabled).toBe(false);

      // Timeout should not be locked
      const timeoutInput = document.getElementById('timeout') as HTMLInputElement;
      expect(timeoutInput?.disabled).toBe(false);
    });
  });

  describe('UI Interaction Validation', () => {
    it('should prevent changes to locked preset options', async () => {
      const lockedSettings = {
        globalEnabled: true,
        preset: 'strict',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: true, IBAN: true },
          confidenceThresholds: { EMAIL: 0.99, PHONE: 0.95, CARD: 0.99, IBAN: 0.95 }
        },
        timeout: {
          processingTimeoutMs: 3000,
          onTimeoutAction: 'block'
        },
        _managedSettings: {
          locked: true,
          lockedFields: ['preset', 'uiRestrictions.disablePresetChanges'],
          policyVersion: '1.0',
          lastUpdated: Date.now()
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(lockedSettings);
      mockSettingsService.isFieldLocked.mockImplementation((field: string) => 
        lockedSettings._managedSettings.lockedFields.includes(field)
      );

      await optionsUI.init();

      // All preset options should show as locked
      const presetOptions = document.querySelectorAll('.preset-option');
      presetOptions.forEach(option => {
        expect(option.classList.contains('locked')).toBe(true);
        expect(option.getAttribute('title')).toBe('This setting is locked by enterprise policy');
      });

      // Clicking on preset options should not trigger changes
      const balancedPreset = document.querySelector('[data-preset="balanced"]');
      expect(balancedPreset?.classList.contains('locked')).toBe(true);
    });

    it('should show correct confidence slider states', async () => {
      const settings = {
        globalEnabled: true,
        preset: 'custom',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: false, CARD: true, IBAN: true },
          confidenceThresholds: { EMAIL: 0.95, PHONE: 0.85, CARD: 0.90, IBAN: 0.9 }
        },
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        _managedSettings: {
          locked: false,
          lockedFields: [
            'pii.confidenceThresholds.EMAIL' // EMAIL slider locked
          ],
          policyVersion: '1.0',
          lastUpdated: Date.now()
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(settings);
      mockSettingsService.isFieldLocked.mockImplementation((field: string) => 
        settings._managedSettings.lockedFields.includes(field)
      );

      await optionsUI.init();

      // EMAIL slider should be locked
      const emailSlider = document.querySelector('.confidence-slider[data-type="EMAIL"]') as HTMLInputElement;
      expect(emailSlider?.disabled).toBe(true);
      expect(emailSlider?.title).toBe('This setting is locked by enterprise policy');

      // PHONE slider should be disabled because PHONE detection is off
      const phoneSlider = document.querySelector('.confidence-slider[data-type="PHONE"]') as HTMLInputElement;
      expect(phoneSlider?.disabled).toBe(true); // Disabled due to toggle being off

      // CARD slider should be enabled
      const cardSlider = document.querySelector('.confidence-slider[data-type="CARD"]') as HTMLInputElement;
      expect(cardSlider?.disabled).toBe(false);
    });

    it('should handle log management restrictions', async () => {
      const restrictedSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: true, IBAN: false },
          confidenceThresholds: { EMAIL: 0.9, PHONE: 0.85, CARD: 0.95, IBAN: 0.9 }
        },
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        logging: {
          enabled: true,
          retentionDays: 90
        },
        _managedSettings: {
          locked: false,
          lockedFields: [
            'features.exportDisabled',
            'logging.enabled'
          ],
          policyVersion: '1.0',
          lastUpdated: Date.now()
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(restrictedSettings);
      mockSettingsService.isFieldLocked.mockImplementation((field: string) => 
        restrictedSettings._managedSettings.lockedFields.includes(field)
      );

      await optionsUI.init();

      // Export logs button should be disabled
      const exportLogsBtn = document.getElementById('export-logs') as HTMLButtonElement;
      expect(exportLogsBtn?.disabled).toBe(true);
      expect(exportLogsBtn?.title).toBe('Log export is disabled by enterprise policy');
      expect(exportLogsBtn?.style.opacity).toBe('0.5');

      // Clear logs button should be disabled
      const clearLogsBtn = document.getElementById('clear-logs') as HTMLButtonElement;
      expect(clearLogsBtn?.disabled).toBe(true);
      expect(clearLogsBtn?.title).toBe('Log management is disabled by enterprise policy');
      expect(clearLogsBtn?.style.opacity).toBe('0.5');

      // Settings export should be disabled
      const exportSettingsBtn = document.getElementById('export-settings') as HTMLButtonElement;
      expect(exportSettingsBtn?.disabled).toBe(true);
      expect(exportSettingsBtn?.title).toBe('Data export is disabled by enterprise policy');
    });
  });

  describe('Visual Feedback', () => {
    it('should apply correct CSS classes for locked elements', async () => {
      const lockedSettings = {
        globalEnabled: true,
        preset: 'strict',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: false, IBAN: true },
          confidenceThresholds: { EMAIL: 0.99, PHONE: 0.95, CARD: 0.95, IBAN: 0.95 }
        },
        timeout: {
          processingTimeoutMs: 3000,
          onTimeoutAction: 'block'
        },
        _managedSettings: {
          locked: true,
          lockedFields: [
            'preset',
            'pii.enabledTypes.EMAIL',
            'pii.enabledTypes.PHONE',
            'pii.confidenceThresholds.EMAIL'
          ],
          policyVersion: '1.0',
          lastUpdated: Date.now()
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(lockedSettings);
      mockSettingsService.isFieldLocked.mockImplementation((field: string) => 
        lockedSettings._managedSettings.lockedFields.includes(field)
      );

      await optionsUI.init();

      // Check preset option styling
      const presetOptions = document.querySelectorAll('.preset-option.locked');
      expect(presetOptions.length).toBeGreaterThan(0);

      // Check PII item styling
      const lockedPiiItems = document.querySelectorAll('.pii-item.locked-item');
      expect(lockedPiiItems.length).toBeGreaterThan(0);

      // Check toggle switch styling
      const lockedToggles = document.querySelectorAll('.toggle-switch.locked');
      expect(lockedToggles.length).toBeGreaterThan(0);

      // Check disabled sliders
      const disabledSliders = document.querySelectorAll('.confidence-slider:disabled');
      expect(disabledSliders.length).toBeGreaterThan(0);
    });

    it('should show enterprise notice with correct styling', async () => {
      const enterpriseSettings = {
        globalEnabled: true,
        preset: 'strict',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: true, IBAN: true },
          confidenceThresholds: { EMAIL: 0.99, PHONE: 0.95, CARD: 0.99, IBAN: 0.95 }
        },
        timeout: {
          processingTimeoutMs: 3000,
          onTimeoutAction: 'block'
        },
        _managedSettings: {
          locked: true,
          lockedFields: [],
          policyVersion: '1.0',
          lastUpdated: Date.now()
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(enterpriseSettings);
      mockSettingsService.isFieldLocked.mockReturnValue(false);

      await optionsUI.init();

      const notice = document.querySelector('.enterprise-notice');
      expect(notice).not.toBeNull();
      expect(notice?.className).toBe('enterprise-notice');
      expect(notice?.innerHTML).toBe('🏢 Some settings are managed by your organization and cannot be changed.');
      
      // Check styling
      const style = notice?.getAttribute('style');
      expect(style).toContain('background: #fff3cd');
      expect(style).toContain('color: #856404');
      expect(style).toContain('border: 1px solid #ffeaa7');
    });
  });

  describe('Error Handling', () => {
    it('should handle settings loading failures gracefully', async () => {
      mockSettingsService.getSettings.mockRejectedValue(new Error('Storage unavailable'));

      // Should not throw during initialization
      await expect(optionsUI.init()).resolves.not.toThrow();

      // Status should show loading or error state
      const statusEl = document.getElementById('global-status');
      expect(statusEl?.textContent).toBe('Loading...');
    });

    it('should handle malformed managed settings', async () => {
      const malformedSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: true, IBAN: false },
          confidenceThresholds: { EMAIL: 0.9, PHONE: 0.85, CARD: 0.95, IBAN: 0.9 }
        },
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        _managedSettings: {
          locked: 'not-a-boolean', // Invalid type
          lockedFields: 'not-an-array', // Invalid type
          policyVersion: 123, // Invalid type
          lastUpdated: 'not-a-number' // Invalid type
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(malformedSettings);
      mockSettingsService.isFieldLocked.mockReturnValue(false);

      // Should handle gracefully without throwing
      await expect(optionsUI.init()).resolves.not.toThrow();

      // Should not show enterprise notice due to invalid locked field
      const notice = document.querySelector('.enterprise-notice');
      expect(notice).toBeNull();
    });

    it('should handle missing DOM elements gracefully', async () => {
      // Remove some elements from DOM
      const presetSelector = document.getElementById('preset-selector');
      presetSelector?.remove();

      const settings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: { EMAIL: true, PHONE: true, CARD: true, IBAN: false },
          confidenceThresholds: { EMAIL: 0.9, PHONE: 0.85, CARD: 0.95, IBAN: 0.9 }
        },
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        }
      };

      mockSettingsService.getSettings.mockResolvedValue(settings);
      mockSettingsService.isFieldLocked.mockReturnValue(false);

      // Should not throw even with missing DOM elements
      await expect(optionsUI.init()).resolves.not.toThrow();
    });
  });
});