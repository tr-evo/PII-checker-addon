import type { PIIDetectionOptions, PIIMaskingResult } from './pii-detector';
import type { PIISpan } from './regex-recognizers';

interface WorkerMessage {
  id: string;
  type: 'MASK_TEXT' | 'DETECT_PII' | 'PRELOAD_MODELS' | 'GET_STATUS';
  payload?: {
    text?: string;
    options?: PIIDetectionOptions;
  };
}

interface WorkerResponse {
  id: string;
  type: 'SUCCESS' | 'ERROR';
  payload?: any;
  error?: string;
}

/**
 * Client for communicating with the PII worker
 * Handles message passing and promise resolution
 */
export class PIIWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: number;
  }>();
  private requestCounter = 0;
  private isInitialized = false;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    try {
      // Create worker from the bundled worker script
      this.worker = new Worker(
        chrome.runtime.getURL('workers/pii-worker.js'),
        { type: 'module' }
      );

      this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
      this.worker.addEventListener('error', this.handleWorkerError.bind(this));

      console.log('[PII Worker Client] Worker initialized');

      // Preload models in the background
      this.preloadModels().catch(error => 
        console.warn('[PII Worker Client] Failed to preload models:', error)
      );

    } catch (error) {
      console.error('[PII Worker Client] Failed to initialize worker:', error);
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
    const { id, type, payload, error } = event.data;
    const request = this.pendingRequests.get(id);

    if (!request) {
      console.warn('[PII Worker Client] Received response for unknown request:', id);
      return;
    }

    window.clearTimeout(request.timeout);
    this.pendingRequests.delete(id);

    if (type === 'SUCCESS') {
      request.resolve(payload);
    } else {
      request.reject(new Error(error || 'Worker request failed'));
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error('[PII Worker Client] Worker error:', error);
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      window.clearTimeout(timeout);
      reject(new Error('Worker error'));
    });
    this.pendingRequests.clear();
  }

  private sendMessage<T>(
    type: WorkerMessage['type'], 
    payload?: WorkerMessage['payload'],
    timeoutMs = 10000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = `req_${++this.requestCounter}`;
      
      const timeout = window.setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.worker.postMessage({ id, type, payload });
    });
  }

  /**
   * Masks PII in the given text
   */
  async maskText(
    text: string, 
    options?: PIIDetectionOptions,
    timeoutMs = 10000
  ): Promise<PIIMaskingResult> {
    if (!text.trim()) {
      return {
        maskedText: text,
        spans: [],
        processingTime: 0
      };
    }

    return this.sendMessage<PIIMaskingResult>(
      'MASK_TEXT',
      { text, options },
      timeoutMs
    );
  }

  /**
   * Detects PII in the given text without masking
   */
  async detectPII(
    text: string,
    options?: PIIDetectionOptions,
    timeoutMs = 10000
  ): Promise<PIISpan[]> {
    if (!text.trim()) {
      return [];
    }

    return this.sendMessage<PIISpan[]>(
      'DETECT_PII',
      { text, options },
      timeoutMs
    );
  }

  /**
   * Preloads the ML models for faster processing
   */
  async preloadModels(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.sendMessage('PRELOAD_MODELS', undefined, 30000);
      this.isInitialized = true;
      console.log('[PII Worker Client] Models preloaded successfully');
    } catch (error) {
      console.error('[PII Worker Client] Failed to preload models:', error);
      throw error;
    }
  }

  /**
   * Gets the status of the worker and detection methods
   */
  async getStatus(): Promise<any> {
    return this.sendMessage('GET_STATUS');
  }

  /**
   * Checks if models are loaded and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  /**
   * Destroys the worker and cleans up resources
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      window.clearTimeout(timeout);
      reject(new Error('Worker destroyed'));
    });
    this.pendingRequests.clear();

    this.isInitialized = false;
  }
}

// Singleton instance for the PII worker client
export const piiWorkerClient = new PIIWorkerClient();