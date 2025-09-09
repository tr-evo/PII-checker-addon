import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PIILogger } from '../src/logging/logger';
import { PIIDatabase } from '../src/logging/database';
import { ExportService } from '../src/logging/export-service';
import type { PIIMaskingResult } from '../src/pii/pii-detector';

// Mock IndexedDB for testing
const createMockRequest = () => ({
  onerror: null,
  onsuccess: null,
  onupgradeneeded: null,
  result: null,
  error: null
});

const createMockDB = () => ({
  close: vi.fn(),
  createObjectStore: vi.fn().mockReturnValue({
    createIndex: vi.fn()
  }),
  objectStoreNames: {
    contains: vi.fn().mockReturnValue(false)
  },
  transaction: vi.fn().mockReturnValue({
    objectStore: vi.fn().mockReturnValue({
      add: vi.fn().mockReturnValue(createMockRequest()),
      getAll: vi.fn().mockReturnValue(createMockRequest()),
      index: vi.fn().mockReturnValue({
        getAll: vi.fn().mockReturnValue(createMockRequest())
      }),
      clear: vi.fn()
    }),
    oncomplete: null,
    onerror: null
  })
});

const mockIDB = {
  open: vi.fn().mockReturnValue(createMockRequest()),
  databases: vi.fn()
};

Object.defineProperty(globalThis, 'indexedDB', {
  value: mockIDB,
  writable: true
});

// Mock crypto for hashing
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  },
  writable: true
});

describe('PII Logging System', () => {
  let logger: PIILogger;
  let database: PIIDatabase;
  let exportService: ExportService;

  beforeEach(() => {
    logger = new PIILogger();
    database = new PIIDatabase();
    exportService = new ExportService();
    
    // Mock database operations
    vi.spyOn(database, 'init').mockResolvedValue();
    vi.spyOn(database, 'addRevision').mockResolvedValue('test-revision-id');
    vi.spyOn(database, 'addUpload').mockResolvedValue('test-upload-id');
    vi.spyOn(database, 'getRevisions').mockResolvedValue([]);
    vi.spyOn(database, 'getUploads').mockResolvedValue([]);
    vi.spyOn(database, 'getStats').mockResolvedValue({
      totalRevisions: 0,
      totalUploads: 0,
      revisionsBySite: {},
      uploadsBySite: {}
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PIILogger', () => {
    it('should initialize successfully', async () => {
      await expect(logger.init()).resolves.not.toThrow();
    });

    it('should log a revision with PII spans', async () => {
      const mockMaskingResult: PIIMaskingResult = {
        maskedText: 'My email is [[EMAIL]]',
        spans: [{
          type: 'EMAIL',
          start: 12,
          end: 28,
          text: 'john@example.com',
          confidence: 0.95,
          source: 'regex'
        }],
        processingTime: 100
      };

      const revisionId = await logger.logRevision({
        originalText: 'My email is john@example.com',
        maskingResult: mockMaskingResult,
        site: 'chat.openai.com'
      });

      expect(revisionId).toBe('test-revision-id');
      expect(database.addRevision).toHaveBeenCalledWith(expect.objectContaining({
        site: 'chat.openai.com',
        maskedText: 'My email is [[EMAIL]]',
        spans: expect.arrayContaining([
          expect.objectContaining({
            type: 'EMAIL',
            confidence: 0.95
          })
        ])
      }));
    });

    it('should log a file upload', async () => {
      const uploadId = await logger.logUpload({
        filename: 'document.pdf',
        size: 1024000,
        mimeType: 'application/pdf',
        site: 'claude.ai'
      });

      expect(uploadId).toBe('test-upload-id');
      expect(database.addUpload).toHaveBeenCalledWith({
        site: 'claude.ai',
        filename: 'document.pdf',
        size: 1024000,
        mimeType: 'application/pdf'
      });
    });

    it('should get statistics', async () => {
      const stats = await logger.getStats();
      
      expect(stats).toHaveProperty('totalRevisions');
      expect(stats).toHaveProperty('totalUploads');
      expect(stats).toHaveProperty('recentActivity');
      expect(stats.recentActivity).toHaveProperty('today');
      expect(stats.recentActivity).toHaveProperty('thisWeek');
      expect(stats.recentActivity).toHaveProperty('thisMonth');
    });

    it('should export logs as JSON', async () => {
      const exportData = await logger.exportLogs({
        includeRevisions: true,
        includeUploads: true
      });

      expect(exportData).toHaveProperty('exportTimestamp');
      expect(exportData).toHaveProperty('stats');
    });
  });

  describe('ExportService', () => {
    it('should get export preview', async () => {
      const preview = await exportService.getExportPreview({
        type: 'both'
      });

      expect(preview).toHaveProperty('revisionsCount');
      expect(preview).toHaveProperty('uploadsCount');
      expect(preview).toHaveProperty('estimatedSize');
    });

    it('should handle JSON export options', async () => {
      vi.spyOn(logger, 'exportLogs').mockResolvedValue({
        revisions: [],
        uploads: [],
        exportTimestamp: Date.now(),
        stats: {
          totalRevisions: 0,
          totalUploads: 0,
          revisionsBySite: {},
          uploadsBySite: {},
          recentActivity: {
            today: { revisions: 0, uploads: 0 },
            thisWeek: { revisions: 0, uploads: 0 },
            thisMonth: { revisions: 0, uploads: 0 }
          }
        }
      });

      const result = await exportService.exportLogs({
        format: 'json',
        type: 'both'
      });

      expect(result).toHaveProperty('exportTimestamp');
      expect(result).toHaveProperty('stats');
    });

    it('should handle CSV export options', async () => {
      vi.spyOn(logger, 'exportLogsAsCSV').mockResolvedValue('id,timestamp,site\n');

      const result = await exportService.exportLogs({
        format: 'csv',
        type: 'revisions'
      });

      expect(result).toHaveProperty('revisions');
      expect((result as any).revisions).toBe('id,timestamp,site\n');
    });
  });

  describe('Error Handling', () => {
    it('should handle database initialization errors', async () => {
      vi.spyOn(database, 'init').mockRejectedValue(new Error('Database unavailable'));
      
      await expect(logger.init()).rejects.toThrow('Database unavailable');
    });

    it('should handle logging errors gracefully', async () => {
      vi.spyOn(database, 'addRevision').mockRejectedValue(new Error('Storage full'));
      
      const mockMaskingResult: PIIMaskingResult = {
        maskedText: 'test',
        spans: [],
        processingTime: 0
      };

      await expect(logger.logRevision({
        originalText: 'test',
        maskingResult: mockMaskingResult,
        site: 'test.com'
      })).rejects.toThrow('Storage full');
    });
  });
});