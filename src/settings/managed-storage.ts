import type { PIIType } from '../pii/regex-recognizers';
import type { AppSettings, PresetType } from './settings-storage';
import { piiLogger } from '../logging/logger';

/**
 * Enterprise policy schema for managed deployment
 * This interface defines the structure that IT administrators can configure
 */
export interface ManagedPolicySchema {
  // Global lock settings
  locked: boolean;
  
  // Site management
  enabledSites: string[];
  disabledSites: string[];
  
  // PII type controls
  piiToggles: Record<PIIType, boolean>;
  
  // Detection thresholds
  thresholds: Record<PIIType, number>;
  
  // Performance settings
  timeoutMs: number;
  
  // Feature toggles
  features: {
    nerEnabled: boolean;
    regexEnabled: boolean;
    denyListEnabled: boolean;
    loggingForced: boolean;
    exportDisabled: boolean;
  };
  
  // Data retention policies
  dataRetention: {
    maxRetentionDays: number;
    forceRetention: boolean;
    autoCleanup: boolean;
  };
  
  // UI restrictions
  uiRestrictions: {
    hideAdvancedSettings: boolean;
    disablePresetChanges: boolean;
    requireAdminPassword: boolean;
  };
  
  // Compliance settings
  compliance: {
    auditMode: boolean;
    requiredPiiTypes: PIIType[];
    prohibitedSites: string[];
    mandatoryLogging: boolean;
  };
}

/**
 * Merged settings that combine managed policies with user preferences
 */
export interface EffectiveSettings extends AppSettings {
  // Indicates which settings are locked by policy
  readonly _managedSettings?: {
    locked: boolean;
    lockedFields: string[];
    policyVersion: string;
    lastUpdated: number;
  };
}

/**
 * Chrome Enterprise managed storage integration
 * Implements the three-tier storage hierarchy: managed > sync > local
 */
export class ManagedStorageService {
  private managedPolicy: Partial<ManagedPolicySchema> | null = null;
  private isInitialized = false;
  private onPolicyUpdateCallbacks: ((policy: Partial<ManagedPolicySchema>) => void)[] = [];

  /**
   * Initialize the managed storage service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if chrome.storage.managed is available
      if (chrome?.storage?.managed) {
        // Load initial managed policy
        await this.loadManagedPolicy();
        
        // Listen for policy updates
        chrome.storage.managed.onChanged.addListener(this.handlePolicyChange.bind(this));
        
        console.log('Managed storage initialized');
      } else {
        console.log('Managed storage not available (not in enterprise environment)');
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize managed storage:', error);
    }
  }

  /**
   * Load managed policy from Chrome Enterprise
   */
  private async loadManagedPolicy(): Promise<void> {
    try {
      const managedData = await chrome.storage.managed.get(null);
      this.managedPolicy = this.validatePolicySchema(managedData);
      
      console.log('Managed policy loaded:', {
        locked: this.managedPolicy?.locked || false,
        policyKeys: Object.keys(this.managedPolicy || {}),
      });
    } catch (error) {
      console.error('Failed to load managed policy:', error);
      this.managedPolicy = null;
    }
  }

  /**
   * Handle policy changes from Chrome Enterprise
   */
  private handlePolicyChange(changes: Record<string, chrome.storage.StorageChange>): void {
    console.log('Managed policy changed:', changes);
    
    // Reload the complete policy
    this.loadManagedPolicy().then(() => {
      // Notify all listeners about the policy update
      this.onPolicyUpdateCallbacks.forEach(callback => {
        try {
          callback(this.managedPolicy || {});
        } catch (error) {
          console.error('Error in policy update callback:', error);
        }
      });
    });
  }

