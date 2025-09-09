import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';

const manifest = {
  manifest_version: 3,
  name: 'PII Checker',
  version: '0.1.0',
  description: 'On-device PII masking and upload tracking for LLM interfaces',
  permissions: ['storage', 'scripting', 'offscreen'],
  host_permissions: [
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*',
  ],
  content_scripts: [
    {
      matches: [
        'https://chat.openai.com/*',
        'https://chatgpt.com/*',
        'https://claude.ai/*',
      ],
      js: ['extension/content/main.ts'],
      all_frames: true,
    },
  ],
  background: {
    service_worker: 'extension/background/service-worker.ts',
  },
  action: {
    default_popup: 'extension/ui/popup.html',
  },
  options_page: 'extension/ui/options.html',
  web_accessible_resources: [
    {
      resources: ['workers/*'],
      matches: ['<all_urls>'],
    },
  ],
};

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@extension': resolve(__dirname, 'extension'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'extension/ui/popup.html'),
        options: resolve(__dirname, 'extension/ui/options.html'),
        'workers/pii-worker': resolve(__dirname, 'extension/workers/pii-worker.ts'),
      },
    },
  },
});
