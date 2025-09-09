import { describe, bench, beforeEach, afterEach } from 'vitest';
import { PIIDetector } from '../../src/pii/pii-detector';
import type { PIIDetectionOptions } from '../../src/pii/pii-detector';

// Mock the NER recognizer
vi.mock('../../src/pii/ner-recognizer', () => ({
  nerRecognizer: {
    detectPII: vi.fn().mockResolvedValue([])
  }
}));

// Memory monitoring utilities
interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  timestamp: number;
}

class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  
  takeSnapshot(label?: string): MemorySnapshot {
    // Force garbage collection if available (Node.js with --expose-gc)
    if (global.gc) {
      global.gc();
    }
    
    const snapshot: MemorySnapshot = {
      heapUsed: process.memoryUsage?.()?.heapUsed || 0,
      heapTotal: process.memoryUsage?.()?.heapTotal || 0,
      external: process.memoryUsage?.()?.external || 0,
      timestamp: Date.now()
    };
    
    this.snapshots.push(snapshot);
    if (label) {
      console.log(`Memory snapshot [${label}]: ${this.formatBytes(snapshot.heapUsed)} used, ${this.formatBytes(snapshot.heapTotal)} total`);
    }
    
    return snapshot;
  }
  
  getDiff(start: MemorySnapshot, end: MemorySnapshot): number {
    return end.heapUsed - start.heapUsed;
  }
  
  getMaxUsage(): number {
    return Math.max(...this.snapshots.map(s => s.heapUsed));
  }
  
  clear() {
    this.snapshots = [];
  }
  
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

