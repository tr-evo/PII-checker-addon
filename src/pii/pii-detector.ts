import { PIISpan, PIIType, detectPIIWithRegex, adjustConfidenceByContext } from './regex-recognizers';
import { detectPIIWithDenyList } from './deny-list-recognizers';
import { nerRecognizer } from './ner-recognizer';

export interface PIIDetectionOptions {
  enabledTypes?: Set<PIIType>;
  minConfidence?: number;
  useNER?: boolean;
  useDenyList?: boolean;
  useRegex?: boolean;
  companyId?: string;
  timeout?: number;
  locale?: string;
}

export interface PIIMaskingResult {
  maskedText: string;
  spans: PIISpan[];
  originalHash?: string;
  processingTime: number;
}

/**
 * Main PII detector that combines regex, deny-list, and NER approaches
 */
export class PIIDetector {
  private defaultOptions: Required<Omit<PIIDetectionOptions, 'companyId' | 'locale'>> = {
    enabledTypes: new Set([
      'EMAIL', 'PHONE', 'IBAN', 'BIC', 'CARD', 'NAME', 
      'ADDRESS', 'POSTAL_CODE', 'URL', 'UUID', 'SSN', 'TAX_ID', 'DATE_OF_BIRTH'
    ]),
    minConfidence: 0.7,
    useNER: true,
    useDenyList: true, 
    useRegex: true,
    timeout: 5000
  };

  /**
   * Detects all PII spans in the given text
   */
  async detectPII(text: string, options: PIIDetectionOptions = {}): Promise<PIISpan[]> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = performance.now();
    
    if (!text.trim()) {
      return [];
    }

