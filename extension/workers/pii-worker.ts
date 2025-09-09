import { piiDetector } from '../../src/pii/pii-detector';
import type { PIIDetectionOptions, PIIMaskingResult } from '../../src/pii/pii-detector';
import type { PIISpan } from '../../src/pii/regex-recognizers';

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
  payload?: PIIMaskingResult | PIISpan[] | any;
  error?: string;
}

/**
 * PII Worker for off-main-thread processing
 * Handles heavy PII detection and masking operations
 */
class PIIWorker {
  private isInitialized = false;

  constructor() {
    // Listen for messages from the main thread
    self.addEventListener('message', this.handleMessage.bind(this));
    console.log('[PII Worker] Worker initialized');
  }

  private async handleMessage(event: MessageEvent<WorkerMessage>) {
    const { id, type, payload } = event.data;
    
    try {
      let result: any;

      switch (type) {
        case 'PRELOAD_MODELS':
          result = await this.preloadModels();
          break;

        case 'MASK_TEXT':
          if (!payload?.text) {
            throw new Error('Text is required for masking');
          }
          result = await this.maskText(payload.text, payload.options);
          break;

        case 'DETECT_PII':
          if (!payload?.text) {
            throw new Error('Text is required for PII detection');
          }
          result = await this.detectPII(payload.text, payload.options);
          break;

        case 'GET_STATUS':
          result = this.getStatus();
          break;

        default:
          throw new Error(`Unknown message type: ${type}`);
      }

      this.sendResponse({
        id,
        type: 'SUCCESS',
        payload: result
      });

    } catch (error) {
      console.error('[PII Worker] Error processing message:', error);
      this.sendResponse({
        id,
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async preloadModels(): Promise<{ status: string }> {
    if (!this.isInitialized) {
      console.log('[PII Worker] Preloading models...');
      await piiDetector.preloadModels();
      this.isInitialized = true;
      console.log('[PII Worker] Models preloaded successfully');
    }
    return { status: 'ready' };
  }

  private async maskText(text: string, options?: PIIDetectionOptions): Promise<PIIMaskingResult> {
    console.log(`[PII Worker] Masking text (${text.length} chars)...`);
    const result = await piiDetector.maskPII(text, options);
    console.log(`[PII Worker] Masking completed, found ${result.spans.length} PII spans`);
    return result;
  }

  private async detectPII(text: string, options?: PIIDetectionOptions): Promise<PIISpan[]> {
    console.log(`[PII Worker] Detecting PII in text (${text.length} chars)...`);
    const spans = await piiDetector.detectPII(text, options);
    console.log(`[PII Worker] Detection completed, found ${spans.length} PII spans`);
    return spans;
  }

  private getStatus() {
    return {
      initialized: this.isInitialized,
      detectionMethods: piiDetector.getStatus()
    };
  }

  private sendResponse(response: WorkerResponse) {
    self.postMessage(response);
  }
}

// Initialize the worker
new PIIWorker();