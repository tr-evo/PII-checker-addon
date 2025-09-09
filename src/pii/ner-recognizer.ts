import { pipeline, Pipeline } from '@xenova/transformers';
import { PIISpan, PIIType } from './regex-recognizers';

interface NERResult {
  entity: string;
  score: number;
  index: number;
  word: string;
  start: number;
  end: number;
}

/**
 * Maps NER entity labels to our PII types
 */
const NER_TO_PII_TYPE_MAP: Record<string, PIIType> = {
  'PER': 'NAME',      // Person
  'PERSON': 'NAME',   // Person (alternative label)
  'ORG': 'NAME',      // Organization (can contain person names)
  'LOC': 'ADDRESS',   // Location
  'MISC': 'NAME'      // Miscellaneous (often contains names)
};

/**
 * NER-based PII recognizer using transformers.js
 */
export class NERRecognizer {
  private model: Pipeline | null = null;
  private isLoading = false;
  private loadPromise: Promise<Pipeline> | null = null;

  /**
   * Lazy loads the NER model
   */
  private async loadModel(): Promise<Pipeline> {
    if (this.model) {
      return this.model;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.initializeModel();
    
    try {
      this.model = await this.loadPromise;
      return this.model;
    } finally {
      this.isLoading = false;
    }
  }

  private async initializeModel(): Promise<Pipeline> {
    console.log('[PII Checker] Loading BERT NER model...');
    
    // Use bert-base-NER model for named entity recognition
    const model = await pipeline(
      'token-classification',
      'Xenova/bert-base-NER',
      {
        // Enable quantization for smaller memory footprint
        quantized: true
      }
    );
    
    console.log('[PII Checker] BERT NER model loaded successfully');
    return model as Pipeline;
  }

  /**
   * Detects PII using the BERT NER model
   */
  async detectPII(text: string, timeout = 5000): Promise<PIISpan[]> {
    if (!text.trim()) {
      return [];
    }

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('NER timeout')), timeout);
      });

      const model = await Promise.race([
        this.loadModel(),
        timeoutPromise
      ]);

      // Run NER inference
      const results = await Promise.race([
        model(text, {
          aggregation_strategy: 'simple', // Aggregate sub-tokens
          ignore_labels: ['O'] // Ignore "Outside" labels
        }) as Promise<NERResult[]>,
        timeoutPromise
      ]);

      return this.convertNERResultsToSpans(results, text);
      
    } catch (error) {
      console.warn('[PII Checker] NER recognition failed:', error);
      return [];
    }
  }

  /**
   * Converts NER results to PII spans
   */
  private convertNERResultsToSpans(results: NERResult[], originalText: string): PIISpan[] {
    const spans: PIISpan[] = [];

    for (const result of results) {
      // Map NER entity to PII type
      const entityLabel = result.entity.replace(/^B-|^I-/, ''); // Remove BIO prefixes
      const piiType = NER_TO_PII_TYPE_MAP[entityLabel];
      
      if (!piiType) {
        continue; // Skip unmapped entities
      }

      // Ensure we have valid span positions
      const start = Math.max(0, result.start || 0);
      const end = Math.min(originalText.length, result.end || start + result.word.length);
      
      if (start >= end) {
        continue; // Skip invalid spans
      }

      const text = originalText.slice(start, end);
      
      // Skip very short matches or obvious non-PII
      if (text.length < 2 || /^[^a-zA-Z]*$/.test(text)) {
        continue;
      }

      // Adjust confidence based on entity type and score
      let confidence = result.score;
      
      // Higher confidence for person names
      if (piiType === 'NAME' && entityLabel === 'PER') {
        confidence = Math.min(0.95, confidence * 1.1);
      }
      
      // Lower confidence for locations (might be generic)
      if (piiType === 'ADDRESS') {
        confidence = confidence * 0.8;
      }

      spans.push({
        type: piiType,
        start,
        end,
        text,
        confidence,
        source: 'ner'
      });
    }

    return spans;
  }

  /**
   * Preloads the model in the background
   */
  async preload(): Promise<void> {
    try {
      await this.loadModel();
    } catch (error) {
      console.warn('[PII Checker] Failed to preload NER model:', error);
    }
  }

  /**
   * Checks if the model is loaded
   */
  isModelLoaded(): boolean {
    return this.model !== null;
  }

  /**
   * Gets model loading status
   */
  getLoadingStatus(): 'not-loaded' | 'loading' | 'loaded' | 'error' {
    if (this.model) return 'loaded';
    if (this.isLoading) return 'loading';
    return 'not-loaded';
  }
}

// Singleton instance for the NER recognizer
export const nerRecognizer = new NERRecognizer();