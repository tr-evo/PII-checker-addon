import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Only include benchmark files
    include: ['tests/benchmarks/**/*.bench.ts'],
    
    // Benchmark configuration
    benchmark: {
      include: ['tests/benchmarks/**/*.bench.ts'],
      exclude: ['tests/**/*.test.ts'],
      
      // Reporter configuration
      reporter: ['verbose', 'json'],
      outputFile: {
        json: './benchmark-results.json'
      }
    },
    
    // Environment setup
    environment: 'node',
    globals: true,
    
    // Timeout for long-running benchmarks
    testTimeout: 60000,
    hookTimeout: 30000,
    
    // Memory and resource limits
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Use single process for consistent memory measurements
      }
    },
    
    // Setup files
    setupFiles: ['tests/setup/benchmark-setup.ts']
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  },
  
  // Disable coverage for benchmarks
  coverage: {
    enabled: false
  }
});