import type { PIIType } from '../pii/regex-recognizers';
import { managedStorage, type EffectiveSettings } from './managed-storage';
// Logger functionality replaced with console for build compatibility

export type PresetType = 'strict' | 'balanced' | 'loose' | 'custom';

export interface PIISettings {
  enabledTypes: Record<PIIType, boolean>;
  confidenceThresholds: Record<PIIType, number>;
}

export interface SiteSettings {
  enabled: boolean;
  piiOverrides?: Partial<PIISettings>;
}

export interface TimeoutSettings {
  processingTimeoutMs: number;
  onTimeoutAction: 'block' | 'allow' | 'prompt';
}

export interface AppSettings {
  globalEnabled: boolean;
  preset: PresetType;
  pii: PIISettings;
  sites: Record<string, SiteSettings>;
  timeout: TimeoutSettings;
  logging: {
    enabled: boolean;
    retentionDays: number;
  };
  ui: {
    showNotifications: boolean;
    notificationDurationMs: number;
  };
  version: string;
}

// Default PII settings for different presets
const PRESET_DEFAULTS: Record<Exclude<PresetType, 'custom'>, Partial<PIISettings>> = {
  strict: {
    enabledTypes: {
      EMAIL: true,
      PHONE: true,
      IBAN: true,
      BIC: true,
      CARD: true,
      NAME: true,
      ADDRESS: true,
      POSTAL_CODE: true,
      URL: true,
      UUID: true,
      SSN: true,
      TAX_ID: true,
      DATE_OF_BIRTH: true
    },
    confidenceThresholds: {
      EMAIL: 0.8,
      PHONE: 0.8,
      IBAN: 0.8,
      BIC: 0.8,
      CARD: 0.8,
      NAME: 0.7,
      ADDRESS: 0.7,
      POSTAL_CODE: 0.8,
      URL: 0.9,
      UUID: 0.9,
      SSN: 0.8,
      TAX_ID: 0.8,
      DATE_OF_BIRTH: 0.7
    }
  },
  balanced: {
    enabledTypes: {
      EMAIL: true,
      PHONE: true,
      IBAN: true,
      BIC: true,
      CARD: true,
      NAME: false, // Names often have false positives
      ADDRESS: true,
      POSTAL_CODE: true,
      URL: false, // URLs might be needed in some contexts
      UUID: true,
      SSN: true,
      TAX_ID: true,
      DATE_OF_BIRTH: true
    },
    confidenceThresholds: {
      EMAIL: 0.9,
      PHONE: 0.85,
      IBAN: 0.9,
      BIC: 0.9,
      CARD: 0.9,
      NAME: 0.85,
      ADDRESS: 0.8,
      POSTAL_CODE: 0.9,
      URL: 0.95,
      UUID: 0.95,
      SSN: 0.9,
      TAX_ID: 0.9,
      DATE_OF_BIRTH: 0.8
    }
  },
  loose: {
    enabledTypes: {
      EMAIL: true,
      PHONE: true,
      IBAN: true,
      BIC: true,
      CARD: true,
      NAME: false,
      ADDRESS: false,
      POSTAL_CODE: true,
      URL: false,
      UUID: false,
      SSN: true,
      TAX_ID: true,
      DATE_OF_BIRTH: false
    },
    confidenceThresholds: {
      EMAIL: 0.95,
      PHONE: 0.9,
      IBAN: 0.95,
      BIC: 0.95,
      CARD: 0.95,
      NAME: 0.9,
      ADDRESS: 0.85,
      POSTAL_CODE: 0.95,
      URL: 0.98,
      UUID: 0.98,
      SSN: 0.95,
      TAX_ID: 0.95,
      DATE_OF_BIRTH: 0.85
    }
  }
};

