import { settingsStorage, type AppSettings, type PIISettings, type PresetType, type SiteSettings } from './settings-storage';
import type { PIIType } from '../pii/regex-recognizers';
import type { PIIDetectionOptions } from '../pii/pii-detector';

export interface PIITypeInfo {
  type: PIIType;
  label: string;
  description: string;
  category: 'financial' | 'personal' | 'contact' | 'identifier';
  examples: string[];
}

// PII type metadata for UI display
const PII_TYPE_INFO: Record<PIIType, PIITypeInfo> = {
  EMAIL: {
    type: 'EMAIL',
    label: 'Email Addresses',
    description: 'Email addresses like user@example.com',
    category: 'contact',
    examples: ['john.doe@company.com', 'support@website.org']
  },
  PHONE: {
    type: 'PHONE',
    label: 'Phone Numbers',
    description: 'Phone numbers in various formats',
    category: 'contact',
    examples: ['+1-555-123-4567', '(555) 123-4567', '555.123.4567']
  },
  IBAN: {
    type: 'IBAN',
    label: 'IBAN',
    description: 'International Bank Account Numbers',
    category: 'financial',
    examples: ['DE89 3704 0044 0532 0130 00', 'GB29 NWBK 6016 1331 9268 19']
  },
  BIC: {
    type: 'BIC',
    label: 'BIC/SWIFT',
    description: 'Bank Identifier Codes',
    category: 'financial',
    examples: ['DEUTDEFF', 'NWBKGB2L']
  },
  CARD: {
    type: 'CARD',
    label: 'Credit Cards',
    description: 'Credit card and debit card numbers',
    category: 'financial',
    examples: ['4111 1111 1111 1111', '5555-5555-5555-4444']
  },
  NAME: {
    type: 'NAME',
    label: 'Person Names',
    description: 'First and last names of people',
    category: 'personal',
    examples: ['John Doe', 'Marie Smith', 'Dr. Johnson']
  },
  ADDRESS: {
    type: 'ADDRESS',
    label: 'Addresses',
    description: 'Street addresses and locations',
    category: 'personal',
    examples: ['123 Main Street, New York, NY', '456 Oak Avenue, Suite 200']
  },
  POSTAL_CODE: {
    type: 'POSTAL_CODE',
    label: 'Postal Codes',
    description: 'ZIP codes, postal codes',
    category: 'personal',
    examples: ['12345', '90210', 'SW1A 1AA', '75001']
  },
  URL: {
    type: 'URL',
    label: 'URLs',
    description: 'Web addresses and links',
    category: 'identifier',
    examples: ['https://example.com', 'www.website.org/page']
  },
  UUID: {
    type: 'UUID',
    label: 'UUIDs',
    description: 'Unique identifiers',
    category: 'identifier',
    examples: ['123e4567-e89b-12d3-a456-426614174000']
  },
  SSN: {
    type: 'SSN',
    label: 'SSN',
    description: 'Social Security Numbers (US)',
    category: 'identifier',
    examples: ['123-45-6789', '987654321']
  },
  TAX_ID: {
    type: 'TAX_ID',
    label: 'Tax ID',
    description: 'Tax identification numbers',
    category: 'identifier',
    examples: ['12-3456789', 'EIN: 12-3456789']
  },
  DATE_OF_BIRTH: {
    type: 'DATE_OF_BIRTH',
    label: 'Birth Dates',
    description: 'Dates of birth',
    category: 'personal',
    examples: ['1990-01-15', 'January 15, 1990', '15/01/1990']
  }
};

/**
 * Service for managing PII detection settings
 */
export class SettingsService {
  private listeners: Set<(settings: AppSettings) => void> = new Set();

  constructor() {
    this.setupStorageListener();
  }

  /**
   * Get all available PII type information
   */
  getPIITypeInfo(): PIITypeInfo[] {
    return Object.values(PII_TYPE_INFO);
  }

  /**
   * Get PII types grouped by category
   */
  getPIITypesByCategory(): Record<string, PIITypeInfo[]> {
    const grouped: Record<string, PIITypeInfo[]> = {};
    
    for (const info of Object.values(PII_TYPE_INFO)) {
      if (!grouped[info.category]) {
        grouped[info.category] = [];
      }
      grouped[info.category].push(info);
    }
    
    return grouped;
  }

  /**
   * Get current settings
   */
  async getSettings(): Promise<AppSettings> {
    return settingsStorage.loadSettings();
  }

  /**
   * Update PII type toggle
   */
  async togglePIIType(type: PIIType, enabled: boolean): Promise<void> {
    const settings = await settingsStorage.loadSettings();
    settings.pii.enabledTypes[type] = enabled;
    settings.preset = 'custom'; // Mark as custom when manually modified
    await settingsStorage.saveSettings(settings);
  }

  /**
   * Update confidence threshold for a PII type
   */
  async setConfidenceThreshold(type: PIIType, threshold: number): Promise<void> {
    const settings = await settingsStorage.loadSettings();
    settings.pii.confidenceThresholds[type] = Math.max(0, Math.min(1, threshold));
    settings.preset = 'custom'; // Mark as custom when manually modified
    await settingsStorage.saveSettings(settings);
  }

  /**
   * Apply a preset configuration
   */
  async applyPreset(preset: Exclude<PresetType, 'custom'>): Promise<void> {
    await settingsStorage.applyPreset(preset);
  }

