import { piiLogger } from './logger';

export interface ExportOptions {
  format: 'json' | 'csv';
  type?: 'revisions' | 'uploads' | 'both';
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  site?: string;
  includeStats?: boolean;
}

/**
 * Service for exporting PII logs in various formats
 */
export class ExportService {
  /**
   * Export logs with the specified options
   */
  async exportLogs(options: ExportOptions): Promise<string | { [key: string]: string }> {
    const { format, type = 'both', dateRange, site, includeStats = true } = options;

    if (format === 'json') {
      return this.exportAsJSON(type, dateRange, site, includeStats);
    } else {
      return this.exportAsCSV(type, dateRange, site);
    }
  }

  /**
   * Download logs as a file
   */
  async downloadLogs(options: ExportOptions, filename?: string): Promise<void> {
    const data = await this.exportLogs(options);
    
    if (options.format === 'json') {
      const jsonData = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const defaultFilename = filename || `pii-logs-${this.getTimestamp()}.json`;
      this.downloadBlob(blob, defaultFilename);
    } else {
      // CSV format returns an object with multiple files
      const csvData = data as { [key: string]: string };
      
      if (Object.keys(csvData).length === 1) {
        // Single file
        const [key, content] = Object.entries(csvData)[0];
        const blob = new Blob([content], { type: 'text/csv' });
        const defaultFilename = filename || `pii-${key}-${this.getTimestamp()}.csv`;
        this.downloadBlob(blob, defaultFilename);
      } else {
        // Multiple files - create a zip (or download separately)
        for (const [key, content] of Object.entries(csvData)) {
          const blob = new Blob([content], { type: 'text/csv' });
          const csvFilename = `pii-${key}-${this.getTimestamp()}.csv`;
          this.downloadBlob(blob, csvFilename);
        }
      }
    }
  }

  /**
   * Export as JSON format
   */
  private async exportAsJSON(
    type: 'revisions' | 'uploads' | 'both', 
    dateRange?: { start?: Date; end?: Date },
    site?: string,
    includeStats = true
  ): Promise<any> {
    const exportOptions = {
      startDate: dateRange?.start,
      endDate: dateRange?.end,
      site,
      includeRevisions: type === 'revisions' || type === 'both',
      includeUploads: type === 'uploads' || type === 'both'
    };

    const result = await piiLogger.exportLogs(exportOptions);
    
    if (!includeStats) {
      const { stats, ...dataOnly } = result;
      return dataOnly;
    }
    
    return result;
  }

  /**
   * Export as CSV format
   */
  private async exportAsCSV(
    type: 'revisions' | 'uploads' | 'both',
    dateRange?: { start?: Date; end?: Date },
    site?: string
  ): Promise<{ [key: string]: string }> {
    const csvOptions = {
      startDate: dateRange?.start,
      endDate: dateRange?.end,
      site
    };

    const result: { [key: string]: string } = {};

    if (type === 'revisions' || type === 'both') {
      result.revisions = await piiLogger.exportLogsAsCSV('revisions', csvOptions);
    }

    if (type === 'uploads' || type === 'both') {
      result.uploads = await piiLogger.exportLogsAsCSV('uploads', csvOptions);
    }

    return result;
  }

  /**
   * Download a blob as a file
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Get current timestamp for filenames
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds and Z
  }

  /**
   * Get export statistics without actual data
   */
  async getExportPreview(options: Omit<ExportOptions, 'format'>): Promise<{
    revisionsCount: number;
    uploadsCount: number;
    dateRange: { start?: string; end?: string };
    site?: string;
    estimatedSize: string;
  }> {
    const { type = 'both', dateRange, site } = options;

    const queryOptions = {
      startDate: dateRange?.start,
      endDate: dateRange?.end,
      site
    };

    let revisionsCount = 0;
    let uploadsCount = 0;

    if (type === 'revisions' || type === 'both') {
      const revisions = await piiLogger.getRevisions(queryOptions);
      revisionsCount = revisions.length;
    }

    if (type === 'uploads' || type === 'both') {
      const uploads = await piiLogger.getUploads(queryOptions);
      uploadsCount = uploads.length;
    }

    // Rough size estimation
    const estimatedBytes = (revisionsCount * 500) + (uploadsCount * 200); // Rough estimates
    const estimatedSize = this.formatBytes(estimatedBytes);

    return {
      revisionsCount,
      uploadsCount,
      dateRange: {
        start: dateRange?.start?.toISOString(),
        end: dateRange?.end?.toISOString()
      },
      site,
      estimatedSize
    };
  }

  /**
   * Format bytes into human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
export const exportService = new ExportService();