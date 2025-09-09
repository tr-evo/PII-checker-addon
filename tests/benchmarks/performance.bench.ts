import { describe, bench, beforeEach } from 'vitest';
import { PIIDetector } from '../../src/pii/pii-detector';
import { detectPIIWithRegex } from '../../src/pii/regex-recognizers';
import { mergePIISpans, applyMasking } from '../../src/pii/masking-merger';
import type { PIIDetectionOptions } from '../../src/pii/pii-detector';

// Mock the NER recognizer for consistent benchmarking
vi.mock('../../src/pii/ner-recognizer', () => ({
  nerRecognizer: {
    detectPII: vi.fn().mockResolvedValue([])
  }
}));

describe('Performance Benchmarks', () => {
  let detector: PIIDetector;
  let baseOptions: PIIDetectionOptions;

  beforeEach(() => {
    detector = new PIIDetector();
    baseOptions = {
      enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD', 'IBAN', 'SSN', 'NAME']),
      minConfidence: 0.7,
      useNER: false, // Disable for consistent benchmarking
      useRegex: true,
      useDenyList: true,
      timeout: 5000
    };
  });

  describe('Regex Detection Performance', () => {
    const shortText = 'Contact me at john@example.com or call (555) 123-4567';
    const mediumText = `
      Dear Customer Service,
      
      I need help with my account. Here are my details:
      - Email: customer@company.com
      - Phone: +1-555-987-6543
      - Card: 4111 1111 1111 1111
      - IBAN: DE89 3704 0044 0532 0130 00
      
      Please resolve this quickly.
      
      Thanks,
      John Smith
    `;
    const longText = mediumText.repeat(10);

    bench('Short text (60 chars)', () => {
      detectPIIWithRegex(shortText);
    });

    bench('Medium text (300 chars)', () => {
      detectPIIWithRegex(mediumText);
    });

    bench('Long text (3000 chars)', () => {
      detectPIIWithRegex(longText);
    });

    bench('Very long text (30000 chars)', () => {
      const veryLongText = longText.repeat(10);
      detectPIIWithRegex(veryLongText);
    });
  });

  describe('Full Detection Pipeline Performance', () => {
    const testTexts = [
      'Quick: test@example.com',
      'Contact john@company.org or call (555) 123-4567. Card: 4111111111111111',
      `
        Business inquiry details:
        Email: sales@business.com
        Phone: +44 20 7946 0958
        Fax: +44 20 7946 0959
        Account: GB29 NWBK 6016 1331 9268 19
        Reference: REF-2023-001234
        
        Please process this request urgently.
      `,
      `
        Customer Support Ticket #12345
        
        Issue: Account access problems
        Reporter: jane.doe@customer.com
        Phone: 1-800-555-0199
        Account ID: ACC-789-XYZ
        SSN: 123-45-6789
        
        Description:
        I cannot access my account dashboard. I've tried resetting my password multiple times.
        My card ending in 1234 (full: 5555 5555 5555 4444) was charged incorrectly.
        
        Additional Info:
        - Previous ticket: TKT-001-ABC
        - Browser: Chrome 118.0.5993.88
        - IP Address: 192.168.1.100
        - Session ID: sess_1a2b3c4d5e6f7g8h
        
        Please contact me at my alternate email: j.doe.alt@gmail.com
        or call my mobile: (555) 987-6543
      `.repeat(3) // Simulate a detailed support ticket
    ];

    testTexts.forEach((text, index) => {
      const size = text.length;
      bench(`Text ${index + 1} (${size} chars) - Regex only`, async () => {
        await detector.maskPII(text, baseOptions);
      });

      bench(`Text ${index + 1} (${size} chars) - With deny-list`, async () => {
        await detector.maskPII(text, { ...baseOptions, useDenyList: true });
      });
    });
  });

  describe('Span Merging Performance', () => {
    // Generate overlapping spans for benchmarking
    const generateSpans = (count: number) => {
      const spans = [];
      for (let i = 0; i < count; i++) {
        spans.push({
          type: 'EMAIL' as const,
          text: `user${i}@example.com`,
          start: i * 5,
          end: i * 5 + 15,
          confidence: 0.9,
          source: 'regex' as const
        });
      }
      return spans;
    };

    bench('Merge 10 spans', () => {
      const spans = generateSpans(10);
      mergePIISpans(spans);
    });

    bench('Merge 100 spans', () => {
      const spans = generateSpans(100);
      mergePIISpans(spans);
    });

    bench('Merge 1000 spans', () => {
      const spans = generateSpans(1000);
      mergePIISpans(spans);
    });
  });

  describe('Text Masking Performance', () => {
    const baseText = 'Contact me at ';
    const emails = Array.from({ length: 100 }, (_, i) => `user${i}@example${i}.com`);
    const textWithManyEmails = baseText + emails.join(', ');
    
    const spans = emails.map((email, i) => ({
      type: 'EMAIL' as const,
      text: email,
      start: baseText.length + emails.slice(0, i).join(', ').length + (i > 0 ? 2 : 0),
      end: baseText.length + emails.slice(0, i + 1).join(', ').length,
      confidence: 0.95,
      source: 'regex' as const
    }));

    bench('Mask text with 1 span', () => {
      applyMasking('Contact test@example.com', [spans[0]]);
    });

    bench('Mask text with 10 spans', () => {
      const text = baseText + emails.slice(0, 10).join(', ');
      applyMasking(text, spans.slice(0, 10));
    });

    bench('Mask text with 100 spans', () => {
      applyMasking(textWithManyEmails, spans);
    });
  });

  describe('Memory Usage Patterns', () => {
    bench('Repeated small detections', async () => {
      const texts = Array.from({ length: 50 }, (_, i) => 
        `Message ${i}: contact${i}@test.com, phone: 555-${String(i).padStart(4, '0')}`
      );
      
      for (const text of texts) {
        await detector.maskPII(text, baseOptions);
      }
    });

    bench('Single large detection', async () => {
      const largeText = Array.from({ length: 50 }, (_, i) => 
        `Message ${i}: contact${i}@test.com, phone: 555-${String(i).padStart(4, '0')}`
      ).join('\n');
      
      await detector.maskPII(largeText, baseOptions);
    });
  });

  describe('Different PII Type Complexity', () => {
    const testData = {
      'EMAIL only': 'Emails: test1@example.com, test2@company.org, user@domain.co.uk',
      'PHONE only': 'Phones: +1-555-123-4567, (555) 987-6543, +44 20 7946 0958',
      'CARD only': 'Cards: 4111111111111111, 5555555555554444, 378282246310005',
      'IBAN only': 'IBANs: DE89370400440532013000, GB29NWBK60161331926819, FR1420041010050500013M02606',
      'Mixed PII': 'Contact: john@example.com, (555) 123-4567, Card: 4111111111111111, IBAN: DE89370400440532013000'
    };

    Object.entries(testData).forEach(([type, text]) => {
      bench(`${type} detection`, async () => {
        await detector.maskPII(text, baseOptions);
      });
    });
  });

  describe('Edge Cases Performance', () => {
    bench('Empty string', async () => {
      await detector.maskPII('', baseOptions);
    });

    bench('No PII text', async () => {
      const noPiiText = 'This is a normal message with no personal information. Just some regular text about weather and general topics.';
      await detector.maskPII(noPiiText, baseOptions);
    });

    bench('Text with many false positives', async () => {
      const falsePiiText = 'File: test.txt@backup, Process: worker-123-456, Config: server.local:8080, Version: 1.2.3.456';
      await detector.maskPII(falsePiiText, baseOptions);
    });

    bench('Unicode text', async () => {
      const unicodeText = 'Kontakt: müller@beispiel.de, Téléphone: +33 1 23 45 67 89, Correo: josé@empresa.es';
      await detector.maskPII(unicodeText, baseOptions);
    });

    bench('Text with special characters', async () => {
      const specialText = 'Contact: test@example.com! Call: (555) 123-4567? Email: user@domain.co.uk. Thanks!';
      await detector.maskPII(specialText, baseOptions);
    });
  });

  describe('Scaling Tests', () => {
    const generateTestText = (emailCount: number) => {
      const emails = Array.from({ length: emailCount }, (_, i) => `user${i}@domain${i % 10}.com`);
      return `Contact information: ${emails.join(', ')}. Please reach out to any of these addresses for support.`;
    };

    [1, 5, 10, 25, 50, 100].forEach(count => {
      bench(`Text with ${count} emails`, async () => {
        const text = generateTestText(count);
        await detector.maskPII(text, baseOptions);
      });
    });
  });

  describe('Confidence Threshold Impact', () => {
    const testText = 'Questionable emails: maybe@test.com, could-be@example.org, possibly@domain.net';
    
    [0.1, 0.3, 0.5, 0.7, 0.9].forEach(threshold => {
      bench(`Confidence threshold ${threshold}`, async () => {
        await detector.maskPII(testText, { ...baseOptions, minConfidence: threshold });
      });
    });
  });

  describe('Enabled Types Impact', () => {
    const complexText = `
      Full info: john@example.com, (555) 123-4567, 4111111111111111, 
      DE89370400440532013000, 123-45-6789, https://example.com, 
      123e4567-e89b-12d3-a456-426614174000
    `;

    const typeGroups = [
      { name: '1 type', types: ['EMAIL'] },
      { name: '3 types', types: ['EMAIL', 'PHONE', 'CARD'] },
      { name: '5 types', types: ['EMAIL', 'PHONE', 'CARD', 'IBAN', 'SSN'] },
      { name: 'All types', types: ['EMAIL', 'PHONE', 'CARD', 'IBAN', 'SSN', 'URL', 'UUID'] }
    ];

    typeGroups.forEach(({ name, types }) => {
      bench(`${name} enabled`, async () => {
        await detector.maskPII(complexText, {
          ...baseOptions,
          enabledTypes: new Set(types as any)
        });
      });
    });
  });
});

// Utility benchmarks for development insights
describe('Development Benchmarks', () => {
  bench('String replacement vs Array join', () => {
    const text = 'Replace test@example.com with masked value';
    const masked1 = text.replace('test@example.com', '[[EMAIL]]');
    const masked2 = ['Replace ', '[[EMAIL]]', ' with masked value'].join('');
  });

  bench('RegExp test vs match', () => {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const text = 'Contact test@example.com for info';
    
    // Test method
    const hasEmail1 = emailPattern.test(text);
    
    // Match method
    const hasEmail2 = emailPattern.exec(text) !== null;
  });

  bench('Set.has vs Array.includes', () => {
    const set = new Set(['EMAIL', 'PHONE', 'CARD']);
    const array = ['EMAIL', 'PHONE', 'CARD'];
    
    const inSet = set.has('EMAIL');
    const inArray = array.includes('EMAIL');
  });

  bench('Object spread vs assign', () => {
    const base = { type: 'EMAIL', confidence: 0.9 };
    
    const spread = { ...base, source: 'regex' };
    const assign = Object.assign({}, base, { source: 'regex' });
  });
});