  /**
   * Validate and sanitize managed policy schema
   */
  private validatePolicySchema(data: any): Partial<ManagedPolicySchema> {
    const policy: Partial<ManagedPolicySchema> = {};

    // Validate boolean fields
    if (typeof data.locked === 'boolean') {
      policy.locked = data.locked;
    }

    // Validate array fields
    if (Array.isArray(data.enabledSites)) {
      policy.enabledSites = data.enabledSites.filter((site: any): site is string => 
        typeof site === 'string' && site.length > 0
      );
    }

    if (Array.isArray(data.disabledSites)) {
      policy.disabledSites = data.disabledSites.filter((site: any): site is string => 
        typeof site === 'string' && site.length > 0
      );
    }

    // Validate PII toggles
    if (data.piiToggles && typeof data.piiToggles === 'object') {
      policy.piiToggles = {} as Record<PIIType, boolean>;
      const validPiiTypes: PIIType[] = [
        'EMAIL', 'PHONE', 'IBAN', 'BIC', 'CARD', 'NAME', 'ADDRESS', 
        'POSTAL_CODE', 'URL', 'UUID', 'SSN', 'TAX_ID', 'DATE_OF_BIRTH'
      ];
      
      validPiiTypes.forEach(type => {
        if (typeof data.piiToggles[type] === 'boolean') {
          policy.piiToggles![type] = data.piiToggles[type];
        }
      });
    }

    // Validate thresholds
    if (data.thresholds && typeof data.thresholds === 'object') {
      policy.thresholds = {} as Record<PIIType, number>;
      Object.entries(data.thresholds).forEach(([key, value]) => {
        if (typeof value === 'number' && value >= 0 && value <= 1) {
          (policy.thresholds as any)[key] = value;
        }
      });
    }

    // Validate timeout
    if (typeof data.timeoutMs === 'number' && data.timeoutMs > 0) {
      policy.timeoutMs = Math.min(data.timeoutMs, 60000); // Max 60 seconds
    }

    // Validate features object
    if (data.features && typeof data.features === 'object') {
      policy.features = {
        nerEnabled: typeof data.features.nerEnabled === 'boolean' ? data.features.nerEnabled : true,
        regexEnabled: typeof data.features.regexEnabled === 'boolean' ? data.features.regexEnabled : true,
        denyListEnabled: typeof data.features.denyListEnabled === 'boolean' ? data.features.denyListEnabled : true,
        loggingForced: typeof data.features.loggingForced === 'boolean' ? data.features.loggingForced : false,
        exportDisabled: typeof data.features.exportDisabled === 'boolean' ? data.features.exportDisabled : false,
      };
    }

    // Validate data retention
    if (data.dataRetention && typeof data.dataRetention === 'object') {
      policy.dataRetention = {
        maxRetentionDays: typeof data.dataRetention.maxRetentionDays === 'number' 
          ? Math.max(1, Math.min(data.dataRetention.maxRetentionDays, 365)) 
          : 30,
        forceRetention: typeof data.dataRetention.forceRetention === 'boolean' 
          ? data.dataRetention.forceRetention 
          : false,
        autoCleanup: typeof data.dataRetention.autoCleanup === 'boolean' 
          ? data.dataRetention.autoCleanup 
          : true,
      };
    }

    // Validate UI restrictions
    if (data.uiRestrictions && typeof data.uiRestrictions === 'object') {
      policy.uiRestrictions = {
        hideAdvancedSettings: typeof data.uiRestrictions.hideAdvancedSettings === 'boolean' 
          ? data.uiRestrictions.hideAdvancedSettings 
          : false,
        disablePresetChanges: typeof data.uiRestrictions.disablePresetChanges === 'boolean' 
          ? data.uiRestrictions.disablePresetChanges 
          : false,
        requireAdminPassword: typeof data.uiRestrictions.requireAdminPassword === 'boolean' 
          ? data.uiRestrictions.requireAdminPassword 
          : false,
      };
    }

    // Validate compliance settings
    if (data.compliance && typeof data.compliance === 'object') {
      policy.compliance = {
        auditMode: typeof data.compliance.auditMode === 'boolean' 
          ? data.compliance.auditMode 
          : false,
        requiredPiiTypes: Array.isArray(data.compliance.requiredPiiTypes) 
          ? data.compliance.requiredPiiTypes.filter((type: any): type is PIIType => 
              typeof type === 'string' && ['EMAIL', 'PHONE', 'IBAN', 'BIC', 'CARD', 'NAME', 'ADDRESS', 'POSTAL_CODE', 'URL', 'UUID', 'SSN', 'TAX_ID', 'DATE_OF_BIRTH'].includes(type)
            )
          : [],
        prohibitedSites: Array.isArray(data.compliance.prohibitedSites) 
          ? data.compliance.prohibitedSites.filter((site: any): site is string => typeof site === 'string')
          : [],
        mandatoryLogging: typeof data.compliance.mandatoryLogging === 'boolean' 
          ? data.compliance.mandatoryLogging 
          : false,
      };
    }

    return policy;
  }

  /**
   * Get the current managed policy
   */
  getManagedPolicy(): Partial<ManagedPolicySchema> | null {
    return this.managedPolicy;
  }

  /**
   * Check if settings are locked by enterprise policy
   */
  isLocked(): boolean {
    return this.managedPolicy?.locked === true;
  }

  /**
   * Check if a specific setting field is locked
   */
  isFieldLocked(_fieldPath: string): boolean {
    if (!this.isLocked()) return false;
    
    // If globally locked, all settings are locked
    if (this.managedPolicy?.locked) return true;
    
    // Check for specific field locks (future enhancement)
    return false;
  }