describe('Memory Usage Benchmarks', () => {
  let detector: PIIDetector;
  let monitor: MemoryMonitor;
  let baseOptions: PIIDetectionOptions;

  beforeEach(() => {
    monitor = new MemoryMonitor();
    detector = new PIIDetector();
    baseOptions = {
      enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD', 'IBAN', 'SSN']),
      minConfidence: 0.7,
      useNER: false,
      useRegex: true,
      useDenyList: true,
      timeout: 5000
    };
  });

  afterEach(() => {
    monitor.clear();
  });

  describe('Memory Allocation Patterns', () => {
    bench('Single detection memory usage', async () => {
      const before = monitor.takeSnapshot();
      
      await detector.maskPII('Contact test@example.com', baseOptions);
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      // Log memory usage for analysis
      console.log(`Single detection memory diff: ${diff} bytes`);
    });

    bench('Batch detection memory usage', async () => {
      const before = monitor.takeSnapshot();
      
      const texts = Array.from({ length: 10 }, (_, i) => 
        `Email ${i}: user${i}@example.com, Phone: 555-${String(i).padStart(4, '0')}`
      );
      
      for (const text of texts) {
        await detector.maskPII(text, baseOptions);
      }
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      console.log(`Batch detection (10 items) memory diff: ${diff} bytes`);
    });

    bench('Large text memory usage', async () => {
      const before = monitor.takeSnapshot();
      
      const largeText = Array.from({ length: 1000 }, (_, i) => 
        `Line ${i}: Contact support${i}@company.com or call (555) 123-${String(i).padStart(4, '0')}`
      ).join('\n');
      
      await detector.maskPII(largeText, baseOptions);
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      console.log(`Large text (${largeText.length} chars) memory diff: ${diff} bytes`);
    });
  });

  describe('Memory Leak Detection', () => {
    bench('Repeated operations memory stability', async () => {
      const initialSnapshot = monitor.takeSnapshot('initial');
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await detector.maskPII(`Test ${i}: user${i}@example.com`, baseOptions);
        
        // Take snapshots periodically
        if (i % 25 === 0) {
          monitor.takeSnapshot(`iteration-${i}`);
        }
      }
      
      const finalSnapshot = monitor.takeSnapshot('final');
      const totalGrowth = monitor.getDiff(initialSnapshot, finalSnapshot);
      const maxUsage = monitor.getMaxUsage();
      
      console.log(`Memory growth after 100 operations: ${totalGrowth} bytes`);
      console.log(`Peak memory usage: ${maxUsage} bytes`);
      
      // Check if memory growth is within acceptable bounds
      const acceptableGrowth = 10 * 1024 * 1024; // 10MB
      if (totalGrowth > acceptableGrowth) {
        console.warn(`Potential memory leak detected: ${totalGrowth} bytes growth`);
      }
    });

    bench('Detector instance reuse vs recreation', async () => {
      const text = 'Test email: test@example.com';
      
      // Test with instance reuse
      const reuseStart = monitor.takeSnapshot();
      const sharedDetector = new PIIDetector();
      
      for (let i = 0; i < 50; i++) {
        await sharedDetector.maskPII(text, baseOptions);
      }
      
      const reuseEnd = monitor.takeSnapshot();
      const reuseDiff = monitor.getDiff(reuseStart, reuseEnd);
      
      // Test with instance recreation
      const recreateStart = monitor.takeSnapshot();
      
      for (let i = 0; i < 50; i++) {
        const newDetector = new PIIDetector();
        await newDetector.maskPII(text, baseOptions);
      }
      
      const recreateEnd = monitor.takeSnapshot();
      const recreateDiff = monitor.getDiff(recreateStart, recreateEnd);
      
      console.log(`Reuse strategy memory diff: ${reuseDiff} bytes`);
      console.log(`Recreate strategy memory diff: ${recreateDiff} bytes`);
      console.log(`Memory efficiency of reuse: ${((recreateDiff - reuseDiff) / recreateDiff * 100).toFixed(1)}% better`);
    });
  });

  describe('Data Structure Memory Efficiency', () => {
    bench('Span storage efficiency', async () => {
      const before = monitor.takeSnapshot();
      
      // Generate text with many PII items
      const manyPiiText = Array.from({ length: 100 }, (_, i) => {
        return `Item ${i}: email${i}@test.com, phone: 555-${String(i).padStart(4, '0')}, card: 4111${String(i).padStart(12, '0')}`;
      }).join(' | ');
      
      const result = await detector.maskPII(manyPiiText, baseOptions);
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      console.log(`Generated ${result.spans.length} spans using ${diff} bytes`);
      console.log(`Average memory per span: ${(diff / result.spans.length).toFixed(0)} bytes`);
    });

    bench('String vs StringBuilder pattern', async () => {
      const testText = 'Replace emails: ' + Array.from({ length: 50 }, (_, i) => `user${i}@example.com`).join(', ');
      
      // String concatenation approach
      const stringStart = monitor.takeSnapshot();
      let result1 = testText;
      for (let i = 0; i < 50; i++) {
        result1 = result1.replace(`user${i}@example.com`, '[[EMAIL]]');
      }
      const stringEnd = monitor.takeSnapshot();
      const stringDiff = monitor.getDiff(stringStart, stringEnd);
      
      // Array join approach  
      const arrayStart = monitor.takeSnapshot();
      const parts = [testText];
      for (let i = 0; i < 50; i++) {
        const index = parts[0].indexOf(`user${i}@example.com`);
        if (index !== -1) {
          const before = parts[0].substring(0, index);
          const after = parts[0].substring(index + `user${i}@example.com`.length);
          parts[0] = before + '[[EMAIL]]' + after;
        }
      }
      const result2 = parts[0];
      const arrayEnd = monitor.takeSnapshot();
      const arrayDiff = monitor.getDiff(arrayStart, arrayEnd);
      
      console.log(`String approach memory: ${stringDiff} bytes`);
      console.log(`Array approach memory: ${arrayDiff} bytes`);
    });
  });

  describe('Settings Impact on Memory', () => {
    const testText = 'Contact: john@example.com, phone: (555) 123-4567, card: 4111111111111111, iban: DE89370400440532013000';
    
    bench('Minimal settings memory usage', async () => {
      const before = monitor.takeSnapshot();
      
      const minimalOptions = {
        enabledTypes: new Set(['EMAIL']),
        minConfidence: 0.9,
        useNER: false,
        useRegex: true,
        useDenyList: false,
        timeout: 1000
      };
      
      await detector.maskPII(testText, minimalOptions);
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      console.log(`Minimal settings memory diff: ${diff} bytes`);
    });

    bench('Maximal settings memory usage', async () => {
      const before = monitor.takeSnapshot();
      
      const maximalOptions = {
        enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD', 'IBAN', 'SSN', 'NAME', 'ADDRESS', 'URL', 'UUID']),
        minConfidence: 0.1,
        useNER: false, // Keep disabled for consistent benchmarking
        useRegex: true,
        useDenyList: true,
        timeout: 10000
      };
      
      await detector.maskPII(testText, maximalOptions);
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      console.log(`Maximal settings memory diff: ${diff} bytes`);
    });
  });

  describe('Cleanup and Garbage Collection', () => {
    bench('Object cleanup patterns', async () => {
      const before = monitor.takeSnapshot();
      
      // Create many temporary objects
      const results = [];
      for (let i = 0; i < 100; i++) {
        const result = await detector.maskPII(`Email ${i}: user${i}@test.com`, baseOptions);
        results.push(result);
      }
      
      const afterCreation = monitor.takeSnapshot();
      const creationDiff = monitor.getDiff(before, afterCreation);
      
      // Clear references
      results.length = 0;
      
      // Force cleanup if possible
      if (global.gc) {
        global.gc();
      }
      
      const afterCleanup = monitor.takeSnapshot();
      const cleanupDiff = monitor.getDiff(afterCreation, afterCleanup);
      
      console.log(`Memory after creation: ${creationDiff} bytes`);
      console.log(`Memory after cleanup: ${cleanupDiff} bytes (negative is good)`);
      console.log(`Cleanup efficiency: ${(Math.abs(cleanupDiff) / creationDiff * 100).toFixed(1)}%`);
    });
  });

  describe('Edge Case Memory Usage', () => {
    bench('Empty string memory usage', async () => {
      const before = monitor.takeSnapshot();
      
      for (let i = 0; i < 1000; i++) {
        await detector.maskPII('', baseOptions);
      }
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      console.log(`1000 empty string detections memory diff: ${diff} bytes`);
    });

    bench('Very large string memory usage', async () => {
      const before = monitor.takeSnapshot();
      
      const hugeText = 'Contact support@example.com '.repeat(10000);
      await detector.maskPII(hugeText, baseOptions);
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      console.log(`Huge text (${hugeText.length} chars) memory diff: ${diff} bytes`);
      console.log(`Memory per character: ${(diff / hugeText.length).toFixed(4)} bytes`);
    });

    bench('Unicode text memory usage', async () => {
      const before = monitor.takeSnapshot();
      
      const unicodeText = 'Контакт: тест@пример.рф, 电子邮件: 用户@示例.中国, البريد: مستخدم@مثال.عربي';
      await detector.maskPII(unicodeText, baseOptions);
      
      const after = monitor.takeSnapshot();
      const diff = monitor.getDiff(before, after);
      
      console.log(`Unicode text memory diff: ${diff} bytes`);
    });
  });
});