  /**
   * Update settings (direct passthrough to storage)
   */
  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    return settingsStorage.updateSettings(updates);
  }

  /**
   * Toggle global protection
   */
  async toggleGlobalProtection(enabled: boolean): Promise<void> {
    await settingsStorage.updateSettings({ globalEnabled: enabled });
  }

  /**
   * Toggle protection for a specific site
   */
  async toggleSiteProtection(hostname: string, enabled: boolean): Promise<void> {
    const settings = await settingsStorage.loadSettings();
    const currentSiteSettings = settings.sites[hostname] || { enabled: true };
    
    await settingsStorage.updateSiteSettings(hostname, {
      ...currentSiteSettings,
      enabled
    });
  }

  /**
   * Set site-specific PII override
   */
  async setSiteOverride(hostname: string, type: PIIType, enabled: boolean): Promise<void> {
    const settings = await settingsStorage.loadSettings();
    const currentSiteSettings = settings.sites[hostname] || { enabled: true };
    
    const piiOverrides = currentSiteSettings.piiOverrides || {
      enabledTypes: {} as Record<PIIType, boolean>,
      confidenceThresholds: {} as Record<PIIType, number>
    };

    piiOverrides.enabledTypes = piiOverrides.enabledTypes || {} as Record<PIIType, boolean>;
    piiOverrides.enabledTypes[type] = enabled;

    await settingsStorage.updateSiteSettings(hostname, {
      ...currentSiteSettings,
      piiOverrides
    });
  }

  /**
   * Get detection options for a specific site
   */
  async getDetectionOptions(hostname: string): Promise<PIIDetectionOptions> {
    const effective = await settingsStorage.getEffectiveSettings(hostname);
    
    if (!effective.globalEnabled || !effective.siteEnabled) {
      // Return options that disable all detection
      return {
        enabledTypes: new Set(),
        minConfidence: 1.0,
        useNER: false,
        useDenyList: false,
        useRegex: false,
        timeout: effective.timeout.processingTimeoutMs
      };
    }

    const enabledTypes = new Set<PIIType>();
    for (const [type, enabled] of Object.entries(effective.pii.enabledTypes)) {
      if (enabled) {
        enabledTypes.add(type as PIIType);
      }
    }

    return {
      enabledTypes,
      minConfidence: Math.min(...Object.values(effective.pii.confidenceThresholds)),
      useNER: true,
      useDenyList: true,
      useRegex: true,
      timeout: effective.timeout.processingTimeoutMs
    };
  }

  /**
   * Get timeout action for a site
   */
  async getTimeoutAction(hostname: string): Promise<'block' | 'allow' | 'prompt'> {
    const effective = await settingsStorage.getEffectiveSettings(hostname);
    return effective.timeout.onTimeoutAction;
  }

  /**
   * Update timeout settings
   */
  async updateTimeoutSettings(timeoutMs: number, action: 'block' | 'allow' | 'prompt'): Promise<void> {
    await settingsStorage.updateSettings({
      timeout: {
        processingTimeoutMs: timeoutMs,
        onTimeoutAction: action
      }
    });
  }

  /**
   * Export settings
   */
  async exportSettings(): Promise<string> {
    return settingsStorage.exportSettings();
  }

  /**
   * Import settings
   */
  async importSettings(jsonString: string): Promise<void> {
    await settingsStorage.importSettings(jsonString);
  }

  /**
   * Reset to defaults
   */
  async resetToDefaults(): Promise<void> {
    await settingsStorage.resetToDefaults();
  }

  /**
   * Add settings change listener
   */
  addSettingsListener(listener: (settings: AppSettings) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove settings change listener
   */
  removeSettingsListener(listener: (settings: AppSettings) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Get preset information
   */
  getPresetInfo(): Array<{
    value: Exclude<PresetType, 'custom'>;
    label: string;
    description: string;
  }> {
    return [
      {
        value: 'strict',
        label: 'Strict',
        description: 'Maximum protection - detects and masks all PII types with lower confidence thresholds'
      },
      {
        value: 'balanced',
        label: 'Balanced',
        description: 'Recommended setting - masks most critical PII while reducing false positives'
      },
      {
        value: 'loose',
        label: 'Loose',
        description: 'Minimal protection - only masks highly sensitive financial and identity information'
      }
    ];
  }

  /**
   * Get statistics about current settings
   */
  async getSettingsStats(): Promise<{
    totalTypes: number;
    enabledTypes: number;
    protectedSites: number;
    currentPreset: PresetType;
  }> {
    const settings = await settingsStorage.loadSettings();
    
    const enabledCount = Object.values(settings.pii.enabledTypes).filter(Boolean).length;
    const protectedSitesCount = Object.values(settings.sites).filter(site => site.enabled).length;

    return {
      totalTypes: Object.keys(PII_TYPE_INFO).length,
      enabledTypes: enabledCount,
      protectedSites: protectedSitesCount,
      currentPreset: settings.preset
    };
  }

  /**
   * Setup storage change listener
   */
  private setupStorageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes['pii-checker-settings']) {
          const newSettings = changes['pii-checker-settings'].newValue;
          if (newSettings) {
            this.notifyListeners(newSettings);
          }
        }
      });
    }

    // Also listen for runtime messages
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'SETTINGS_CHANGED') {
          this.notifyListeners(message.settings);
        }
      });
    }
  }

  /**
   * Notify all listeners of settings changes
   */
  private notifyListeners(settings: AppSettings): void {
    for (const listener of this.listeners) {
      try {
        listener(settings);
      } catch (error) {
        console.warn('[Settings] Error in settings listener:', error);
      }
    }
  }
}

// Singleton instance
export const settingsService = new SettingsService();