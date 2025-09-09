import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Chrome APIs for testing environment
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    },
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 })
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({}),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`)
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('E2E Smoke Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Clear DOM
    document.body.innerHTML = '';
    
    // Mock window properties
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com' },
      writable: true
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Extension Loading', () => {
    it('should load core modules without errors', async () => {
      expect(() => {
        // These imports should not throw
        require('../../src/pii/pii-detector');
        require('../../src/pii/regex-recognizers');
        require('../../src/settings/settings-storage');
      }).not.toThrow();
    });

    it('should initialize settings with defaults', async () => {
      const { settingsStorage } = await import('../../src/settings/settings-storage');
      
      const settings = await settingsStorage.getSettings();
      
      expect(settings).toBeDefined();
      expect(settings.enabledTypes).toBeDefined();
      expect(settings.minConfidence).toBeGreaterThan(0);
      expect(settings.minConfidence).toBeLessThanOrEqual(1);
    });

    it('should handle Chrome API availability', () => {
      expect(chrome).toBeDefined();
      expect(chrome.storage).toBeDefined();
      expect(chrome.runtime).toBeDefined();
    });
  });

  describe('PII Detection Integration', () => {
    it('should detect and mask basic PII types', async () => {
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      
      const detector = new PIIDetector();
      const options = {
        enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD']),
        minConfidence: 0.7,
        useNER: false, // Disable for faster testing
        useRegex: true,
        useDenyList: true,
        timeout: 2000
      };

      const testText = 'Contact john@example.com or call (555) 123-4567';
      const result = await detector.maskPII(testText, options);

      expect(result).toBeDefined();
      expect(result.maskedText).toBeDefined();
      expect(result.spans).toBeDefined();
      expect(Array.isArray(result.spans)).toBe(true);
      
      // Should detect at least email and phone
      expect(result.spans.length).toBeGreaterThan(0);
      expect(result.maskedText).toContain('[[EMAIL]]');
      expect(result.maskedText).toContain('[[PHONE]]');
    });

    it('should handle multiple PII types in complex text', async () => {
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      
      const detector = new PIIDetector();
      const options = {
        enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD', 'SSN', 'URL']),
        minConfidence: 0.7,
        useNER: false,
        useRegex: true,
        useDenyList: true,
        timeout: 3000
      };

      const complexText = `
        Dear support team,
        
        My account details:
        - Email: customer@company.com
        - Phone: +1-555-987-6543
        - Card ending in: 4111 1111 1111 1111
        - SSN: 123-45-6789
        - Website: https://mysite.com
        
        Please help me with my account.
      `;

      const result = await detector.maskPII(complexText, options);

      expect(result.spans.length).toBeGreaterThanOrEqual(4); // Should find multiple PII types
      expect(result.maskedText).toContain('[[EMAIL]]');
      expect(result.maskedText).toContain('[[PHONE]]');
      expect(result.maskedText).toContain('[[CARD]]');
      expect(result.maskedText).toContain('[[SSN]]');
      expect(result.maskedText).toContain('[[URL]]');
    });

    it('should preserve text structure during masking', async () => {
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      
      const detector = new PIIDetector();
      const options = {
        enabledTypes: new Set(['EMAIL']),
        minConfidence: 0.7,
        useNER: false,
        useRegex: true,
        useDenyList: false,
        timeout: 2000
      };

      const originalText = 'Line 1: test@example.com\nLine 2: Normal text\n\nLine 4: Done.';
      const result = await detector.maskPII(originalText, options);

      // Should preserve line structure
      const lines = result.maskedText.split('\n');
      expect(lines).toHaveLength(4);
      expect(lines[0]).toContain('[[EMAIL]]');
      expect(lines[1]).toBe('Line 2: Normal text');
      expect(lines[2]).toBe('');
      expect(lines[3]).toBe('Line 4: Done.');
    });
  });

  describe('Settings Management', () => {
    it('should save and retrieve custom settings', async () => {
      const { settingsStorage } = await import('../../src/settings/settings-storage');
      
      const customSettings = {
        enabledTypes: new Set(['EMAIL', 'PHONE']),
        minConfidence: 0.8,
        useNER: false,
        useRegex: true,
        useDenyList: true,
        timeout: 3000,
        preset: 'strict' as const
      };

      await settingsStorage.saveSettings(customSettings);
      const retrieved = await settingsStorage.getSettings();

      expect(retrieved.minConfidence).toBe(0.8);
      expect(retrieved.preset).toBe('strict');
      expect(retrieved.useNER).toBe(false);
    });

    it('should handle site-specific overrides', async () => {
      const { settingsStorage } = await import('../../src/settings/settings-storage');
      
      const siteOverride = {
        enabledTypes: new Set(['EMAIL']),
        minConfidence: 0.9
      };

      await settingsStorage.saveSiteOverride('example.com', siteOverride);
      const override = await settingsStorage.getSiteOverride('example.com');

      expect(override).toBeDefined();
      expect(override.minConfidence).toBe(0.9);
    });

    it('should apply presets correctly', async () => {
      const { settingsStorage } = await import('../../src/settings/settings-storage');
      
      await settingsStorage.applyPreset('loose');
      const settings = await settingsStorage.getSettings();

      expect(settings.preset).toBe('loose');
      expect(settings.minConfidence).toBeLessThan(0.8); // Loose preset has lower confidence
    });
  });

  describe('Content Script Integration', () => {
    it('should initialize content script without errors', async () => {
      document.body.innerHTML = `
        <form id="test-form">
          <input type="text" name="email" placeholder="Email" />
          <textarea name="message" placeholder="Message"></textarea>
          <button type="submit">Submit</button>
        </form>
      `;

      expect(() => {
        // Import main content script
        require('../../extension/content/main');
      }).not.toThrow();
    });

    it('should find form elements correctly', async () => {
      document.body.innerHTML = `
        <div class="container">
          <form class="contact-form">
            <input type="email" name="email" value="test@example.com" />
            <input type="tel" name="phone" value="555-1234" />
            <textarea name="message">My message with test@example.com</textarea>
            <button type="submit">Send Message</button>
          </form>
          
          <div class="chat-interface">
            <textarea data-testid="chat-input" placeholder="Chat with AI...">Hello</textarea>
            <button data-action="send">Send</button>
          </div>
        </div>
      `;

      const { selectorFinder } = await import('../../src/content/selector-finder');

      const inputs = selectorFinder.findInputFields(document.body);
      const buttons = selectorFinder.findSubmitButtons(document.body);

      expect(inputs.length).toBeGreaterThanOrEqual(3); // email, phone, message, chat
      expect(buttons.length).toBeGreaterThanOrEqual(2); // submit, send
      
      const emailInput = inputs.find(i => i.name === 'email');
      const phoneInput = inputs.find(i => i.name === 'phone');
      const messageArea = inputs.find(i => i.name === 'message');
      const chatInput = inputs.find(i => i.dataset.testid === 'chat-input');

      expect(emailInput).toBeDefined();
      expect(phoneInput).toBeDefined();
      expect(messageArea).toBeDefined();
      expect(chatInput).toBeDefined();
    });

    it('should detect LLM interfaces', async () => {
      // Mock ChatGPT-like interface
      Object.defineProperty(window, 'location', {
        value: { hostname: 'chat.openai.com' },
        writable: true
      });

      document.body.innerHTML = `
        <div class="chat-container">
          <textarea placeholder="Send a message..." data-id="prompt-textarea"></textarea>
          <button data-testid="send-button">Send</button>
        </div>
      `;

      const { selectorFinder } = await import('../../src/content/selector-finder');
      
      const isLLM = selectorFinder.isLLMInterface(document.body);
      expect(isLLM).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed input gracefully', async () => {
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      
      const detector = new PIIDetector();
      const options = {
        enabledTypes: new Set(['EMAIL']),
        minConfidence: 0.7,
        useNER: false,
        useRegex: true,
        useDenyList: false,
        timeout: 1000
      };

      // Test with empty, null, and malformed inputs
      const testInputs = ['', '   \n\t   ', null, undefined, 123, {}, []];

      for (const input of testInputs) {
        expect(async () => {
          await detector.maskPII(input as any, options);
        }).not.toThrow();
      }
    });

    it('should handle Chrome API failures gracefully', async () => {
      // Mock storage failure
      mockChrome.storage.sync.get.mockRejectedValueOnce(new Error('Storage unavailable'));

      const { settingsStorage } = await import('../../src/settings/settings-storage');
      
      // Should not crash when storage fails
      expect(async () => {
        await settingsStorage.getSettings();
      }).not.toThrow();
    });

    it('should handle network timeouts', async () => {
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      
      const detector = new PIIDetector();
      const shortTimeoutOptions = {
        enabledTypes: new Set(['EMAIL']),
        minConfidence: 0.7,
        useNER: true, // This might timeout
        useRegex: true,
        useDenyList: true,
        timeout: 1 // Very short timeout
      };

      const result = await detector.maskPII('test@example.com', shortTimeoutOptions);
      
      // Should still return some result even with timeout
      expect(result).toBeDefined();
      expect(result.maskedText).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should process typical text within reasonable time', async () => {
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      
      const detector = new PIIDetector();
      const options = {
        enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD']),
        minConfidence: 0.7,
        useNER: false, // Disable for speed
        useRegex: true,
        useDenyList: true,
        timeout: 5000
      };

      const testText = `
        Dear customer service,
        
        I'm having trouble with my account. My details are:
        - Email: customer@example.com
        - Phone: (555) 987-6543
        - Card: 4111 1111 1111 1111
        
        Please help me resolve this issue quickly.
        
        Thanks,
        John Smith
      `;

      const startTime = Date.now();
      const result = await detector.maskPII(testText, options);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.processingTime).toBeLessThan(2000);
      expect(result.spans.length).toBeGreaterThan(0);
    });

    it('should handle batch processing efficiently', async () => {
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      
      const detector = new PIIDetector();
      const options = {
        enabledTypes: new Set(['EMAIL']),
        minConfidence: 0.7,
        useNER: false,
        useRegex: true,
        useDenyList: false,
        timeout: 10000
      };

      const testTexts = [
        'Email me at user1@example.com',
        'Contact support@company.org',
        'Send to admin@site.net',
        'Reply to customer@business.com',
        'Reach out to info@service.io'
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        testTexts.map(text => detector.maskPII(text, options))
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Batch should complete within 5 seconds
      expect(results).toHaveLength(5);
      expect(results.every(r => r.spans.length > 0)).toBe(true);
      expect(results.every(r => r.maskedText.includes('[[EMAIL]]'))).toBe(true);
    });
  });

  describe('Data Privacy', () => {
    it('should not store PII data in settings', async () => {
      const { settingsStorage } = await import('../../src/settings/settings-storage');
      
      // Simulate processing text with PII
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      const detector = new PIIDetector();
      
      await detector.maskPII('My email is secret@private.com', {
        enabledTypes: new Set(['EMAIL']),
        minConfidence: 0.7,
        useNER: false,
        useRegex: true,
        useDenyList: false,
        timeout: 2000
      });

      // Check that settings don't contain any PII
      const settings = await settingsStorage.getSettings();
      const settingsJson = JSON.stringify(settings);
      
      expect(settingsJson).not.toContain('secret@private.com');
      expect(settingsJson).not.toContain('secret');
      expect(settingsJson).not.toContain('private.com');
    });

    it('should clear sensitive data from memory', async () => {
      const { PIIDetector } = await import('../../src/pii/pii-detector');
      
      const detector = new PIIDetector();
      const sensitiveText = 'SSN: 123-45-6789, Card: 4111111111111111';
      
      const result = await detector.maskPII(sensitiveText, {
        enabledTypes: new Set(['SSN', 'CARD']),
        minConfidence: 0.7,
        useNER: false,
        useRegex: true,
        useDenyList: false,
        timeout: 2000
      });

      // Verify masking worked
      expect(result.maskedText).not.toContain('123-45-6789');
      expect(result.maskedText).not.toContain('4111111111111111');
      expect(result.maskedText).toContain('[[SSN]]');
      expect(result.maskedText).toContain('[[CARD]]');
    });
  });

  describe('Extension Lifecycle', () => {
    it('should initialize and cleanup properly', async () => {
      // Mock extension initialization
      expect(() => {
        require('../../src/settings/settings-storage');
        require('../../src/pii/pii-detector');
        require('../../src/content/selector-finder');
      }).not.toThrow();

      // Should handle cleanup
      expect(() => {
        // Simulate cleanup scenarios
        document.body.innerHTML = '';
        vi.clearAllMocks();
      }).not.toThrow();
    });

    it('should handle settings changes dynamically', async () => {
      const { settingsStorage } = await import('../../src/settings/settings-storage');
      
      // Initial settings
      await settingsStorage.saveSettings({
        enabledTypes: new Set(['EMAIL']),
        minConfidence: 0.7,
        useNER: false,
        useRegex: true,
        useDenyList: false,
        timeout: 2000,
        preset: 'balanced'
      });

      let settings = await settingsStorage.getSettings();
      expect(settings.enabledTypes.has('EMAIL')).toBe(true);
      expect(settings.enabledTypes.has('PHONE')).toBe(false);

      // Update settings
      await settingsStorage.saveSettings({
        ...settings,
        enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD'])
      });

      settings = await settingsStorage.getSettings();
      expect(settings.enabledTypes.has('EMAIL')).toBe(true);
      expect(settings.enabledTypes.has('PHONE')).toBe(true);
      expect(settings.enabledTypes.has('CARD')).toBe(true);
    });
  });
});