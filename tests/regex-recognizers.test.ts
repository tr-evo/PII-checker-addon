import { describe, it, expect } from 'vitest';
import { 
  detectPIIWithRegex, 
  adjustConfidenceByContext,
  REGEX_PATTERNS,
  validateCreditCard,
  validateIBAN
} from '../src/pii/regex-recognizers';
import type { PIISpan, PIIType } from '../src/pii/regex-recognizers';

describe('Regex Recognizers', () => {
  describe('Email Detection', () => {
    it('should detect valid email addresses', () => {
      const testEmails = [
        'user@example.com',
        'test.email+tag@domain.org',
        'firstname.lastname@company.co.uk',
        'user123@test-domain.com',
        'admin@sub.domain.net'
      ];

      testEmails.forEach(email => {
        const text = `Contact us at ${email}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'EMAIL' && span.text === email)).toBe(true);
      });
    });

    it('should not detect invalid email formats', () => {
      const invalidEmails = [
        '@example.com',
        'user@',
        'plaintext',
        'user..name@domain.com',
        'user@domain'
      ];

      invalidEmails.forEach(invalid => {
        const spans = detectPIIWithRegex(invalid);
        expect(spans.every(span => span.type !== 'EMAIL' || span.text !== invalid)).toBe(true);
      });
    });
  });

  describe('Phone Number Detection', () => {
    it('should detect various phone number formats', () => {
      const phoneNumbers = [
        '+1-555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '555-123-4567',
        '+44 20 7946 0958',
        '+49 30 12345678'
      ];

      phoneNumbers.forEach(phone => {
        const text = `Call me at ${phone}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'PHONE')).toBe(true);
      });
    });

    it('should not detect invalid phone patterns', () => {
      const invalidPhones = [
        '123',
        '12-34',
        'abc-def-ghij',
        '000-000-0000'
      ];

      invalidPhones.forEach(invalid => {
        const spans = detectPIIWithRegex(invalid);
        expect(spans.every(span => span.type !== 'PHONE' || !span.text.includes(invalid))).toBe(true);
      });
    });
  });

  describe('Credit Card Detection', () => {
    it('should detect valid credit card numbers', () => {
      const validCards = [
        '4111111111111111', // Visa test card
        '5555555555554444', // Mastercard test card
        '378282246310005',  // Amex test card
        '6011111111111117'  // Discover test card
      ];

      validCards.forEach(card => {
        const text = `Card: ${card}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'CARD')).toBe(true);
      });
    });

    it('should validate credit cards with Luhn algorithm', () => {
      expect(validateCreditCard('4111111111111111')).toBe(true);
      expect(validateCreditCard('4111111111111112')).toBe(false); // Invalid Luhn
      expect(validateCreditCard('1234567812345678')).toBe(false); // Invalid format
    });

    it('should handle formatted credit card numbers', () => {
      const formattedCards = [
        '4111 1111 1111 1111',
        '4111-1111-1111-1111',
        '5555 5555 5555 4444'
      ];

      formattedCards.forEach(card => {
        const text = `Payment: ${card}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'CARD')).toBe(true);
      });
    });
  });

  describe('IBAN Detection', () => {
    it('should detect valid IBAN numbers', () => {
      const validIBANs = [
        'DE89370400440532013000',
        'GB29NWBK60161331926819',
        'FR1420041010050500013M02606',
        'IT60X0542811101000000123456',
        'ES9121000418450200051332'
      ];

      validIBANs.forEach(iban => {
        const text = `Transfer to ${iban}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'IBAN')).toBe(true);
      });
    });

    it('should detect formatted IBAN numbers', () => {
      const formattedIBANs = [
        'DE89 3704 0044 0532 0130 00',
        'GB29 NWBK 6016 1331 9268 19',
        'FR14 2004 1010 0505 0001 3M02 606'
      ];

      formattedIBANs.forEach(iban => {
        const text = `Bank: ${iban}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'IBAN')).toBe(true);
      });
    });

    it('should validate IBAN with checksum', () => {
      expect(validateIBAN('DE89370400440532013000')).toBe(true);
      expect(validateIBAN('DE89370400440532013001')).toBe(false); // Invalid checksum
      expect(validateIBAN('XX1234567890123456')).toBe(false); // Invalid country
    });
  });

  describe('SSN Detection', () => {
    it('should detect SSN patterns', () => {
      const ssnFormats = [
        '123-45-6789',
        '987654321',
        '123 45 6789'
      ];

      ssnFormats.forEach(ssn => {
        const text = `SSN: ${ssn}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'SSN')).toBe(true);
      });
    });

    it('should not detect invalid SSN patterns', () => {
      const invalidSSNs = [
        '000-00-0000',
        '666-00-0000',
        '900-00-0000',
        '123-00-0000'
      ];

      invalidSSNs.forEach(ssn => {
        const text = `ID: ${ssn}`;
        const spans = detectPIIWithRegex(text);
        
        // Should either not detect or have low confidence
        const ssnSpans = spans.filter(span => span.type === 'SSN');
        if (ssnSpans.length > 0) {
          expect(ssnSpans.every(span => span.confidence < 0.8)).toBe(true);
        }
      });
    });
  });

  describe('URL Detection', () => {
    it('should detect various URL formats', () => {
      const urls = [
        'https://www.example.com',
        'http://test.org/path',
        'ftp://files.company.com',
        'https://sub.domain.co.uk/path?query=value',
        'www.example.com',
        'example.com/page'
      ];

      urls.forEach(url => {
        const text = `Visit ${url} for info`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'URL')).toBe(true);
      });
    });
  });

  describe('UUID Detection', () => {
    it('should detect UUID patterns', () => {
      const uuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      ];

      uuids.forEach(uuid => {
        const text = `ID: ${uuid}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'UUID')).toBe(true);
      });
    });
  });

  describe('Date of Birth Detection', () => {
    it('should detect birth date patterns', () => {
      const birthDates = [
        '1990-01-15',
        '01/15/1990',
        '15.01.1990',
        'January 15, 1990',
        '15 Jan 1990'
      ];

      birthDates.forEach(date => {
        const text = `Born on ${date}`;
        const spans = detectPIIWithRegex(text);
        
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.some(span => span.type === 'DATE_OF_BIRTH')).toBe(true);
      });
    });
  });

  describe('Context-based Confidence Adjustment', () => {
    it('should increase confidence in financial context', () => {
      const text = 'Payment card number: 4111111111111111';
      const baseSpans = detectPIIWithRegex(text);
      const adjustedSpans = baseSpans.map(span => ({
        ...span,
        confidence: adjustConfidenceByContext(span, text)
      }));

      const cardSpan = adjustedSpans.find(span => span.type === 'CARD');
      expect(cardSpan).toBeDefined();
      expect(cardSpan!.confidence).toBeGreaterThan(0.9);
    });

    it('should increase confidence for emails in contact context', () => {
      const text = 'Contact email: support@company.com';
      const baseSpans = detectPIIWithRegex(text);
      const adjustedSpans = baseSpans.map(span => ({
        ...span,
        confidence: adjustConfidenceByContext(span, text)
      }));

      const emailSpan = adjustedSpans.find(span => span.type === 'EMAIL');
      expect(emailSpan).toBeDefined();
      expect(emailSpan!.confidence).toBeGreaterThan(0.9);
    });

    it('should decrease confidence for generic contexts', () => {
      const text = 'The test email test@example.com is not real';
      const baseSpans = detectPIIWithRegex(text);
      const adjustedSpans = baseSpans.map(span => ({
        ...span,
        confidence: adjustConfidenceByContext(span, text)
      }));

      const emailSpan = adjustedSpans.find(span => span.type === 'EMAIL');
      expect(emailSpan).toBeDefined();
      expect(emailSpan!.confidence).toBeLessThan(0.9);
    });
  });

  describe('Multiple PII in Single Text', () => {
    it('should detect multiple PII types', () => {
      const text = `Contact John at john@company.com or call (555) 123-4567. 
                   His card is 4111111111111111 and IBAN is DE89370400440532013000.`;
      
      const spans = detectPIIWithRegex(text);
      
      expect(spans.length).toBeGreaterThanOrEqual(4);
      
      const types = spans.map(span => span.type);
      expect(types).toContain('EMAIL');
      expect(types).toContain('PHONE');
      expect(types).toContain('CARD');
      expect(types).toContain('IBAN');
    });

    it('should maintain correct span positions', () => {
      const text = 'Email: test@example.com Phone: 555-1234';
      const spans = detectPIIWithRegex(text);
      
      spans.forEach(span => {
        const extractedText = text.substring(span.start, span.end);
        expect(extractedText).toBe(span.text);
        expect(span.start).toBeLessThan(span.end);
        expect(span.start).toBeGreaterThanOrEqual(0);
        expect(span.end).toBeLessThanOrEqual(text.length);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const spans = detectPIIWithRegex('');
      expect(spans).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      const spans = detectPIIWithRegex('   \n\t   ');
      expect(spans).toHaveLength(0);
    });

    it('should handle special characters', () => {
      const text = 'Email: tëst@exämple.com with special chars!';
      const spans = detectPIIWithRegex(text);
      
      expect(spans.length).toBeGreaterThan(0);
      expect(spans.some(span => span.type === 'EMAIL')).toBe(true);
    });

    it('should handle very long text', () => {
      const longText = 'Start '.repeat(1000) + 'test@example.com' + ' End'.repeat(1000);
      const spans = detectPIIWithRegex(longText);
      
      expect(spans.length).toBeGreaterThan(0);
      expect(spans.some(span => span.type === 'EMAIL')).toBe(true);
    });
  });

  describe('Regex Pattern Coverage', () => {
    it('should have patterns for all expected PII types', () => {
      const expectedTypes: PIIType[] = [
        'EMAIL', 'PHONE', 'IBAN', 'BIC', 'CARD', 'NAME', 
        'ADDRESS', 'POSTAL_CODE', 'URL', 'UUID', 'SSN', 
        'TAX_ID', 'DATE_OF_BIRTH'
      ];

      const patternTypes = REGEX_PATTERNS.map(p => p.type);
      
      expectedTypes.forEach(type => {
        expect(patternTypes).toContain(type);
      });
    });

    it('should have valid regex patterns', () => {
      REGEX_PATTERNS.forEach(pattern => {
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
        expect(pattern.type).toBeTruthy();
      });
    });
  });

  describe('Performance', () => {
    it('should complete regex detection quickly', () => {
      const text = 'Contact john@example.com or call (555) 123-4567. Card: 4111111111111111';
      const startTime = Date.now();
      
      const spans = detectPIIWithRegex(text);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should be very fast
      expect(spans.length).toBeGreaterThan(0);
    });

    it('should handle repeated calls efficiently', () => {
      const text = 'test@example.com';
      const iterations = 100;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        detectPIIWithRegex(text);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // 100 calls in under 500ms
    });
  });
});