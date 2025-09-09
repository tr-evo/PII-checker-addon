export interface RevisionEntry {
  id: string;
  timestamp: number;
  site: string;
  originalHash: string;
  maskedText: string;
  spans: Array<{
    type: string;
    start: number;
    end: number;
    confidence: number;
    source: string;
  }>;
  version: string;
}

export interface UploadEntry {
  id: string;
  timestamp: number;
  site: string;
  filename: string;
  size: number;
  mimeType: string;
}

interface DatabaseSchema {
  revisions: RevisionEntry;
  uploads: UploadEntry;
}

/**
 * IndexedDB wrapper for PII Checker logging
 */
export class PIIDatabase {
  private dbName = 'pii-checker-db';
  private version = 1;
  private db: IDBDatabase | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create revisions store
        if (!db.objectStoreNames.contains('revisions')) {
          const revisionStore = db.createObjectStore('revisions', { keyPath: 'id' });
          revisionStore.createIndex('timestamp', 'timestamp', { unique: false });
          revisionStore.createIndex('site', 'site', { unique: false });
        }

        // Create uploads store
        if (!db.objectStoreNames.contains('uploads')) {
          const uploadStore = db.createObjectStore('uploads', { keyPath: 'id' });
          uploadStore.createIndex('timestamp', 'timestamp', { unique: false });
          uploadStore.createIndex('site', 'site', { unique: false });
        }
      };
    });
  }

  /**
   * Add a revision entry
   */
  async addRevision(entry: Omit<RevisionEntry, 'id' | 'timestamp' | 'version'>): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const id = this.generateId();
    const revisionEntry: RevisionEntry = {
      id,
      timestamp: Date.now(),
      version: '0.1.0',
      ...entry
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['revisions'], 'readwrite');
      const store = transaction.objectStore('revisions');
      const request = store.add(revisionEntry);

      request.onerror = () => {
        reject(new Error(`Failed to add revision: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(id);
      };
    });
  }

  /**
   * Add an upload entry
   */
  async addUpload(entry: Omit<UploadEntry, 'id' | 'timestamp'>): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const id = this.generateId();
    const uploadEntry: UploadEntry = {
      id,
      timestamp: Date.now(),
      ...entry
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      const request = store.add(uploadEntry);

      request.onerror = () => {
        reject(new Error(`Failed to add upload: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(id);
      };
    });
  }

  /**
   * Get all revisions with optional filters
   */
  async getRevisions(options: {
    site?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<RevisionEntry[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['revisions'], 'readonly');
      const store = transaction.objectStore('revisions');
      
      let request: IDBRequest;
      
      if (options.site) {
        const index = store.index('site');
        request = index.getAll(options.site);
      } else {
        request = store.getAll();
      }

      request.onerror = () => {
        reject(new Error(`Failed to get revisions: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        let results: RevisionEntry[] = request.result;

        // Apply date filters
        if (options.startDate || options.endDate) {
          results = results.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            if (options.startDate && entryDate < options.startDate) return false;
            if (options.endDate && entryDate > options.endDate) return false;
            return true;
          });
        }

        // Sort by timestamp (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp);

        // Apply pagination
        if (options.offset || options.limit) {
          const start = options.offset || 0;
          const end = options.limit ? start + options.limit : undefined;
          results = results.slice(start, end);
        }

        resolve(results);
      };
    });
  }

  /**
   * Get all uploads with optional filters
   */
  async getUploads(options: {
    site?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<UploadEntry[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['uploads'], 'readonly');
      const store = transaction.objectStore('uploads');
      
      let request: IDBRequest;
      
      if (options.site) {
        const index = store.index('site');
        request = index.getAll(options.site);
      } else {
        request = store.getAll();
      }

      request.onerror = () => {
        reject(new Error(`Failed to get uploads: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        let results: UploadEntry[] = request.result;

        // Apply date filters
        if (options.startDate || options.endDate) {
          results = results.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            if (options.startDate && entryDate < options.startDate) return false;
            if (options.endDate && entryDate > options.endDate) return false;
            return true;
          });
        }

        // Sort by timestamp (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp);

        // Apply pagination
        if (options.offset || options.limit) {
          const start = options.offset || 0;
          const end = options.limit ? start + options.limit : undefined;
          results = results.slice(start, end);
        }

        resolve(results);
      };
    });
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalRevisions: number;
    totalUploads: number;
    revisionsBySite: Record<string, number>;
    uploadsBySite: Record<string, number>;
  }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [revisions, uploads] = await Promise.all([
      this.getRevisions(),
      this.getUploads()
    ]);

    const revisionsBySite: Record<string, number> = {};
    const uploadsBySite: Record<string, number> = {};

    revisions.forEach(entry => {
      revisionsBySite[entry.site] = (revisionsBySite[entry.site] || 0) + 1;
    });

    uploads.forEach(entry => {
      uploadsBySite[entry.site] = (uploadsBySite[entry.site] || 0) + 1;
    });

    return {
      totalRevisions: revisions.length,
      totalUploads: uploads.length,
      revisionsBySite,
      uploadsBySite
    };
  }

  /**
   * Delete entries older than specified date
   */
  async purgeOldEntries(olderThan: Date): Promise<{ revisionsDeleted: number; uploadsDeleted: number }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const cutoffTimestamp = olderThan.getTime();

    // Delete old revisions
    const revisionsDeleted = await new Promise<number>((resolve, reject) => {
      const transaction = this.db!.transaction(['revisions'], 'readwrite');
      const store = transaction.objectStore('revisions');
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTimestamp);
      
      let deleteCount = 0;
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deleteCount++;
          cursor.continue();
        } else {
          resolve(deleteCount);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to purge revisions: ${request.error?.message}`));
      };
    });

    // Delete old uploads
    const uploadsDeleted = await new Promise<number>((resolve, reject) => {
      const transaction = this.db!.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTimestamp);
      
      let deleteCount = 0;
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deleteCount++;
          cursor.continue();
        } else {
          resolve(deleteCount);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to purge uploads: ${request.error?.message}`));
      };
    });

    return { revisionsDeleted, uploadsDeleted };
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['revisions', 'uploads'], 'readwrite');
      
      const revisionStore = transaction.objectStore('revisions');
      const uploadStore = transaction.objectStore('uploads');
      
      const clearRevisions = revisionStore.clear();
      const clearUploads = uploadStore.clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        reject(new Error('Failed to clear database'));
      };
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const piiDatabase = new PIIDatabase();