// Default application settings
const DEFAULT_SETTINGS: AppSettings = {
  globalEnabled: true,
  preset: 'balanced',
  pii: PRESET_DEFAULTS.balanced as PIISettings,
  sites: {
    'chat.openai.com': { enabled: true },
    'claude.ai': { enabled: true },
    'bard.google.com': { enabled: true }
  },
  timeout: {
    processingTimeoutMs: 5000,
    onTimeoutAction: 'prompt'
  },
  logging: {
    enabled: true,
    retentionDays: 90
  },
  ui: {
    showNotifications: true,
    notificationDurationMs: 3000
  },
  version: '1.0.0'
};

/**
 * Service for managing extension settings using Chrome storage
 */
export class SettingsStorage {
  private readonly storageKey = 'pii-checker-settings';
  private cachedSettings: AppSettings | null = null;

  /**
   * Initialize managed storage
   */
  async initialize(): Promise<void> {
    await managedStorage.initialize();
  }

  /**
   * Load settings from storage with managed policy applied
   */
  async loadSettings(): Promise<EffectiveSettings> {
    // Ensure managed storage is initialized
    await this.initialize();

    if (this.cachedSettings) {
      return managedStorage.mergeSettings(this.cachedSettings);
    }

    try {
      const result = await chrome.storage.sync.get([this.storageKey]);
      const storedSettings = result[this.storageKey];

      if (!storedSettings) {
        console.log('[Settings] No stored settings found, using defaults');
        this.cachedSettings = { ...DEFAULT_SETTINGS };
        await this.saveSettings(this.cachedSettings);
        return managedStorage.mergeSettings(this.cachedSettings);
      }

      // Merge with defaults to handle version upgrades
      this.cachedSettings = this.mergeWithDefaults(storedSettings);
      
      console.log('[Settings] Loaded settings from storage');
      return managedStorage.mergeSettings(this.cachedSettings);
    } catch (error) {
      console.error('[Settings] Failed to load settings:', error);
      this.cachedSettings = { ...DEFAULT_SETTINGS };
      return managedStorage.mergeSettings(this.cachedSettings);
    }
  }

  /**
   * Check if settings are locked by enterprise policy
   */
  isLocked(): boolean {
    return managedStorage.isLocked();
  }

  /**
   * Check if a specific field is locked by policy
   */
  isFieldLocked(fieldPath: string): boolean {
    return managedStorage.isFieldLocked(fieldPath);
  }

  /**
   * Get managed policy for auditing
   */
  getAuditInfo() {
    return managedStorage.getAuditInfo();
  }

  /**
   * Save settings to storage (respects managed policy locks)
   */
  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await chrome.storage.sync.set({
        [this.storageKey]: settings
      });
      
      this.cachedSettings = { ...settings };
      console.log('[Settings] Settings saved successfully');
      
