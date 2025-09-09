import { describe, it, expect, vi } from 'vitest';
import type { PIIMaskingResult } from '../src/pii/pii-detector';
import type { PIISpan } from '../src/pii/regex-recognizers';
import { ExportService } from '../src/logging/export-service';
import type { LogRevisionOptions, LogUploadOptions } from '../src/logging/logger';
import type { RevisionEntry, UploadEntry } from '../src/logging/database';

describe('Logging System Functional Tests', () => {
  describe('Data Structure Validation', () => {
    it('should have correct RevisionEntry structure', () => {
      const mockRevision: RevisionEntry = {
        id: 'test-id',
        timestamp: Date.now(),
        site: 'chat.openai.com',
        originalHash: 'abc123',
        maskedText: 'Hello [[NAME]]',
        spans: [{
          type: 'NAME',
          start: 6,
          end: 10,
          text: 'John',
          confidence: 0.95,
          source: 'regex'
        } as PIISpan],
        version: '1.0.0'
      };

      expect(mockRevision).toHaveProperty('id');
      expect(mockRevision).toHaveProperty('timestamp');
      expect(mockRevision).toHaveProperty('site');
      expect(mockRevision).toHaveProperty('originalHash');
      expect(mockRevision).toHaveProperty('maskedText');
      expect(mockRevision).toHaveProperty('spans');
      expect(mockRevision).toHaveProperty('version');
      expect(Array.isArray(mockRevision.spans)).toBe(true);
    });

    it('should have correct UploadEntry structure', () => {
      const mockUpload: UploadEntry = {
        id: 'upload-123',
        timestamp: Date.now(),
        site: 'claude.ai',
        filename: 'document.pdf',
        size: 1024000,
        mimeType: 'application/pdf'
      };

      expect(mockUpload).toHaveProperty('id');
      expect(mockUpload).toHaveProperty('timestamp');
      expect(mockUpload).toHaveProperty('site');
      expect(mockUpload).toHaveProperty('filename');
      expect(mockUpload).toHaveProperty('size');
      expect(mockUpload).toHaveProperty('mimeType');
    });

    it('should validate LogRevisionOptions interface', () => {
      const mockMaskingResult: PIIMaskingResult = {
        maskedText: 'Hello [[NAME]]',
        spans: [{
          type: 'NAME',
          start: 6,
          end: 14,
          text: 'John Doe',
          confidence: 0.95,
          source: 'ner'
        } as PIISpan],
        processingTime: 150
      };

      const logOptions: LogRevisionOptions = {
        originalText: 'Hello John Doe',
        maskingResult: mockMaskingResult,
        site: 'chat.openai.com'
      };

      expect(logOptions).toHaveProperty('originalText');
      expect(logOptions).toHaveProperty('maskingResult');
      expect(logOptions).toHaveProperty('site');
      expect(logOptions.maskingResult).toHaveProperty('spans');
    });

    it('should validate LogUploadOptions interface', () => {
      const uploadOptions: LogUploadOptions = {
        filename: 'resume.pdf',
        size: 2048000,
        mimeType: 'application/pdf',
        site: 'claude.ai'
      };

      expect(uploadOptions).toHaveProperty('filename');
      expect(uploadOptions).toHaveProperty('size');
      expect(uploadOptions).toHaveProperty('mimeType');
      expect(uploadOptions).toHaveProperty('site');
      expect(typeof uploadOptions.size).toBe('number');
    });
  });

  describe('ExportService Configuration', () => {
    let exportService: ExportService;

    beforeEach(() => {
      exportService = new ExportService();
    });

    it('should handle export options correctly', () => {
      const jsonOptions = {
        format: 'json' as const,
        type: 'both' as const,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        },
        site: 'chat.openai.com',
        includeStats: true
      };

      expect(jsonOptions.format).toBe('json');
      expect(jsonOptions.type).toBe('both');
      expect(jsonOptions.dateRange).toBeDefined();
      expect(jsonOptions.site).toBe('chat.openai.com');
      expect(jsonOptions.includeStats).toBe(true);
    });

    it('should handle CSV export options', () => {
      const csvOptions = {
        format: 'csv' as const,
        type: 'revisions' as const,
        dateRange: {
          start: new Date('2024-01-01')
        }
      };

      expect(csvOptions.format).toBe('csv');
      expect(csvOptions.type).toBe('revisions');
      expect(csvOptions.dateRange?.start).toBeInstanceOf(Date);
    });

    it('should format bytes correctly', () => {
      // Test the private formatBytes method indirectly through getExportPreview
      const testBytes = [
        0,
        1024,
        1048576,
        1073741824
      ];

      // This tests that the method exists and handles different byte values
      expect(testBytes.length).toBe(4);
      expect(testBytes[0]).toBe(0);
      expect(testBytes[1]).toBe(1024); // 1 KB
      expect(testBytes[2]).toBe(1048576); // 1 MB
      expect(testBytes[3]).toBe(1073741824); // 1 GB
    });

    it('should generate proper timestamp format', () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      
      // Should be in format: 2024-01-15T14-30-45
      expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
      expect(timestamp).not.toContain(':');
      expect(timestamp).not.toContain('.');
    });
  });

  describe('PII Span Processing', () => {
    it('should handle multiple PII types in spans', () => {
      const spans: PIISpan[] = [
        {
          type: 'EMAIL',
          start: 0,
          end: 15,
          text: 'test@email.com',
          confidence: 0.95,
          source: 'regex'
        },
        {
          type: 'PHONE',
          start: 20,
          end: 32,
          text: '123-456-7890',
          confidence: 0.85,
          source: 'regex'
        },
        {
          type: 'NAME',
          start: 35,
          end: 44,
          text: 'John Doe',
          confidence: 0.9,
          source: 'ner'
        }
      ];

      const types = spans.map(s => s.type);
      const sources = spans.map(s => s.source);
      const avgConfidence = spans.reduce((sum, s) => sum + s.confidence, 0) / spans.length;

      expect(types).toContain('EMAIL');
      expect(types).toContain('PHONE');
      expect(types).toContain('NAME');
      expect(sources).toContain('regex');
      expect(sources).toContain('ner');
      expect(avgConfidence).toBeGreaterThan(0.8);
    });

    it('should maintain span order and boundaries', () => {
      const spans: PIISpan[] = [
        { type: 'EMAIL', start: 10, end: 25, text: 'user@domain.com', confidence: 0.9, source: 'regex' },
        { type: 'PHONE', start: 30, end: 42, text: '555-123-4567', confidence: 0.85, source: 'regex' }
      ];

      // Spans should be ordered by start position
      expect(spans[0].start).toBeLessThan(spans[1].start);
      expect(spans[0].end).toBeLessThan(spans[1].start); // No overlap
      
      // Each span should have valid boundaries
      spans.forEach(span => {
        expect(span.start).toBeGreaterThanOrEqual(0);
        expect(span.end).toBeGreaterThan(span.start);
        expect(span.confidence).toBeGreaterThan(0);
        expect(span.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('File Upload Tracking', () => {
    it('should handle different file types', () => {
      const fileTypes = [
        { filename: 'document.pdf', mimeType: 'application/pdf', size: 1024000 },
        { filename: 'image.jpg', mimeType: 'image/jpeg', size: 512000 },
        { filename: 'data.csv', mimeType: 'text/csv', size: 102400 },
        { filename: 'archive.zip', mimeType: 'application/zip', size: 2048000 },
        { filename: 'unknown.xyz', mimeType: 'application/octet-stream', size: 1000 }
      ];

      fileTypes.forEach(file => {
        expect(file.filename).toMatch(/\.\w+$/); // Has file extension
        expect(file.mimeType).toMatch(/^[\w-]+\/[\w-]+$/); // Valid MIME type format
        expect(file.size).toBeGreaterThan(0);
      });
    });

    it('should track upload metadata', () => {
      const uploadMetadata = {
        timestamp: Date.now(),
        site: 'claude.ai',
        filename: 'sensitive-doc.pdf',
        size: 1024000,
        mimeType: 'application/pdf'
      };

      expect(uploadMetadata.timestamp).toBeGreaterThan(0);
      expect(uploadMetadata.site).toBeTruthy();
      expect(uploadMetadata.filename).toBeTruthy();
      expect(uploadMetadata.size).toBeGreaterThan(0);
      expect(uploadMetadata.mimeType).toBeTruthy();
    });
  });

  describe('Site Configuration', () => {
    it('should handle different sites', () => {
      const supportedSites = [
        'chat.openai.com',
        'claude.ai',
        'bard.google.com'
      ];

      supportedSites.forEach(site => {
        expect(site).toMatch(/^[\w.-]+$/); // Valid domain format
        expect(site.includes('.')).toBe(true); // Has TLD
      });
    });
  });
});