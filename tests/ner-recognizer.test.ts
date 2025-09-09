import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nerRecognizer } from '../src/pii/ner-recognizer';

// Mock transformers library
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
  AutoTokenizer: {
    from_pretrained: vi.fn()
  },
  AutoModelForTokenClassification: {
    from_pretrained: vi.fn()
  }
}));

describe('NER Recognizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Model Loading', () => {
    it('should initialize the pipeline correctly', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'John', start: 0, end: 4, score: 0.99 },
        { entity: 'I-PER', word: 'Doe', start: 5, end: 8, score: 0.98 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('John Doe works at Apple');
      
      expect(pipeline).toHaveBeenCalledWith(
        'token-classification',
        'Xenova/bert-base-NER'
      );
      expect(result).toBeDefined();
    });

    it('should handle model loading errors gracefully', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockRejectedValue(new Error('Model loading failed'));

      const result = await nerRecognizer.detectPII('Test text');
      
      expect(result).toEqual([]);
    });
  });

  describe('Entity Detection', () => {
    it('should detect person names', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'John', start: 0, end: 4, score: 0.99 },
        { entity: 'I-PER', word: 'Smith', start: 5, end: 10, score: 0.98 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('John Smith is here');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'NAME',
        text: 'John Smith',
        start: 0,
        end: 10,
        confidence: expect.any(Number),
        source: 'ner'
      });
      expect(result[0].confidence).toBeGreaterThan(0.9);
    });

    it('should detect organizations', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-ORG', word: 'Apple', start: 0, end: 5, score: 0.95 },
        { entity: 'I-ORG', word: 'Inc', start: 6, end: 9, score: 0.92 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('Apple Inc is a company');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'NAME', // Organizations mapped to NAME type
        text: 'Apple Inc',
        source: 'ner'
      });
    });

    it('should detect locations', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-LOC', word: 'New', start: 0, end: 3, score: 0.97 },
        { entity: 'I-LOC', word: 'York', start: 4, end: 8, score: 0.96 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('New York is beautiful');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'ADDRESS',
        text: 'New York',
        source: 'ner'
      });
    });

    it('should handle miscellaneous entities', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-MISC', word: 'Christmas', start: 0, end: 9, score: 0.88 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('Christmas is coming');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'NAME',
        text: 'Christmas',
        source: 'ner'
      });
    });
  });

  describe('Entity Merging', () => {
    it('should merge consecutive entities of same type', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'John', start: 0, end: 4, score: 0.99 },
        { entity: 'I-PER', word: 'F', start: 5, end: 6, score: 0.95 },
        { entity: 'I-PER', word: 'Kennedy', start: 7, end: 14, score: 0.98 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('John F Kennedy was president');
      
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('John F Kennedy');
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(14);
    });

    it('should not merge entities with gaps', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'John', start: 0, end: 4, score: 0.99 },
        { entity: 'B-PER', word: 'Smith', start: 10, end: 15, score: 0.98 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('John and Smith are here');
      
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('John');
      expect(result[1].text).toBe('Smith');
    });
  });

  describe('Confidence Filtering', () => {
    it('should filter out low-confidence predictions', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'John', start: 0, end: 4, score: 0.99 },
        { entity: 'B-PER', word: 'maybe', start: 10, end: 15, score: 0.45 } // Low confidence
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('John and maybe someone');
      
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('John');
    });

    it('should adjust confidence for multi-token entities', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'John', start: 0, end: 4, score: 0.95 },
        { entity: 'I-PER', word: 'Smith', start: 5, end: 10, score: 0.90 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('John Smith here');
      
      expect(result).toHaveLength(1);
      // Average of 0.95 and 0.90 = 0.925
      expect(result[0].confidence).toBeCloseTo(0.925, 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await nerRecognizer.detectPII('');
      expect(result).toEqual([]);
    });

    it('should handle whitespace-only input', async () => {
      const result = await nerRecognizer.detectPII('   \n\t   ');
      expect(result).toEqual([]);
    });

    it('should handle input with no entities', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('The weather is nice today');
      
      expect(result).toEqual([]);
    });

    it('should handle special characters in entity names', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'José', start: 0, end: 4, score: 0.95 },
        { entity: 'I-PER', word: 'María', start: 5, end: 10, score: 0.93 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('José María lives here');
      
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('José María');
    });

    it('should handle tokenization edge cases', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: '##John', start: 0, end: 4, score: 0.95 } // Subword token
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('John is here');
      
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('John'); // Should handle subword prefix
    });
  });

  describe('Performance', () => {
    it('should complete detection within reasonable time', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'John', start: 0, end: 4, score: 0.99 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const startTime = Date.now();
      const result = await nerRecognizer.detectPII('John Smith works at Apple Inc in New York');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result).toBeDefined();
    });

    it('should handle long text efficiently', async () => {
      const longText = 'John Smith '.repeat(100) + 'works at Apple';
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'John', start: 0, end: 4, score: 0.99 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const startTime = Date.now();
      const result = await nerRecognizer.detectPII(longText);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000); // Should handle long text reasonably fast
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle pipeline execution errors', async () => {
      const mockPipeline = vi.fn().mockRejectedValue(new Error('Pipeline execution failed'));

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('John Smith is here');
      
      expect(result).toEqual([]);
    });

    it('should handle malformed pipeline output', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER' }, // Missing required fields
        { word: 'Smith' },     // Missing entity
        null,                  // Null result
        undefined              // Undefined result
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('Some text');
      
      // Should handle malformed output gracefully
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Entity Type Mapping', () => {
    it('should map B-PER and I-PER to NAME', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-PER', word: 'Alice', start: 0, end: 5, score: 0.95 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('Alice is here');
      
      expect(result[0].type).toBe('NAME');
    });

    it('should map B-ORG and I-ORG to NAME', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-ORG', word: 'Google', start: 0, end: 6, score: 0.95 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('Google is a company');
      
      expect(result[0].type).toBe('NAME');
    });

    it('should map B-LOC and I-LOC to ADDRESS', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-LOC', word: 'Paris', start: 0, end: 5, score: 0.95 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('Paris is beautiful');
      
      expect(result[0].type).toBe('ADDRESS');
    });

    it('should map B-MISC and I-MISC to NAME', async () => {
      const mockPipeline = vi.fn().mockResolvedValue([
        { entity: 'B-MISC', word: 'iPhone', start: 0, end: 6, score: 0.95 }
      ]);

      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      const result = await nerRecognizer.detectPII('iPhone is a product');
      
      expect(result[0].type).toBe('NAME');
    });
  });
});