      // Notify other parts of the extension about settings changes
      this.notifySettingsChanged(settings);
    } catch (error) {
      console.error('[Settings] Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Update specific settings section
   */
  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const currentSettings = await this.loadSettings();
    const newSettings = { ...currentSettings, ...updates };
    await this.saveSettings(newSettings);
    return newSettings;
  }

  /**
   * Apply a preset to PII settings
   */
  async applyPreset(preset: Exclude<PresetType, 'custom'>): Promise<AppSettings> {
    const presetConfig = PRESET_DEFAULTS[preset];
    const updates: Partial<AppSettings> = {
      preset,
      pii: {
        ...presetConfig,
        enabledTypes: { ...presetConfig.enabledTypes! },
        confidenceThresholds: { ...presetConfig.confidenceThresholds! }
      } as PIISettings
    };

    return this.updateSettings(updates);
  }

  /**
   * Update site-specific settings
   */
  async updateSiteSettings(hostname: string, siteSettings: SiteSettings): Promise<AppSettings> {
    const currentSettings = await this.loadSettings();
    const newSiteSettings = {
      ...currentSettings.sites,
      [hostname]: siteSettings
    };

    return this.updateSettings({ sites: newSiteSettings });
  }

  /**
   * Get effective settings for a specific site
   */
  async getEffectiveSettings(hostname: string): Promise<{
    globalEnabled: boolean;
    siteEnabled: boolean;
    pii: PIISettings;
    timeout: TimeoutSettings;
  }> {
    const settings = await this.loadSettings();
    const siteSettings = settings.sites[hostname];

    let effectivePIISettings = { ...settings.pii };

    // Apply site-specific overrides
    if (siteSettings?.piiOverrides) {
      if (siteSettings.piiOverrides.enabledTypes) {
        effectivePIISettings.enabledTypes = {
          ...effectivePIISettings.enabledTypes,
          ...siteSettings.piiOverrides.enabledTypes
        };
      }
      if (siteSettings.piiOverrides.confidenceThresholds) {
        effectivePIISettings.confidenceThresholds = {
          ...effectivePIISettings.confidenceThresholds,
          ...siteSettings.piiOverrides.confidenceThresholds
        };
      }
    }

    return {
      globalEnabled: settings.globalEnabled,
      siteEnabled: siteSettings?.enabled ?? true,
      pii: effectivePIISettings,
      timeout: settings.timeout
    };
  }

  /**
   * Export settings as JSON
   */
  async exportSettings(): Promise<string> {
    const settings = await this.loadSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  async importSettings(jsonString: string): Promise<AppSettings> {
    try {
      const importedSettings = JSON.parse(jsonString) as AppSettings;
      
      // Validate and merge with defaults
      const validatedSettings = this.mergeWithDefaults(importedSettings);
      
      await this.saveSettings(validatedSettings);
      console.log('[Settings] Settings imported successfully');
      
      return validatedSettings;
    } catch (error) {
      console.error('[Settings] Failed to import settings:', error);
      throw new Error('Invalid settings format');
    }
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults(): Promise<AppSettings> {
    const defaultSettings = { ...DEFAULT_SETTINGS };
    await this.saveSettings(defaultSettings);
    console.log('[Settings] Settings reset to defaults');
    return defaultSettings;
  }

  /**
   * Clear cached settings (useful for testing)
   */
  clearCache(): void {
    this.cachedSettings = null;
  }

  /**
   * Merge stored settings with defaults to handle version upgrades
   */
  private mergeWithDefaults(stored: Partial<AppSettings>): AppSettings {
    const merged = { ...DEFAULT_SETTINGS };

    // Merge top-level properties
    if (stored.globalEnabled !== undefined) merged.globalEnabled = stored.globalEnabled;
    if (stored.preset) merged.preset = stored.preset;
    
    // Merge PII settings
    if (stored.pii) {
      if (stored.pii.enabledTypes) {
        merged.pii.enabledTypes = { ...merged.pii.enabledTypes, ...stored.pii.enabledTypes };
      }
      if (stored.pii.confidenceThresholds) {
        merged.pii.confidenceThresholds = { ...merged.pii.confidenceThresholds, ...stored.pii.confidenceThresholds };
      }
    }

    // Merge site settings
    if (stored.sites) {
      merged.sites = { ...merged.sites, ...stored.sites };
    }

    // Merge other sections
    if (stored.timeout) {
      merged.timeout = { ...merged.timeout, ...stored.timeout };
    }
    if (stored.logging) {
      merged.logging = { ...merged.logging, ...stored.logging };
    }
    if (stored.ui) {
      merged.ui = { ...merged.ui, ...stored.ui };
    }

    // Update version
    merged.version = DEFAULT_SETTINGS.version;

    return merged;
  }

  /**
   * Notify other parts of the extension about settings changes
   */
  private notifySettingsChanged(settings: AppSettings): void {
    // Send message to content scripts and other parts of extension
    chrome.runtime.sendMessage({
      type: 'SETTINGS_CHANGED',
      settings
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }
}

// Singleton instance
export const settingsStorage = new SettingsStorage();