import { describe, it, expect } from 'vitest';
import { mergePIISpans, applyMasking } from '../src/pii/masking-merger';
import type { PIISpan } from '../src/pii/regex-recognizers';

describe('Masking Merger', () => {
  describe('Span Merging', () => {
    it('should merge overlapping spans of same type', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'regex' },
        { type: 'NAME', text: 'John Doe', start: 0, end: 8, confidence: 0.85, source: 'ner' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({
        type: 'NAME',
        text: 'John Doe',
        start: 0,
        end: 8,
        confidence: 0.9, // Should keep higher confidence
        source: 'regex,ner'
      });
    });

    it('should merge adjacent spans of same type', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'ner' },
        { type: 'NAME', text: 'Doe', start: 5, end: 8, confidence: 0.85, source: 'ner' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({
        type: 'NAME',
        text: 'John Doe',
        start: 0,
        end: 8,
        confidence: expect.any(Number),
        source: 'ner'
      });
    });

    it('should not merge spans of different types', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'ner' },
        { type: 'EMAIL', text: 'john@example.com', start: 5, end: 21, confidence: 0.95, source: 'regex' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(2);
      expect(merged[0].type).toBe('NAME');
      expect(merged[1].type).toBe('EMAIL');
    });

    it('should handle nested spans correctly', () => {
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'john.doe@company.com', start: 0, end: 20, confidence: 0.95, source: 'regex' },
        { type: 'NAME', text: 'john.doe', start: 0, end: 8, confidence: 0.8, source: 'ner' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({
        type: 'EMAIL', // Higher confidence type should win
        text: 'john.doe@company.com',
        start: 0,
        end: 20,
        confidence: 0.95
      });
    });

    it('should resolve conflicts by confidence', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John Smith', start: 0, end: 10, confidence: 0.7, source: 'ner' },
        { type: 'PHONE', text: '1234567890', start: 0, end: 10, confidence: 0.9, source: 'regex' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({
        type: 'PHONE',
        confidence: 0.9
      });
    });

    it('should handle multiple overlapping spans', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0.8, source: 'ner' },
        { type: 'NAME', text: 'John Doe', start: 0, end: 8, confidence: 0.85, source: 'ner' },
        { type: 'NAME', text: 'John Doe Smith', start: 0, end: 14, confidence: 0.75, source: 'ner' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({
        type: 'NAME',
        text: 'John Doe Smith',
        start: 0,
        end: 14,
        confidence: 0.85 // Highest confidence among merged spans
      });
    });

    it('should preserve non-overlapping spans', () => {
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'john@example.com', start: 0, end: 16, confidence: 0.95, source: 'regex' },
        { type: 'PHONE', text: '555-1234', start: 20, end: 28, confidence: 0.9, source: 'regex' },
        { type: 'SSN', text: '123-45-6789', start: 35, end: 46, confidence: 0.85, source: 'regex' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(3);
      expect(merged.map(s => s.type)).toEqual(['EMAIL', 'PHONE', 'SSN']);
    });

    it('should handle empty spans array', () => {
      const merged = mergePIISpans([]);
      expect(merged).toHaveLength(0);
    });

    it('should sort merged spans by position', () => {
      const spans: PIISpan[] = [
        { type: 'PHONE', text: '555-1234', start: 20, end: 28, confidence: 0.9, source: 'regex' },
        { type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.95, source: 'regex' },
        { type: 'SSN', text: '123-45-6789', start: 35, end: 46, confidence: 0.85, source: 'regex' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(3);
      expect(merged[0].start).toBeLessThan(merged[1].start);
      expect(merged[1].start).toBeLessThan(merged[2].start);
    });
  });

  describe('Text Masking', () => {
    it('should apply basic masking to text', () => {
      const text = 'Contact john@example.com for support';
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'john@example.com', start: 8, end: 24, confidence: 0.95, source: 'regex' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('Contact [[EMAIL]] for support');
    });

    it('should apply masking to multiple spans', () => {
      const text = 'Email john@test.com or call 555-1234';
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'john@test.com', start: 6, end: 19, confidence: 0.95, source: 'regex' },
        { type: 'PHONE', text: '555-1234', start: 28, end: 36, confidence: 0.9, source: 'regex' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('Email [[EMAIL]] or call [[PHONE]]');
    });

    it('should handle overlapping spans correctly', () => {
      const text = 'Contact John Doe at john.doe@company.com';
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John Doe', start: 8, end: 16, confidence: 0.8, source: 'ner' },
        { type: 'EMAIL', text: 'john.doe@company.com', start: 20, end: 40, confidence: 0.95, source: 'regex' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('Contact [[NAME]] at [[EMAIL]]');
    });

    it('should maintain text structure with preserved characters', () => {
      const text = 'Line 1: john@test.com\nLine 2: 555-1234\n\nDone.';
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'john@test.com', start: 8, end: 21, confidence: 0.95, source: 'regex' },
        { type: 'PHONE', text: '555-1234', start: 30, end: 38, confidence: 0.9, source: 'regex' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('Line 1: [[EMAIL]]\nLine 2: [[PHONE]]\n\nDone.');
    });

    it('should handle empty spans array', () => {
      const text = 'No PII in this text';
      const masked = applyMasking(text, []);

      expect(masked).toBe(text);
    });

    it('should handle empty text', () => {
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.95, source: 'regex' }
      ];

      const masked = applyMasking('', spans);

      expect(masked).toBe('');
    });

    it('should handle spans at text boundaries', () => {
      const text = 'john@example.com';
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'john@example.com', start: 0, end: 16, confidence: 0.95, source: 'regex' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('[[EMAIL]]');
    });

    it('should handle adjacent spans', () => {
      const text = 'john@test.com555-1234';
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'john@test.com', start: 0, end: 13, confidence: 0.95, source: 'regex' },
        { type: 'PHONE', text: '555-1234', start: 13, end: 21, confidence: 0.9, source: 'regex' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('[[EMAIL]][[PHONE]]');
    });

    it('should handle special characters in text', () => {
      const text = 'Émáíl: tëst@exämplé.com with special chars! 📧';
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'tëst@exämplé.com', start: 7, end: 23, confidence: 0.95, source: 'regex' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('Émáíl: [[EMAIL]] with special chars! 📧');
    });

    it('should handle unicode characters correctly', () => {
      const text = '联系我: test@example.com 或者打电话';
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'test@example.com', start: 4, end: 20, confidence: 0.95, source: 'regex' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('联系我: [[EMAIL]] 或者打电话');
    });
  });

  describe('Source Combination', () => {
    it('should combine sources correctly', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0.8, source: 'regex' },
        { type: 'NAME', text: 'John Doe', start: 0, end: 8, confidence: 0.85, source: 'ner' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged[0].source).toBe('regex,ner');
    });

    it('should not duplicate sources', () => {
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.95, source: 'regex' },
        { type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.9, source: 'regex' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged[0].source).toBe('regex');
    });

    it('should sort sources alphabetically', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0.8, source: 'ner' },
        { type: 'NAME', text: 'John Doe', start: 0, end: 8, confidence: 0.85, source: 'denylist' },
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'regex' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged[0].source).toBe('denylist,ner,regex');
    });
  });

  describe('Edge Cases', () => {
    it('should handle spans with same start but different end', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0.8, source: 'ner' },
        { type: 'NAME', text: 'John Doe', start: 0, end: 8, confidence: 0.85, source: 'ner' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(1);
      expect(merged[0].text).toBe('John Doe');
    });

    it('should handle spans with same end but different start', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'Doe', start: 5, end: 8, confidence: 0.8, source: 'ner' },
        { type: 'NAME', text: 'John Doe', start: 0, end: 8, confidence: 0.85, source: 'ner' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(1);
      expect(merged[0].text).toBe('John Doe');
    });

    it('should handle single character spans', () => {
      const text = 'A';
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'A', start: 0, end: 1, confidence: 0.8, source: 'ner' }
      ];

      const masked = applyMasking(text, spans);

      expect(masked).toBe('[[NAME]]');
    });

    it('should handle spans with zero confidence', () => {
      const spans: PIISpan[] = [
        { type: 'NAME', text: 'John', start: 0, end: 4, confidence: 0, source: 'ner' },
        { type: 'NAME', text: 'John Doe', start: 0, end: 8, confidence: 0.85, source: 'ner' }
      ];

      const merged = mergePIISpans(spans);

      expect(merged).toHaveLength(1);
      expect(merged[0].confidence).toBe(0.85);
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(10000) + 'test@example.com' + 'B'.repeat(10000);
      const spans: PIISpan[] = [
        { type: 'EMAIL', text: 'test@example.com', start: 10000, end: 10016, confidence: 0.95, source: 'regex' }
      ];

      const masked = applyMasking(longText, spans);

      expect(masked).toBe('A'.repeat(10000) + '[[EMAIL]]' + 'B'.repeat(10000));
      expect(masked.length).toBe(longText.length - 16 + 9); // Replaced 16 chars with 9 chars
    });
  });

  describe('Performance', () => {
    it('should handle many spans efficiently', () => {
      const spans: PIISpan[] = [];
      for (let i = 0; i < 1000; i++) {
        spans.push({
          type: 'NAME',
          text: `Name${i}`,
          start: i * 10,
          end: i * 10 + 5,
          confidence: 0.8,
          source: 'ner'
        });
      }

      const startTime = Date.now();
      const merged = mergePIISpans(spans);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(merged).toHaveLength(1000); // No overlaps, so all should remain
    });

    it('should mask large text efficiently', () => {
      const text = 'Email: test@example.com '.repeat(1000);
      const spans: PIISpan[] = [];
      
      for (let i = 0; i < 1000; i++) {
        const start = i * 24 + 7;
        spans.push({
          type: 'EMAIL',
          text: 'test@example.com',
          start,
          end: start + 16,
          confidence: 0.95,
          source: 'regex'
        });
      }

      const startTime = Date.now();
      const masked = applyMasking(text, spans);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(masked).toContain('[[EMAIL]]');
    });
  });
});