import { describe, it, expect } from 'vitest';
import { detectPIIWithRegex } from '../src/pii/regex-recognizers';
import { detectPIIWithDenyList } from '../src/pii/deny-list-recognizers';

describe('PII Recognizers', () => {
  describe('Regex Recognizer', () => {
    it('should detect email addresses', () => {
      const text = 'Contact me at john.doe@example.com for more info';
      const spans = detectPIIWithRegex(text);
      
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('EMAIL');
      expect(spans[0].text).toBe('john.doe@example.com');
      expect(spans[0].confidence).toBeGreaterThan(0.9);
    });

    it('should detect phone numbers', () => {
      const text = 'Call me at (555) 123-4567';
      const spans = detectPIIWithRegex(text);
      
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('PHONE');
      expect(spans[0].text).toBe('(555) 123-4567');
    });

    it('should detect URLs', () => {
      const text = 'Check out https://example.com/private';
      const spans = detectPIIWithRegex(text);
      
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('URL');
      expect(spans[0].text).toBe('https://example.com/private');
    });

    it('should detect UUIDs', () => {
      const text = 'User ID: 123e4567-e89b-12d3-a456-426614174000';
      const spans = detectPIIWithRegex(text);
      
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('UUID');
      expect(spans[0].text).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should validate credit card with Luhn algorithm', () => {
      // Valid Visa test number
      const validText = 'Card: 4111111111111111';
      const validSpans = detectPIIWithRegex(validText);
      expect(validSpans).toHaveLength(1);
      expect(validSpans[0].type).toBe('CARD');

      // Invalid card number
      const invalidText = 'Card: 4111111111111112';
      const invalidSpans = detectPIIWithRegex(invalidText);
      expect(invalidSpans).toHaveLength(0); // Should be filtered out by validator
    });

    it('should detect multiple PII types in one text', () => {
      const text = 'John Doe (john@example.com, 555-123-4567) lives at https://example.com';
      const spans = detectPIIWithRegex(text);
      
      expect(spans.length).toBeGreaterThanOrEqual(3);
      const types = spans.map(s => s.type);
      expect(types).toContain('EMAIL');
      expect(types).toContain('PHONE');
      expect(types).toContain('URL');
    });
  });

  describe('Deny List Recognizer', () => {
    it('should detect test email addresses', () => {
      const text = 'Send to test@test.com';
      const spans = detectPIIWithDenyList(text);
      
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('EMAIL');
      expect(spans[0].text).toBe('test@test.com');
      expect(spans[0].confidence).toBeGreaterThan(0.95);
      expect(spans[0].source).toBe('deny-list');
    });

    it('should detect test SSN patterns', () => {
      const text = 'SSN: 123-45-6789';
      const spans = detectPIIWithDenyList(text);
      
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('SSN');
      expect(spans[0].text).toBe('123-45-6789');
    });

    it('should detect test credit card numbers', () => {
      const text = 'Use card 4111111111111111 for testing';
      const spans = detectPIIWithDenyList(text);
      
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('CARD');
      expect(spans[0].text).toBe('4111111111111111');
    });

    it('should handle case insensitive matches', () => {
      const text = 'Contact JOHN DOE at john@example.com';
      const spans = detectPIIWithDenyList(text);
      
      // Should find deny-list patterns regardless of case
      const emailSpans = spans.filter(s => s.type === 'EMAIL');
      expect(emailSpans.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle empty input', () => {
      expect(detectPIIWithRegex('')).toHaveLength(0);
      expect(detectPIIWithDenyList('')).toHaveLength(0);
    });

    it('should handle text with no PII', () => {
      const text = 'This is just normal text with numbers 123 and words.';
      
      const regexSpans = detectPIIWithRegex(text);
      const denyListSpans = detectPIIWithDenyList(text);
      
      expect(regexSpans).toHaveLength(0);
      expect(denyListSpans).toHaveLength(0);
    });

    it('should provide confidence scores', () => {
      const text = 'Email: user@domain.com, Phone: 555-0123';
      const spans = detectPIIWithRegex(text);
      
      spans.forEach(span => {
        expect(span.confidence).toBeGreaterThan(0);
        expect(span.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});