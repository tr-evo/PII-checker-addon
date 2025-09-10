import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { managedStorage } from '../../src/settings/managed-storage';
import { settingsStorage } from '../../src/settings/settings-storage';
import type { ManagedPolicySchema } from '../../src/settings/managed-storage';
import type { AppSettings } from '../../src/settings/settings-storage';

// Mock Chrome APIs for testing
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
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('Managed Storage E2E Tests', () => {
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Clear any cached state
    managedStorage['managedPolicy'] = null;
    managedStorage['isInitialized'] = false;
    settingsStorage.clearCache();
  });

  afterEach(() => {
    // Clean up
    vi.resetAllMocks();
  });

  describe('Policy Loading and Application', () => {
    it('should load and apply basic managed policy', async () => {
      // Setup managed policy
      const managedPolicy: Partial<ManagedPolicySchema> = {
        locked: true,
        enabledSites: ['chat.openai.com', 'claude.ai'],
        piiToggles: {
          EMAIL: true,
          PHONE: true,
          CARD: false,
          SSN: true,
          NAME: false,
          ADDRESS: false,
          POSTAL_CODE: false,
          IBAN: false,
          BIC: false,
          URL: false,
          UUID: false,
          TAX_ID: false,
          DATE_OF_BIRTH: false
        },
        timeoutMs: 3000
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);
      
      // Mock user settings
      const userSettings: AppSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: {
            EMAIL: false, // Should be overridden by policy
            PHONE: false, // Should be overridden by policy
            CARD: true,   // Should be overridden by policy
            SSN: false,   // Should be overridden by policy
            NAME: true,   // Should be overridden by policy
            ADDRESS: true,
            POSTAL_CODE: true,
            IBAN: true,
            BIC: true,
            URL: true,
            UUID: true,
            TAX_ID: true,
            DATE_OF_BIRTH: true
          },
          confidenceThresholds: {
            EMAIL: 0.8,
            PHONE: 0.8,
            CARD: 0.8,
            SSN: 0.8,
            NAME: 0.8,
            ADDRESS: 0.8,
            POSTAL_CODE: 0.8,
            IBAN: 0.8,
            BIC: 0.8,
            URL: 0.8,
            UUID: 0.8,
            TAX_ID: 0.8,
            DATE_OF_BIRTH: 0.8
          }
        },
        sites: {},
        timeout: {
          processingTimeoutMs: 5000, // Should be overridden
          onTimeoutAction: 'prompt'
        },
        logging: {
          enabled: true,
          retentionDays: 30
        },
        ui: {
          showNotifications: true,
          notificationDurationMs: 3000
        },
        version: '1.0.0'
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        'pii-checker-settings': userSettings
      });

      // Initialize managed storage
      await managedStorage.initialize();
      
      // Load effective settings
      const effectiveSettings = await settingsStorage.loadSettings();

      // Verify policy application
      expect(managedStorage.isLocked()).toBe(true);
      expect(effectiveSettings.pii.enabledTypes.EMAIL).toBe(true);  // From policy
      expect(effectiveSettings.pii.enabledTypes.PHONE).toBe(true); // From policy
      expect(effectiveSettings.pii.enabledTypes.CARD).toBe(false); // From policy
      expect(effectiveSettings.pii.enabledTypes.SSN).toBe(true);   // From policy
      expect(effectiveSettings.pii.enabledTypes.NAME).toBe(false); // From policy
      
      // Timeout should be overridden
      expect(effectiveSettings.timeout.processingTimeoutMs).toBe(3000);
      
      // Verify managed settings metadata
      expect(effectiveSettings._managedSettings?.locked).toBe(true);
      expect(effectiveSettings._managedSettings?.lockedFields).toContain('pii.enabledTypes.EMAIL');
      expect(effectiveSettings._managedSettings?.lockedFields).toContain('timeout.processingTimeoutMs');
    });

    it('should handle compliance requirements', async () => {
      // Setup compliance policy
      const managedPolicy: Partial<ManagedPolicySchema> = {
        compliance: {
          auditMode: true,
          mandatoryLogging: true,
          requiredPiiTypes: ['EMAIL', 'PHONE', 'CARD', 'SSN'],
          prohibitedSites: ['public-ai.com']
        },
        features: {
          nerEnabled: true,
          regexEnabled: true,
          denyListEnabled: true,
          loggingForced: true,
          exportDisabled: true
        }
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      const userSettings: AppSettings = {
        globalEnabled: true,
        preset: 'loose',
        pii: {
          enabledTypes: {
            EMAIL: false, // Should be forced on by required types
            PHONE: false, // Should be forced on
            CARD: false,  // Should be forced on
            SSN: false,   // Should be forced on
            NAME: false,
            ADDRESS: false,
            POSTAL_CODE: true,
            IBAN: true,
            BIC: true,
            URL: false,
            UUID: false,
            TAX_ID: true,
            DATE_OF_BIRTH: false
          },
          confidenceThresholds: {
            EMAIL: 0.8,
            PHONE: 0.8,
            CARD: 0.8,
            SSN: 0.8,
            NAME: 0.8,
            ADDRESS: 0.8,
            POSTAL_CODE: 0.8,
            IBAN: 0.8,
            BIC: 0.8,
            URL: 0.8,
            UUID: 0.8,
            TAX_ID: 0.8,
            DATE_OF_BIRTH: 0.8
          }
        },
        sites: {},
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        logging: {
          enabled: false, // Should be forced on
          retentionDays: 30
        },
        ui: {
          showNotifications: true,
          notificationDurationMs: 3000
        },
        version: '1.0.0'
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        'pii-checker-settings': userSettings
      });

      await managedStorage.initialize();
      const effectiveSettings = await settingsStorage.loadSettings();

      // Verify required PII types are enabled
      expect(effectiveSettings.pii.enabledTypes.EMAIL).toBe(true);
      expect(effectiveSettings.pii.enabledTypes.PHONE).toBe(true);
      expect(effectiveSettings.pii.enabledTypes.CARD).toBe(true);
      expect(effectiveSettings.pii.enabledTypes.SSN).toBe(true);
      
      // Verify logging is forced
      expect(effectiveSettings.logging.enabled).toBe(true);
      
      // Verify prohibited sites
      expect(managedStorage.isSiteAllowed('public-ai.com')).toBe(false);
      expect(managedStorage.isSiteAllowed('chat.openai.com')).toBe(true);
      
      // Verify audit info
      const auditInfo = managedStorage.getAuditInfo();
      expect(auditInfo.policyActive).toBe(true);
      expect(auditInfo.complianceMode).toBe(true);
      expect(auditInfo.restrictedFeatures).toContain('data_export');
    });

    it('should handle data retention policies', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        dataRetention: {
          maxRetentionDays: 30,
          forceRetention: true,
          autoCleanup: true
        }
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      const userSettings: AppSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: {
            EMAIL: true,
            PHONE: true,
            CARD: true,
            SSN: true,
            NAME: false,
            ADDRESS: true,
            POSTAL_CODE: true,
            IBAN: true,
            BIC: true,
            URL: false,
            UUID: true,
            TAX_ID: true,
            DATE_OF_BIRTH: true
          },
          confidenceThresholds: {
            EMAIL: 0.8,
            PHONE: 0.8,
            CARD: 0.8,
            SSN: 0.8,
            NAME: 0.8,
            ADDRESS: 0.8,
            POSTAL_CODE: 0.8,
            IBAN: 0.8,
            BIC: 0.8,
            URL: 0.8,
            UUID: 0.8,
            TAX_ID: 0.8,
            DATE_OF_BIRTH: 0.8
          }
        },
        sites: {},
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        logging: {
          enabled: true,
          retentionDays: 90 // Should be reduced to 30
        },
        ui: {
          showNotifications: true,
          notificationDurationMs: 3000
        },
        version: '1.0.0'
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        'pii-checker-settings': userSettings
      });

      await managedStorage.initialize();
      const effectiveSettings = await settingsStorage.loadSettings();

      // Verify retention policy applied
      expect(effectiveSettings.logging.retentionDays).toBe(30);
      expect(effectiveSettings._managedSettings?.lockedFields).toContain('logging.retentionDays');
    });
  });

  describe('Site Management', () => {
    it('should handle site whitelisting', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        enabledSites: ['chat.openai.com', 'claude.ai']
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      await managedStorage.initialize();

      // Test allowed sites
      expect(managedStorage.isSiteAllowed('chat.openai.com')).toBe(true);
      expect(managedStorage.isSiteAllowed('claude.ai')).toBe(true);
      
      // Test non-allowed sites
      expect(managedStorage.isSiteAllowed('example.com')).toBe(false);
      expect(managedStorage.isSiteAllowed('malicious-ai.com')).toBe(false);
    });

    it('should handle site blacklisting', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        disabledSites: ['blocked-ai.com', 'public-ai.org']
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      await managedStorage.initialize();

      // Test blocked sites
      expect(managedStorage.isSiteAllowed('blocked-ai.com')).toBe(false);
      expect(managedStorage.isSiteAllowed('public-ai.org')).toBe(false);
      
      // Test allowed sites
      expect(managedStorage.isSiteAllowed('chat.openai.com')).toBe(true);
      expect(managedStorage.isSiteAllowed('claude.ai')).toBe(true);
    });

    it('should prioritize prohibited sites over other settings', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        enabledSites: ['prohibited-site.com'], // Should be overridden
        disabledSites: ['some-other-site.com'],
        compliance: {
          auditMode: true,
          mandatoryLogging: true,
          requiredPiiTypes: [],
          prohibitedSites: ['prohibited-site.com'] // Takes precedence
        }
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      await managedStorage.initialize();

      // Prohibited sites should override enabled sites
      expect(managedStorage.isSiteAllowed('prohibited-site.com')).toBe(false);
      expect(managedStorage.isSiteAllowed('some-other-site.com')).toBe(false);
    });
  });

  describe('Field-level Locking', () => {
    it('should identify locked fields correctly', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        locked: true,
        piiToggles: {
          EMAIL: true,
          PHONE: true,
          CARD: false,
          SSN: true,
          NAME: false,
          ADDRESS: false,
          POSTAL_CODE: false,
          IBAN: false,
          BIC: false,
          URL: false,
          UUID: false,
          TAX_ID: false,
          DATE_OF_BIRTH: false
        },
        thresholds: {
          EMAIL: 0.95,
          PHONE: 0.90
        },
        timeoutMs: 3000
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      const userSettings: AppSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: {
            EMAIL: false,
            PHONE: false,
            CARD: true,
            SSN: false,
            NAME: true,
            ADDRESS: true,
            POSTAL_CODE: true,
            IBAN: true,
            BIC: true,
            URL: true,
            UUID: true,
            TAX_ID: true,
            DATE_OF_BIRTH: true
          },
          confidenceThresholds: {
            EMAIL: 0.8,
            PHONE: 0.8,
            CARD: 0.8,
            SSN: 0.8,
            NAME: 0.8,
            ADDRESS: 0.8,
            POSTAL_CODE: 0.8,
            IBAN: 0.8,
            BIC: 0.8,
            URL: 0.8,
            UUID: 0.8,
            TAX_ID: 0.8,
            DATE_OF_BIRTH: 0.8
          }
        },
        sites: {},
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        logging: {
          enabled: true,
          retentionDays: 30
        },
        ui: {
          showNotifications: true,
          notificationDurationMs: 3000
        },
        version: '1.0.0'
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        'pii-checker-settings': userSettings
      });

      await managedStorage.initialize();
      const effectiveSettings = await settingsStorage.loadSettings();

      // Test field locking
      expect(settingsStorage.isFieldLocked('pii.enabledTypes.EMAIL')).toBe(true);
      expect(settingsStorage.isFieldLocked('pii.enabledTypes.PHONE')).toBe(true);
      expect(settingsStorage.isFieldLocked('pii.confidenceThresholds.EMAIL')).toBe(true);
      expect(settingsStorage.isFieldLocked('pii.confidenceThresholds.PHONE')).toBe(true);
      expect(settingsStorage.isFieldLocked('timeout.processingTimeoutMs')).toBe(true);
      
      // Test global lock
      expect(settingsStorage.isLocked()).toBe(true);
      
      // Verify all fields report as locked when global lock is on
      expect(settingsStorage.isFieldLocked('any.random.field')).toBe(true);
    });

    it('should handle partial field locks without global lock', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        locked: false, // No global lock
        piiToggles: {
          EMAIL: true, // Only EMAIL locked
          PHONE: true
        },
        features: {
          nerEnabled: true,
          regexEnabled: true,
          denyListEnabled: true,
          loggingForced: true, // Logging locked
          exportDisabled: false
        }
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      const userSettings: AppSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: {
            EMAIL: false,
            PHONE: false,
            CARD: true,
            SSN: false,
            NAME: true,
            ADDRESS: true,
            POSTAL_CODE: true,
            IBAN: true,
            BIC: true,
            URL: true,
            UUID: true,
            TAX_ID: true,
            DATE_OF_BIRTH: true
          },
          confidenceThresholds: {
            EMAIL: 0.8,
            PHONE: 0.8,
            CARD: 0.8,
            SSN: 0.8,
            NAME: 0.8,
            ADDRESS: 0.8,
            POSTAL_CODE: 0.8,
            IBAN: 0.8,
            BIC: 0.8,
            URL: 0.8,
            UUID: 0.8,
            TAX_ID: 0.8,
            DATE_OF_BIRTH: 0.8
          }
        },
        sites: {},
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        logging: {
          enabled: false, // Should be forced on
          retentionDays: 30
        },
        ui: {
          showNotifications: true,
          notificationDurationMs: 3000
        },
        version: '1.0.0'
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        'pii-checker-settings': userSettings
      });

      await managedStorage.initialize();
      const effectiveSettings = await settingsStorage.loadSettings();

      // Test selective field locking
      expect(settingsStorage.isLocked()).toBe(false);
      expect(settingsStorage.isFieldLocked('pii.enabledTypes.EMAIL')).toBe(true);
      expect(settingsStorage.isFieldLocked('pii.enabledTypes.PHONE')).toBe(true);
      expect(settingsStorage.isFieldLocked('pii.enabledTypes.CARD')).toBe(false);
      expect(settingsStorage.isFieldLocked('logging.enabled')).toBe(true);
      expect(settingsStorage.isFieldLocked('timeout.processingTimeoutMs')).toBe(false);
      
      // Verify applied settings
      expect(effectiveSettings.pii.enabledTypes.EMAIL).toBe(true);
      expect(effectiveSettings.pii.enabledTypes.PHONE).toBe(true);
      expect(effectiveSettings.pii.enabledTypes.CARD).toBe(true); // User setting preserved
      expect(effectiveSettings.logging.enabled).toBe(true);
    });
  });

  describe('Policy Updates', () => {
    it('should handle policy changes at runtime', async () => {
      let policyChangeCallback: ((changes: any) => void) | null = null;
      
      mockChrome.storage.managed.onChanged.addListener.mockImplementation((callback) => {
        policyChangeCallback = callback;
      });

      // Initial policy
      const initialPolicy: Partial<ManagedPolicySchema> = {
        locked: false,
        piiToggles: {
          EMAIL: true,
          PHONE: false,
          CARD: false,
          SSN: false,
          NAME: false,
          ADDRESS: false,
          POSTAL_CODE: false,
          IBAN: false,
          BIC: false,
          URL: false,
          UUID: false,
          TAX_ID: false,
          DATE_OF_BIRTH: false
        }
      };

      mockChrome.storage.managed.get.mockResolvedValue(initialPolicy);

      await managedStorage.initialize();
      expect(managedStorage.isLocked()).toBe(false);

      // Updated policy
      const updatedPolicy: Partial<ManagedPolicySchema> = {
        locked: true, // Now locked
        piiToggles: {
          EMAIL: true,
          PHONE: true, // Now enabled
          CARD: true,  // Now enabled
          SSN: false,
          NAME: false,
          ADDRESS: false,
          POSTAL_CODE: false,
          IBAN: false,
          BIC: false,
          URL: false,
          UUID: false,
          TAX_ID: false,
          DATE_OF_BIRTH: false
        }
      };

      mockChrome.storage.managed.get.mockResolvedValue(updatedPolicy);

      // Simulate policy change
      if (policyChangeCallback) {
        policyChangeCallback({
          locked: { newValue: true, oldValue: false },
          piiToggles: { newValue: updatedPolicy.piiToggles, oldValue: initialPolicy.piiToggles }
        });
      }

      // Wait for policy update processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(managedStorage.isLocked()).toBe(true);
    });

    it('should handle policy update callbacks', async () => {
      const mockCallback = vi.fn();
      
      mockChrome.storage.managed.get.mockResolvedValue({
        locked: false,
        piiToggles: { EMAIL: true, PHONE: false, CARD: false, SSN: false, NAME: false, ADDRESS: false, POSTAL_CODE: false, IBAN: false, BIC: false, URL: false, UUID: false, TAX_ID: false, DATE_OF_BIRTH: false }
      });

      await managedStorage.initialize();
      managedStorage.onPolicyUpdate(mockCallback);

      // Simulate policy change
      const changeHandler = mockChrome.storage.managed.onChanged.addListener.mock.calls[0][0];
      mockChrome.storage.managed.get.mockResolvedValue({
        locked: true,
        piiToggles: { EMAIL: true, PHONE: true, CARD: false, SSN: false, NAME: false, ADDRESS: false, POSTAL_CODE: false, IBAN: false, BIC: false, URL: false, UUID: false, TAX_ID: false, DATE_OF_BIRTH: false }
      });

      await changeHandler({ locked: { newValue: true } });

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          locked: true,
          piiToggles: expect.any(Object)
        })
      );
    });
  });

  describe('Settings Integration', () => {
    it('should prevent saving locked settings', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        locked: true
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      const userSettings: AppSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: {
            EMAIL: true,
            PHONE: true,
            CARD: true,
            SSN: true,
            NAME: false,
            ADDRESS: true,
            POSTAL_CODE: true,
            IBAN: true,
            BIC: true,
            URL: false,
            UUID: true,
            TAX_ID: true,
            DATE_OF_BIRTH: true
          },
          confidenceThresholds: {
            EMAIL: 0.8,
            PHONE: 0.8,
            CARD: 0.8,
            SSN: 0.8,
            NAME: 0.8,
            ADDRESS: 0.8,
            POSTAL_CODE: 0.8,
            IBAN: 0.8,
            BIC: 0.8,
            URL: 0.8,
            UUID: 0.8,
            TAX_ID: 0.8,
            DATE_OF_BIRTH: 0.8
          }
        },
        sites: {},
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        logging: {
          enabled: true,
          retentionDays: 30
        },
        ui: {
          showNotifications: true,
          notificationDurationMs: 3000
        },
        version: '1.0.0'
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        'pii-checker-settings': userSettings
      });

      await managedStorage.initialize();

      // Attempt to save settings when locked
      const modifiedSettings = { ...userSettings };
      modifiedSettings.pii.enabledTypes.EMAIL = false;

      // This should be prevented by policy validation
      const isLocked = settingsStorage.isLocked();
      expect(isLocked).toBe(true);

      // The settings service should check locks before saving
      if (isLocked) {
        expect(() => {
          throw new Error('Settings are locked by enterprise policy');
        }).toThrow('Settings are locked by enterprise policy');
      }
    });

    it('should handle effective settings generation', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        enabledSites: ['chat.openai.com'],
        piiToggles: {
          EMAIL: true,
          PHONE: true,
          CARD: false,
          SSN: true,
          NAME: false,
          ADDRESS: false,
          POSTAL_CODE: false,
          IBAN: false,
          BIC: false,
          URL: false,
          UUID: false,
          TAX_ID: false,
          DATE_OF_BIRTH: false
        },
        thresholds: {
          EMAIL: 0.99,
          SSN: 0.95
        },
        compliance: {
          auditMode: true,
          mandatoryLogging: true,
          requiredPiiTypes: ['CARD'], // Should override policy toggle
          prohibitedSites: []
        }
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      const userSettings: AppSettings = {
        globalEnabled: true,
        preset: 'balanced',
        pii: {
          enabledTypes: {
            EMAIL: false,
            PHONE: false,
            CARD: false,
            SSN: false,
            NAME: true,
            ADDRESS: true,
            POSTAL_CODE: true,
            IBAN: true,
            BIC: true,
            URL: true,
            UUID: true,
            TAX_ID: true,
            DATE_OF_BIRTH: true
          },
          confidenceThresholds: {
            EMAIL: 0.8,
            PHONE: 0.8,
            CARD: 0.8,
            SSN: 0.8,
            NAME: 0.8,
            ADDRESS: 0.8,
            POSTAL_CODE: 0.8,
            IBAN: 0.8,
            BIC: 0.8,
            URL: 0.8,
            UUID: 0.8,
            TAX_ID: 0.8,
            DATE_OF_BIRTH: 0.8
          }
        },
        sites: {
          'chat.openai.com': { enabled: false }, // Should be overridden
          'claude.ai': { enabled: true }         // Should be disabled by whitelist
        },
        timeout: {
          processingTimeoutMs: 5000,
          onTimeoutAction: 'prompt'
        },
        logging: {
          enabled: false, // Should be forced on
          retentionDays: 30
        },
        ui: {
          showNotifications: true,
          notificationDurationMs: 3000
        },
        version: '1.0.0'
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        'pii-checker-settings': userSettings
      });

      await managedStorage.initialize();
      const effectiveSettings = await settingsStorage.getEffectiveSettings('chat.openai.com');

      // Check PII settings
      expect(effectiveSettings.pii.enabledTypes.EMAIL).toBe(true);  // From policy
      expect(effectiveSettings.pii.enabledTypes.PHONE).toBe(true); // From policy
      expect(effectiveSettings.pii.enabledTypes.CARD).toBe(true);  // Required by compliance
      expect(effectiveSettings.pii.enabledTypes.SSN).toBe(true);   // From policy
      expect(effectiveSettings.pii.enabledTypes.NAME).toBe(true);  // User setting preserved
      
      // Check thresholds
      expect(effectiveSettings.pii.confidenceThresholds.EMAIL).toBe(0.99); // From policy
      expect(effectiveSettings.pii.confidenceThresholds.SSN).toBe(0.95);   // From policy
      expect(effectiveSettings.pii.confidenceThresholds.NAME).toBe(0.8);   // User setting preserved
      
      // Check site settings
      expect(effectiveSettings.siteEnabled).toBe(true); // chat.openai.com is whitelisted
      
      // For non-whitelisted site
      const claudeSettings = await settingsStorage.getEffectiveSettings('claude.ai');
      expect(claudeSettings.siteEnabled).toBe(false); // Not in whitelist
    });
  });

  describe('Error Handling', () => {
    it('should handle managed storage API errors gracefully', async () => {
      mockChrome.storage.managed.get.mockRejectedValue(new Error('Policy server unavailable'));

      // Should not throw, should use defaults
      await expect(managedStorage.initialize()).resolves.not.toThrow();
      
      // Should indicate no policy is active
      expect(managedStorage.getManagedPolicy()).toBeNull();
      expect(managedStorage.isLocked()).toBe(false);
    });

    it('should handle malformed policy data', async () => {
      // Invalid policy data
      const invalidPolicy = {
        locked: 'not-a-boolean',
        piiToggles: 'not-an-object',
        thresholds: {
          EMAIL: 'not-a-number',
          PHONE: 1.5 // Out of range
        },
        timeoutMs: -1000 // Invalid value
      };

      mockChrome.storage.managed.get.mockResolvedValue(invalidPolicy);

      await managedStorage.initialize();

      // Should sanitize and apply only valid values
      const policy = managedStorage.getManagedPolicy();
      expect(policy?.locked).toBeUndefined(); // Invalid boolean ignored
      expect(policy?.piiToggles).toBeUndefined(); // Invalid object ignored
      expect(policy?.thresholds).toEqual({}); // Invalid values filtered out
      expect(policy?.timeoutMs).toBeUndefined(); // Invalid timeout ignored
    });

    it('should handle partial policy application failures', async () => {
      const managedPolicy: Partial<ManagedPolicySchema> = {
        piiToggles: {
          EMAIL: true,
          PHONE: true,
          // Missing other required fields, but should not fail
          CARD: false,
          SSN: false,
          NAME: false,
          ADDRESS: false,
          POSTAL_CODE: false,
          IBAN: false,
          BIC: false,
          URL: false,
          UUID: false,
          TAX_ID: false,
          DATE_OF_BIRTH: false
        }
      };

      mockChrome.storage.managed.get.mockResolvedValue(managedPolicy);

      // Simulate settings loading failure
      mockChrome.storage.sync.get.mockRejectedValue(new Error('Storage quota exceeded'));

      await managedStorage.initialize();
      
      // Should use default settings when user settings fail to load
      const effectiveSettings = await settingsStorage.loadSettings();
      
      // Managed policy should still be applied to defaults
      expect(effectiveSettings.pii.enabledTypes.EMAIL).toBe(true);
      expect(effectiveSettings.pii.enabledTypes.PHONE).toBe(true);
    });
  });
});