    try {
      const allSpans: PIISpan[] = [];

      // 1. Regex-based detection (fastest, highest priority)
      if (opts.useRegex) {
        const regexSpans = detectPIIWithRegex(text);
        allSpans.push(...regexSpans);
      }

      // 2. Deny-list detection (high priority, overrides others)
      if (opts.useDenyList) {
        const denyListSpans = detectPIIWithDenyList(text, options.companyId);
        allSpans.push(...denyListSpans);
      }

      // 3. NER detection (ML-based, lowest priority but catches names well)
      if (opts.useNER) {
        try {
          const nerSpans = await nerRecognizer.detectPII(text, opts.timeout);
          allSpans.push(...nerSpans);
        } catch (error) {
          console.warn('[PII Checker] NER detection failed, continuing with other methods:', error);
        }
      }

      // Merge overlapping spans with confidence-based priority
      const mergedSpans = this.mergeSpans(allSpans, text);
      
      // Filter by enabled types and confidence
      const filteredSpans = mergedSpans.filter(span => 
        opts.enabledTypes.has(span.type) && 
        span.confidence >= opts.minConfidence
      );

      const processingTime = performance.now() - startTime;
      console.log(`[PII Checker] Detection completed in ${processingTime.toFixed(2)}ms, found ${filteredSpans.length} PII spans`);

      return filteredSpans;

    } catch (error) {
      console.error('[PII Checker] PII detection failed:', error);
      return [];
    }
  }

  /**
   * Masks PII in text by replacing with placeholder tokens
   */
  async maskPII(text: string, options: PIIDetectionOptions = {}): Promise<PIIMaskingResult> {
    const startTime = performance.now();
    
    const spans = await this.detectPII(text, options);
    
    if (spans.length === 0) {
      return {
        maskedText: text,
        spans: [],
        processingTime: performance.now() - startTime
      };
    }

    // Sort spans by start position (descending) to replace from end to start
    // This prevents offset shifts during replacement
    const sortedSpans = [...spans].sort((a, b) => b.start - a.start);
    
    let maskedText = text;
    
    for (const span of sortedSpans) {
      const placeholder = this.createPlaceholder(span);
      maskedText = maskedText.slice(0, span.start) + placeholder + maskedText.slice(span.end);
    }

    return {
      maskedText,
      spans,
      originalHash: await this.hashText(text),
      processingTime: performance.now() - startTime
    };
  }

  /**
   * Merges overlapping spans using confidence-based priority
   * Priority: Deny-List > Regex > NER
   */
  private mergeSpans(spans: PIISpan[], text: string): PIISpan[] {
    if (spans.length === 0) return [];

    // Apply context-based confidence adjustments
    const adjustedSpans = spans.map(span => adjustConfidenceByContext(span, text));
    
    // Sort by start position, then by priority (source), then by confidence
    const sourcePriority = { 'deny-list': 3, 'regex': 2, 'ner': 1 };
    adjustedSpans.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (sourcePriority[a.source] !== sourcePriority[b.source]) {
        return sourcePriority[b.source] - sourcePriority[a.source];
      }
      return b.confidence - a.confidence;
    });

    const mergedSpans: PIISpan[] = [];
    
    for (const currentSpan of adjustedSpans) {
      let merged = false;
      
      // Check for overlap with existing spans
      for (let i = 0; i < mergedSpans.length; i++) {
        const existingSpan = mergedSpans[i];
        
        if (this.spansOverlap(currentSpan, existingSpan)) {
          // Choose the span with higher priority
          const currentPriority = sourcePriority[currentSpan.source];
          const existingPriority = sourcePriority[existingSpan.source];
          
          if (currentPriority > existingPriority || 
              (currentPriority === existingPriority && currentSpan.confidence > existingSpan.confidence)) {
            // Replace existing span with current span
            mergedSpans[i] = this.mergeOverlappingSpans(currentSpan, existingSpan);
          } else {
            // Keep existing span, but potentially extend it
            mergedSpans[i] = this.mergeOverlappingSpans(existingSpan, currentSpan);
          }
          merged = true;
          break;
        }
      }
      
      if (!merged) {
        mergedSpans.push(currentSpan);
      }
    }

    return mergedSpans.sort((a, b) => a.start - b.start);
  }

  /**
   * Checks if two spans overlap
   */
  private spansOverlap(span1: PIISpan, span2: PIISpan): boolean {
    return !(span1.end <= span2.start || span2.end <= span1.start);
  }

  /**
   * Merges two overlapping spans, keeping the higher priority/confidence one
   */
  private mergeOverlappingSpans(primary: PIISpan, secondary: PIISpan): PIISpan {
    const start = Math.min(primary.start, secondary.start);
    const end = Math.max(primary.end, secondary.end);
    
    return {
      ...primary, // Keep primary span's properties
      start,
      end,
      text: primary.text // This might not be accurate for the extended span, but it's the primary match
    };
  }

  /**
   * Creates a placeholder for a PII span
   */
  private createPlaceholder(span: PIISpan): string {
    const placeholders: Record<PIIType, string> = {
      EMAIL: '[[EMAIL]]',
      PHONE: '[[PHONE]]',
      IBAN: '[[IBAN]]',
      BIC: '[[BIC]]',
      CARD: '[[CARD]]',
      NAME: '[[NAME]]',
      ADDRESS: '[[ADDRESS]]',
      POSTAL_CODE: '[[POSTAL_CODE]]',
      URL: '[[URL]]',
      UUID: '[[UUID]]',
      SSN: '[[SSN]]',
      TAX_ID: '[[TAX_ID]]',
      DATE_OF_BIRTH: '[[DATE_OF_BIRTH]]'
    };

    return placeholders[span.type] || `[[${span.type}]]`;
  }

  /**
   * Creates a hash of the original text (for audit purposes)
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
        console.warn('[PII Checker] Failed to hash text with WebCrypto, using fallback');
      }
    }
    
    // Fallback: simple hash for non-secure contexts
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Preloads the NER model for faster first-time detection
   */
  async preloadModels(): Promise<void> {
    try {
      await nerRecognizer.preload();
    } catch (error) {
      console.warn('[PII Checker] Failed to preload models:', error);
    }
  }

  /**
   * Gets the status of all detection methods
   */
  getStatus() {
    return {
      ner: nerRecognizer.getLoadingStatus(),
      regex: 'ready',
      denyList: 'ready'
    };
  }
}

// Export singleton instance
export const piiDetector = new PIIDetector();