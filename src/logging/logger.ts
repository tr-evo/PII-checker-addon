import { piiDatabase, RevisionEntry, UploadEntry } from './database';
import type { PIIMaskingResult } from '../pii/pii-detector';

export interface LogRevisionOptions {
  originalText: string;
  maskingResult: PIIMaskingResult;
  site: string;
}

export interface LogUploadOptions {
  filename: string;
  size: number;
  mimeType: string;
  site: string;
}

/**
 * Logger for PII revisions and file uploads
 */
export class PIILogger {
  private initialized = false;

  /**
   * Initialize the logger
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await piiDatabase.init();
      this.initialized = true;
      console.log('[PII Logger] Database initialized successfully');
    } catch (error) {
      console.error('[PII Logger] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Log a revision (masked text submission)
   */
  async logRevision(options: LogRevisionOptions): Promise<string> {
    await this.ensureInitialized();

    try {
      const id = await piiDatabase.addRevision({
        site: options.site,
        originalHash: options.maskingResult.originalHash || await this.hashText(options.originalText),
        maskedText: options.maskingResult.maskedText,
        spans: options.maskingResult.spans.map(span => ({
          type: span.type,
          start: span.start,
          end: span.end,
          confidence: span.confidence,
          source: span.source
        }))
      });

      console.log(`[PII Logger] Revision logged: ${id} (${options.maskingResult.spans.length} PII spans)`);
      return id;
    } catch (error) {
      console.error('[PII Logger] Failed to log revision:', error);
      throw error;
    }
  }

  /**
   * Log a file upload
   */
  async logUpload(options: LogUploadOptions): Promise<string> {
    await this.ensureInitialized();

    try {
      const id = await piiDatabase.addUpload({
        site: options.site,
        filename: options.filename,
        size: options.size,
        mimeType: options.mimeType
      });

      console.log(`[PII Logger] Upload logged: ${id} (${options.filename}, ${this.formatFileSize(options.size)})`);
      return id;
    } catch (error) {
      console.error('[PII Logger] Failed to log upload:', error);
      throw error;
    }
  }

  /**
   * Get revision logs with filtering options
   */
  async getRevisions(options: {
    site?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<RevisionEntry[]> {
    await this.ensureInitialized();
    return piiDatabase.getRevisions(options);
  }

  /**
   * Get upload logs with filtering options
   */
  async getUploads(options: {
    site?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<UploadEntry[]> {
    await this.ensureInitialized();
    return piiDatabase.getUploads(options);
  }

  /**
   * Get logging statistics
   */
  async getStats(): Promise<{
    totalRevisions: number;
    totalUploads: number;
    revisionsBySite: Record<string, number>;
    uploadsBySite: Record<string, number>;
    recentActivity: {
      today: { revisions: number; uploads: number };
      thisWeek: { revisions: number; uploads: number };
      thisMonth: { revisions: number; uploads: number };
    };
  }> {
    await this.ensureInitialized();

    const baseStats = await piiDatabase.getStats();

    // Calculate recent activity
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay.getTime() - (startOfDay.getDay() * 24 * 60 * 60 * 1000));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayRevisions,
      todayUploads,
      weekRevisions,
      weekUploads,
      monthRevisions,
      monthUploads
    ] = await Promise.all([
      this.getRevisions({ startDate: startOfDay }),
      this.getUploads({ startDate: startOfDay }),
      this.getRevisions({ startDate: startOfWeek }),
      this.getUploads({ startDate: startOfWeek }),
      this.getRevisions({ startDate: startOfMonth }),
      this.getUploads({ startDate: startOfMonth })
    ]);

    return {
      ...baseStats,
      recentActivity: {
        today: {
          revisions: todayRevisions.length,
          uploads: todayUploads.length
        },
        thisWeek: {
          revisions: weekRevisions.length,
          uploads: weekUploads.length
        },
        thisMonth: {
          revisions: monthRevisions.length,
          uploads: monthUploads.length
        }
      }
    };
  }

  /**
   * Export logs as JSON
   */
  async exportLogs(options: {
    includeRevisions?: boolean;
    includeUploads?: boolean;
    startDate?: Date;
    endDate?: Date;
    site?: string;
  } = {}): Promise<{
    revisions?: RevisionEntry[];
    uploads?: UploadEntry[];
    exportTimestamp: number;
    stats: Awaited<ReturnType<PIILogger['getStats']>>;
  }> {
    await this.ensureInitialized();

    const exportData: any = {
      exportTimestamp: Date.now(),
      stats: await this.getStats()
    };

    if (options.includeRevisions !== false) {
      exportData.revisions = await this.getRevisions({
        site: options.site,
        startDate: options.startDate,
        endDate: options.endDate
      });
    }

    if (options.includeUploads !== false) {
      exportData.uploads = await this.getUploads({
        site: options.site,
        startDate: options.startDate,
        endDate: options.endDate
      });
    }

    return exportData;
  }

  /**
   * Export logs as CSV
   */
  async exportLogsAsCSV(type: 'revisions' | 'uploads', options: {
    startDate?: Date;
    endDate?: Date;
    site?: string;
  } = {}): Promise<string> {
    await this.ensureInitialized();

    if (type === 'revisions') {
      const revisions = await this.getRevisions(options);
      return this.convertRevisionsToCSV(revisions);
    } else {
      const uploads = await this.getUploads(options);
      return this.convertUploadsToCSV(uploads);
    }
  }

  /**
   * Purge old logs
   */
  async purgeOldLogs(olderThanDays: number): Promise<{
    revisionsDeleted: number;
    uploadsDeleted: number;
  }> {
    await this.ensureInitialized();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await piiDatabase.purgeOldEntries(cutoffDate);
    
    console.log(`[PII Logger] Purged ${result.revisionsDeleted} revisions and ${result.uploadsDeleted} uploads older than ${olderThanDays} days`);
    
    return result;
  }

  /**
   * Clear all logs
   */
  async clearAllLogs(): Promise<void> {
    await this.ensureInitialized();
    await piiDatabase.clearAll();
    console.log('[PII Logger] All logs cleared');
  }

  /**
   * Ensure the logger is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Hash text for privacy
   */
  private async hashText(text: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (error) {
        console.warn('[PII Logger] Failed to hash text with WebCrypto, using fallback');
      }
    }
    
    // Fallback: simple hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Convert revisions to CSV format
   */
  private convertRevisionsToCSV(revisions: RevisionEntry[]): string {
    const headers = ['ID', 'Timestamp', 'Site', 'Original Hash', 'Masked Text', 'PII Count', 'PII Types', 'Version'];
    const rows = revisions.map(revision => [
      revision.id,
      new Date(revision.timestamp).toISOString(),
      revision.site,
      revision.originalHash,
      `"${revision.maskedText.replace(/"/g, '""')}"`, // Escape quotes
      revision.spans.length.toString(),
      revision.spans.map(s => s.type).join(';'),
      revision.version
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Convert uploads to CSV format
   */
  private convertUploadsToCSV(uploads: UploadEntry[]): string {
    const headers = ['ID', 'Timestamp', 'Site', 'Filename', 'Size (bytes)', 'MIME Type'];
    const rows = uploads.map(upload => [
      upload.id,
      new Date(upload.timestamp).toISOString(),
      upload.site,
      `"${upload.filename.replace(/"/g, '""')}"`, // Escape quotes
      upload.size.toString(),
      upload.mimeType
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

// Singleton instance
export const piiLogger = new PIILogger();