  /**
   * Merge managed policy with user settings
   * Priority: managed > sync > local
   */
  mergeSettings(userSettings: AppSettings): EffectiveSettings {
    if (!this.managedPolicy) {
      return userSettings;
    }

    const merged: EffectiveSettings = { ...userSettings };
    const lockedFields: string[] = [];

    // Apply managed PII toggles
    if (this.managedPolicy.piiToggles) {
      Object.entries(this.managedPolicy.piiToggles).forEach(([type, enabled]) => {
        merged.pii.enabledTypes[type as PIIType] = enabled;
        lockedFields.push(`pii.enabledTypes.${type}`);
      });
    }

    // Apply managed thresholds
    if (this.managedPolicy.thresholds) {
      Object.entries(this.managedPolicy.thresholds).forEach(([type, threshold]) => {
        merged.pii.confidenceThresholds[type as PIIType] = threshold;
        lockedFields.push(`pii.confidenceThresholds.${type}`);
      });
    }

    // Apply managed timeout
    if (typeof this.managedPolicy.timeoutMs === 'number') {
      merged.timeout.processingTimeoutMs = this.managedPolicy.timeoutMs;
      lockedFields.push('timeout.processingTimeoutMs');
    }

    // Apply managed site controls
    if (this.managedPolicy.enabledSites?.length) {
      // Only allow enabled sites
      Object.keys(merged.sites).forEach(site => {
        if (!this.managedPolicy!.enabledSites!.includes(site)) {
          merged.sites[site] = { enabled: false };
        }
      });
      lockedFields.push('sites');
    }

    if (this.managedPolicy.disabledSites?.length) {
      // Disable prohibited sites
      this.managedPolicy.disabledSites.forEach(site => {
        merged.sites[site] = { enabled: false };
      });
      lockedFields.push('sites');
    }

    // Apply feature restrictions
    if (this.managedPolicy.features?.loggingForced) {
      merged.logging.enabled = true;
      lockedFields.push('logging.enabled');
    }

    // Apply data retention policies
    if (this.managedPolicy.dataRetention) {
      if (this.managedPolicy.dataRetention.maxRetentionDays) {
        merged.logging.retentionDays = Math.min(
          merged.logging.retentionDays, 
          this.managedPolicy.dataRetention.maxRetentionDays
        );
        lockedFields.push('logging.retentionDays');
      }
    }

    // Apply compliance requirements
    if (this.managedPolicy.compliance?.requiredPiiTypes?.length) {
      this.managedPolicy.compliance.requiredPiiTypes.forEach(type => {
        merged.pii.enabledTypes[type] = true;
        lockedFields.push(`pii.enabledTypes.${type}`);
      });
    }

    // Add managed settings metadata
    (merged as any)._managedSettings = {
      locked: this.isLocked(),
      lockedFields,
      policyVersion: '1.0',
      lastUpdated: Date.now(),
    };

    return merged;
  }

  /**
   * Register callback for policy updates
   */
  onPolicyUpdate(callback: (policy: Partial<ManagedPolicySchema>) => void): void {
    this.onPolicyUpdateCallbacks.push(callback);
  }

  /**
   * Remove policy update callback
   */
  offPolicyUpdate(callback: (policy: Partial<ManagedPolicySchema>) => void): void {
    const index = this.onPolicyUpdateCallbacks.indexOf(callback);
    if (index > -1) {
      this.onPolicyUpdateCallbacks.splice(index, 1);
    }
  }

  /**
   * Check if a site is allowed by policy
   */
  isSiteAllowed(hostname: string): boolean {
    if (!this.managedPolicy) return true;

    // Check prohibited sites first
    if (this.managedPolicy.compliance?.prohibitedSites?.includes(hostname)) {
      return false;
    }

    if (this.managedPolicy.disabledSites?.includes(hostname)) {
      return false;
    }

    // If there's an enabled sites whitelist, check it
    if (this.managedPolicy.enabledSites?.length) {
      return this.managedPolicy.enabledSites.includes(hostname);
    }

    return true;
  }

  /**
   * Get audit information for compliance
   */
  getAuditInfo(): {
    policyActive: boolean;
    locked: boolean;
    restrictedFeatures: string[];
    complianceMode: boolean;
  } {
    return {
      policyActive: this.managedPolicy !== null,
      locked: this.isLocked(),
      restrictedFeatures: this.getRestrictedFeatures(),
      complianceMode: this.managedPolicy?.compliance?.auditMode === true,
    };
  }

  /**
   * Get list of features restricted by policy
   */
  private getRestrictedFeatures(): string[] {
    const restricted: string[] = [];

    if (this.managedPolicy?.features?.exportDisabled) {
      restricted.push('data_export');
    }

    if (this.managedPolicy?.uiRestrictions?.hideAdvancedSettings) {
      restricted.push('advanced_settings');
    }

    if (this.managedPolicy?.uiRestrictions?.disablePresetChanges) {
      restricted.push('preset_changes');
    }

    if (this.managedPolicy?.compliance?.mandatoryLogging) {
      restricted.push('logging_disable');
    }

    return restricted;
  }
}

// Singleton instance
export const managedStorage = new ManagedStorageService();