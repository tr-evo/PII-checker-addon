# PII Checker Chrome Extension

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Chrome](https://img.shields.io/badge/chrome-88+-yellow)
![Manifest V3](https://img.shields.io/badge/manifest-v3-red)

A Chrome Manifest V3 extension that performs on-device PII masking and upload tracking for LLM web interfaces. Protect your personally identifiable information when using AI chat platforms like ChatGPT, Claude, and Bard.

## 🚀 Features

### Core PII Protection
- **🔍 Multi-Method Detection**: Regex patterns, ML-based NER (transformers.js), and deny-list matching
- **🛡️ 13 PII Types Supported**: Email, phone, credit cards, SSN, names, addresses, IBANs, and more
- **⚡ Real-time Processing**: Sub-2 second detection with WebWorker support for non-blocking performance
- **🎯 Confidence Thresholds**: Adjustable sensitivity (0.5-1.0) for each PII type to minimize false positives

### Smart Integration
- **🌐 Universal LLM Support**: ChatGPT, Claude, Bard, and extensible to other AI platforms
- **🔄 Seamless Text Replacement**: Automatically replaces detected PII with masked versions
- **👀 User Control**: Review and approve masked content before submission
- **📤 Upload Tracking**: Comprehensive file upload monitoring and logging

### Enterprise Ready
- **🏢 Chrome Enterprise Integration**: Full support for `chrome.storage.managed` policies
- **🔒 Granular Locking**: Lock specific settings while allowing others to be user-configurable
- **📊 Compliance Features**: Audit mode, mandatory logging, data retention policies
- **📋 Site Management**: Whitelist/blacklist domains, enforce organizational policies

### Privacy & Security
- **🖥️ On-Device Processing**: No data sent to external servers, everything runs locally
- **🔐 Secure Storage**: Encrypted settings and logs using Chrome's secure storage APIs
- **📜 Audit Trails**: Comprehensive logging for compliance and security monitoring
- **🛡️ GDPR/HIPAA Ready**: Privacy-first design with configurable data retention

## 📦 Installation

### Option 1: Chrome Web Store (Recommended)
*Coming soon - extension is being prepared for Chrome Web Store submission*

### Option 2: Manual Installation (Sideloading)

1. **Download the Extension**
   ```bash
   # Download the latest release
   wget https://github.com/your-org/pii-checker-addon/releases/latest/download/pii-checker-extension-v1.0.0.zip
   
   # Or clone and build from source
   git clone https://github.com/your-org/pii-checker-addon.git
   cd pii-checker-addon
   npm install
   npm run build
   ```

2. **Install in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist/` folder (or unzipped extension folder)

3. **Verify Installation**
   - Look for the 🛡️ PII Checker icon in your Chrome toolbar
   - Visit [ChatGPT](https://chat.openai.com) and test with sample PII text
   - Check settings by right-clicking the icon and selecting "Options"

### Option 3: Enterprise Deployment

For organizations using Chrome Enterprise management:

1. **Configure Policy** (IT Administrators)
   - See [Enterprise Deployment Guide](./docs/enterprise/deployment.md)
   - Configure policies via Google Admin Console
   - Use the provided [policy schema](./docs/enterprise/policy-schema.json)

2. **Deploy Extension**
   ```json
   {
     "ExtensionInstallForcelist": [
       "your-extension-id;https://clients2.google.com/service/update2/crx"
     ]
   }
   ```

## 🛠️ Configuration

### Quick Setup
1. Click the extension icon to open settings
2. Choose a security preset:
   - **Strict**: Maximum protection, all PII types enabled
   - **Balanced**: Good security with minimal false positives (recommended)
   - **Loose**: Minimal protection, only high-confidence detections
   - **Custom**: Fine-tune individual PII types and confidence levels

### Advanced Configuration
- **PII Types**: Enable/disable specific detection types
- **Confidence Thresholds**: Adjust sensitivity per PII type (50-100%)
- **Site Management**: Configure per-website settings
- **Timeout Settings**: Control processing timeouts and fallback actions
- **Logging**: Configure activity logging and retention

### Enterprise Configuration
Administrators can lock settings and enforce policies:
```json
{
  "locked": true,
  "enabledSites": ["chat.openai.com", "claude.ai"],
  "piiToggles": {
    "EMAIL": true,
    "PHONE": true,
    "CARD": true,
    "SSN": true
  },
  "compliance": {
    "auditMode": true,
    "mandatoryLogging": true
  }
}
```

## 🎯 Usage

### Basic Usage
1. Navigate to any supported AI platform (ChatGPT, Claude, etc.)
2. Type your message normally, including any PII
3. When you press Enter or click Send:
   - Extension detects PII in your text
   - Shows preview with masked content
   - Allows you to approve or modify before sending

### Example
**Your input:**
```
My email is john.doe@company.com and my phone is (555) 123-4567. 
Please help me with my account.
```

**Masked output:**
```
My email is ██████@██████ and my phone is ███████. 
Please help me with my account.
```

### Supported Platforms
- ✅ [ChatGPT](https://chat.openai.com) / [ChatGPT Plus](https://chatgpt.com)
- ✅ [Claude](https://claude.ai)
- ✅ [Google Bard](https://bard.google.com)
- 🔄 Additional platforms can be added via settings

## 📊 PII Types Detected

| Type | Examples | Default Confidence |
|------|----------|-------------------|
| **Email** | john@example.com | 90% |
| **Phone** | (555) 123-4567 | 85% |
| **Credit Card** | 4111-1111-1111-1111 | 95% |
| **SSN** | 123-45-6789 | 95% |
| **Names** | John Smith | 70% |
| **Addresses** | 123 Main St, City | 75% |
| **IBAN** | DE89370400440532013000 | 90% |
| **BIC/SWIFT** | DEUTDEFF | 90% |
| **Postal Codes** | 12345 | 85% |
| **URLs** | https://private-site.com | 95% |
| **UUIDs** | 123e4567-e89b-12d3 | 95% |
| **Tax IDs** | 12-3456789 | 85% |
| **Dates of Birth** | 01/01/1990 | 80% |

## 📈 Performance

- **Detection Speed**: < 2 seconds for typical text (< 1000 characters)
- **Memory Usage**: < 50MB including ML models
- **CPU Impact**: < 5% during active detection
- **Storage**: < 10MB for typical usage patterns
- **Network Impact**: Zero external requests for core functionality

## 🔧 Development

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Chrome 88+ for testing

### Setup
```bash
# Clone repository
git clone https://github.com/your-org/pii-checker-addon.git
cd pii-checker-addon

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run benchmarks
npm run bench
```

### Project Structure
```
src/
├── pii/              # PII detection and masking
├── settings/         # Settings management and enterprise policies
├── logging/          # Activity logging and export
├── content/          # Content script injection
└── background/       # Service worker

extension/
├── manifest.json     # Extension manifest
├── ui/              # Options and popup UI
└── workers/         # Web workers for ML processing

docs/
├── enterprise/      # Enterprise deployment guides
└── security/        # Security and privacy documentation
```

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Submit a pull request

## 🔒 Privacy & Security

### Data Handling
- **No External Transmission**: All PII detection happens locally
- **Metadata Only**: Logs contain only detection metadata, never actual PII content
- **Secure Storage**: Uses Chrome's encrypted storage APIs
- **User Control**: Users can clear logs and export data at any time

### Security Measures
- **Content Security Policy**: Strict CSP prevents code injection
- **Minimal Permissions**: Only requests necessary Chrome permissions
- **Audit Trail**: Comprehensive logging for security monitoring
- **Enterprise Controls**: IT administrators can enforce security policies

### Compliance
- **GDPR**: Data minimization, user consent, right to deletion
- **HIPAA**: PHI protection through local processing
- **SOX**: Audit trails for financial data interactions

## 📚 Documentation

### User Documentation
- [Installation Guide](./docs/installation.md)
- [User Manual](./docs/user-guide.md)
- [FAQ](./docs/faq.md)
- [Troubleshooting](./docs/troubleshooting.md)

### Enterprise Documentation
- [Enterprise Deployment](./docs/enterprise/deployment.md)
- [Policy Reference](./docs/enterprise/policy-reference.md)
- [Monitoring & Audit](./docs/enterprise/monitoring.md)
- [Security Guide](./docs/enterprise/security.md)

### Developer Documentation
- [Architecture Overview](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)

## 📋 System Requirements

### Minimum Requirements
- **Chrome**: Version 88+ (Manifest V3 support)
- **Memory**: 2GB RAM available
- **Storage**: 50MB free space
- **CPU**: Any modern processor (2015+)

### Recommended Requirements  
- **Chrome**: Version 100+
- **Memory**: 4GB RAM available
- **Storage**: 100MB free space
- **Network**: For initial model download (~20MB)

### Enterprise Requirements
- **Chrome Enterprise**: Licensed Chrome Enterprise environment
- **Admin Access**: Google Admin Console access for policy management
- **Network**: HTTPS access to policy distribution servers

## 🆘 Support

### Getting Help
- **Documentation**: Check our comprehensive [documentation](./docs/)
- **Issues**: Report bugs via [GitHub Issues](https://github.com/your-org/pii-checker-addon/issues)
- **Security**: Report security issues via [SECURITY.md](./SECURITY.md)
- **Enterprise**: Contact your IT administrator for enterprise support

### Common Issues
- **Extension Not Working**: Verify Chrome version (88+) and Manifest V3 support
- **High Memory Usage**: Disable NER detection or reduce enabled PII types
- **False Positives**: Adjust confidence thresholds or disable specific PII types
- **Performance Issues**: Increase processing timeout or use balanced preset

### Feature Requests
We welcome feature requests via GitHub Issues. Please include:
- Use case description
- Expected behavior
- Current workaround (if any)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- **Xenova/transformers.js**: For excellent on-device ML capabilities
- **Chrome Extensions Team**: For Manifest V3 and enterprise APIs
- **Community Contributors**: For testing, feedback, and contributions
- **Enterprise Beta Testers**: For validation in production environments

## 🔮 Roadmap

### Version 1.1 (Q2 2024)
- Additional AI platform support (Bing Chat, Perplexity)
- Custom PII pattern definitions
- Enhanced mobile Chrome support
- Performance optimizations

### Version 1.2 (Q3 2024)
- Multi-language PII detection
- Advanced masking strategies
- Team collaboration features
- Integration APIs for enterprise monitoring

### Version 2.0 (Q4 2024)
- Context-aware PII detection
- Machine learning personalization
- Advanced analytics dashboard
- Third-party integrations (SIEM, Microsoft 365, Google Workspace)

---

**Made with ❤️ for privacy-conscious AI users**

For the latest updates and releases, visit our [GitHub repository](https://github.com/your-org/pii-checker-addon).