import { vi } from 'vitest';

// Global benchmark setup
beforeAll(() => {
  // Disable console.log during benchmarks unless explicitly needed
  const originalLog = console.log;
  console.log = (...args) => {
    // Only log benchmark results and memory stats
    if (args.some(arg => 
      typeof arg === 'string' && (
        arg.includes('memory') || 
        arg.includes('Memory') ||
        arg.includes('benchmark') ||
        arg.includes('Benchmark')
      )
    )) {
      originalLog(...args);
    }
  };

  // Mock Chrome APIs for benchmarking
  global.chrome = {
    storage: {
      sync: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined)
      },
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined)
      }
    },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({}),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    }
  };

  // Set up performance monitoring
  if (typeof performance === 'undefined') {
    global.performance = {
      now: () => Date.now(),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn()
    } as any;
  }

  // Mock transformers.js for consistent benchmarking
  vi.mock('@xenova/transformers', () => ({
    pipeline: vi.fn(),
    AutoTokenizer: {
      from_pretrained: vi.fn()
    },
    AutoModelForTokenClassification: {
      from_pretrained: vi.fn()
    }
  }));
});

afterAll(() => {
  // Cleanup after benchmarks
  vi.restoreAllMocks();
});