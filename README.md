# PII Checker Chrome Extension

A Chrome Manifest V3 extension that performs on-device PII masking and upload tracking for LLM web interfaces.

## Features

- **On-Device PII Masking**: Automatically detects and masks personally identifiable information before sending to LLM services
- **Upload Tracking**: Monitors and logs file uploads with metadata
- **Privacy-First**: All processing happens locally, no remote calls
- **Enterprise Support**: Configurable via Chrome Enterprise policies
- **Multi-Site Support**: Works with ChatGPT, Claude, and other LLM interfaces

## Installation

1. Clone this repository
2. Run `pnpm install` to install dependencies  
3. Run `pnpm build` to build the extension
4. Load the `dist/` folder as an unpacked extension in Chrome Developer Mode

## Development

```bash
pnpm install
pnpm dev
```

## License

MIT - see LICENSE file for details
