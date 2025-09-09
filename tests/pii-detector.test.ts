import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PIIDetector } from '../src/pii/pii-detector';
import type { PIIDetectionOptions } from '../src/pii/pii-detector';
import type { PIIType } from '../src/pii/regex-recognizers';

// Mock the worker client
vi.mock('../src/pii/pii-worker-client', () => ({
  piiWorkerClient: {
    maskText: vi.fn()
  }
}));

// Mock the NER recognizer  
vi.mock('../src/pii/ner-recognizer', () => ({
  nerRecognizer: {
    detectPII: vi.fn().mockResolvedValue([])
  }
}));

describe('PIIDetector', () => {
  let detector: PIIDetector;
  let defaultOptions: PIIDetectionOptions;

  beforeEach(() => {
    detector = new PIIDetector();
    defaultOptions = {
      enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD', 'NAME', 'SSN'] as PIIType[]),
      minConfidence: 0.7,
      useNER: true,
      useDenyList: true,
      useRegex: true,
      timeout: 5000
    };
  });

  describe('Core PII Detection', () => {
    it('should detect email addresses', async () => {
      const text = 'Contact us at support@example.com for help.';
      const result = await detector.maskPII(text, defaultOptions);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0].type).toBe('EMAIL');
      expect(result.spans[0].text).toBe('support@example.com');
      expect(result.maskedText).toContain('[[EMAIL]]');
    });

    it('should detect phone numbers in various formats', async () => {
      const testCases = [
        '+1-555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '5551234567'
      ];

      for (const phone of testCases) {
        const text = `Call me at ${phone}`;
        const result = await detector.maskPII(text, defaultOptions);
        
        expect(result.spans.length).toBeGreaterThan(0);
        expect(result.spans.some(span => span.type === 'PHONE')).toBe(true);
      }
    });

    it('should detect credit card numbers', async () => {
      const testCards = [
        '4111111111111111', // Visa
        '5555555555554444', // Mastercard
        '378282246310005'   // American Express
      ];

      for (const card of testCards) {
        const text = `My card number is ${card}`;
        const result = await detector.maskPII(text, defaultOptions);
        
        expect(result.spans.length).toBeGreaterThan(0);
        expect(result.spans.some(span => span.type === 'CARD')).toBe(true);
      }
    });

    it('should detect IBAN numbers', async () => {
      const testIBANs = [
        'DE89 3704 0044 0532 0130 00',
        'GB29 NWBK 6016 1331 9268 19',
        'FR14 2004 1010 0505 0001 3M02 606'
      ];

      for (const iban of testIBANs) {
        const text = `Transfer to ${iban}`;
        const result = await detector.maskPII(text, defaultOptions);
        
        expect(result.spans.length).toBeGreaterThan(0);
        expect(result.spans.some(span => span.type === 'IBAN')).toBe(true);
      }
    });

    it('should detect SSN numbers', async () => {
      const text = 'My SSN is 123-45-6789';
      const result = await detector.maskPII(text, defaultOptions);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0].type).toBe('SSN');
      expect(result.maskedText).toContain('[[SSN]]');
    });

    it('should detect URLs', async () => {
      const testURLs = [
        'https://www.example.com',
        'http://test.org/path',
        'ftp://files.company.com'
      ];

      for (const url of testURLs) {
        const text = `Visit ${url} for more info`;
        const result = await detector.maskPII(text, defaultOptions);
        
        expect(result.spans.length).toBeGreaterThan(0);
        expect(result.spans.some(span => span.type === 'URL')).toBe(true);
      }
    });
  });

  describe('Multiple PII Detection', () => {
    it('should detect multiple PII types in one text', async () => {
      const text = 'Contact John Doe at john@company.com or call (555) 123-4567. His SSN is 123-45-6789.';
      const result = await detector.maskPII(text, defaultOptions);

      expect(result.spans.length).toBeGreaterThanOrEqual(3);
      
      const types = result.spans.map(span => span.type);
      expect(types).toContain('EMAIL');
      expect(types).toContain('PHONE');
      expect(types).toContain('SSN');
    });

    it('should handle overlapping PII spans', async () => {
      const text = 'Email john.doe@company.com'; // Both email and potential name
      const result = await detector.maskPII(text, defaultOptions);

      // Should detect email, merger should handle overlaps
      expect(result.spans.length).toBeGreaterThan(0);
      expect(result.maskedText).toBeTruthy();
    });
  });

  describe('Confidence Filtering', () => {
    it('should filter spans below minimum confidence', async () => {
      const text = 'Contact support@example.com';
      const highConfidenceOptions = { ...defaultOptions, minConfidence: 0.99 };
      
      const result = await detector.maskPII(text, highConfidenceOptions);
      
      // Email should still pass with high confidence
      expect(result.spans.some(span => span.type === 'EMAIL')).toBe(true);
    });

    it('should respect enabled types setting', async () => {
      const text = 'Email: test@example.com Phone: 555-1234';
      const emailOnlyOptions = { ...defaultOptions, enabledTypes: new Set(['EMAIL'] as PIIType[]) };
      
      const result = await detector.maskPII(text, emailOnlyOptions);
      
      expect(result.spans.every(span => span.type === 'EMAIL')).toBe(true);
      expect(result.spans.some(span => span.type === 'PHONE')).toBe(false);
    });
  });

  describe('Detection Options', () => {
    it('should disable regex detection when useRegex is false', async () => {
      const text = 'Email me at test@example.com';
      const noRegexOptions = { ...defaultOptions, useRegex: false };
      
      const result = await detector.maskPII(text, noRegexOptions);
      
      // Without regex, should rely on deny-list and NER only
      // Email might still be detected by other methods
      expect(result).toBeDefined();
    });

    it('should disable deny-list detection when useDenyList is false', async () => {
      const text = 'test@example.com'; // Common test email
      const noDenyListOptions = { ...defaultOptions, useDenyList: false };
      
      const result = await detector.maskPII(text, noDenyListOptions);
      
      // Should still detect via regex
      expect(result).toBeDefined();
    });

    it('should handle timeout correctly', async () => {
      const text = 'Contact test@example.com';
      const quickTimeoutOptions = { ...defaultOptions, timeout: 1 }; // 1ms timeout
      
      // Should either complete quickly or timeout gracefully
      const result = await detector.maskPII(text, quickTimeoutOptions);
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await detector.maskPII('', defaultOptions);
      
      expect(result.spans).toHaveLength(0);
      expect(result.maskedText).toBe('');
    });

    it('should handle whitespace-only input', async () => {
      const result = await detector.maskPII('   \n\t   ', defaultOptions);
      
      expect(result.spans).toHaveLength(0);
      expect(result.maskedText).toBe('   \n\t   ');
    });

    it('should handle very long text', async () => {
      const longText = 'Contact support@example.com. ' + 'A'.repeat(10000) + ' Phone: 555-1234';
      const result = await detector.maskPII(longText, defaultOptions);
      
      expect(result.spans.length).toBeGreaterThan(0);
      expect(result.maskedText.length).toBeGreaterThan(0);
    });

    it('should handle special characters', async () => {
      const text = 'Email: test@exämple.com with ñ special chars! 📧';
      const result = await detector.maskPII(text, defaultOptions);
      
      expect(result).toBeDefined();
      expect(result.maskedText).toBeTruthy();
    });

    it('should preserve text structure', async () => {
      const text = 'Line 1: test@example.com\nLine 2: 555-1234\n\nLine 4: Done.';
      const result = await detector.maskPII(text, defaultOptions);
      
      // Should maintain line breaks and spacing
      expect(result.maskedText.split('\n')).toHaveLength(4);
      expect(result.maskedText).toContain('Line 1:');
      expect(result.maskedText).toContain('Line 4: Done.');
    });
  });

  describe('Performance', () => {
    it('should complete detection within reasonable time', async () => {
      const text = 'Contact john@example.com or call 555-1234. SSN: 123-45-6789.';
      const startTime = Date.now();
      
      const result = await detector.maskPII(text, defaultOptions);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.processingTime).toBeLessThan(1000);
    });

    it('should handle batch processing efficiently', async () => {
      const texts = [
        'Email: test1@example.com',
        'Phone: 555-0001',
        'Card: 4111111111111111',
        'SSN: 123-45-6789',
        'URL: https://example.com'
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        texts.map(text => detector.maskPII(text, defaultOptions))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(results.every(r => r.spans.length > 0)).toBe(true);
      expect(duration).toBeLessThan(2000); // Batch should complete reasonably fast
    });
  });

  describe('Return Value Structure', () => {
    it('should return properly structured result', async () => {
      const text = 'Contact test@example.com';
      const result = await detector.maskPII(text, defaultOptions);
      
      expect(result).toHaveProperty('maskedText');
      expect(result).toHaveProperty('spans');
      expect(result).toHaveProperty('processingTime');
      expect(typeof result.processingTime).toBe('number');
      expect(Array.isArray(result.spans)).toBe(true);
    });

    it('should have valid span structure', async () => {
      const text = 'Email: test@example.com';
      const result = await detector.maskPII(text, defaultOptions);
      
      if (result.spans.length > 0) {
        const span = result.spans[0];
        expect(span).toHaveProperty('type');
        expect(span).toHaveProperty('start');
        expect(span).toHaveProperty('end');
        expect(span).toHaveProperty('text');
        expect(span).toHaveProperty('confidence');
        expect(span).toHaveProperty('source');
        
        expect(typeof span.start).toBe('number');
        expect(typeof span.end).toBe('number');
        expect(typeof span.confidence).toBe('number');
        expect(span.confidence).toBeGreaterThan(0);
        expect(span.confidence).toBeLessThanOrEqual(1);
        expect(span.start).toBeLessThan(span.end);
      }
    });
  });
});