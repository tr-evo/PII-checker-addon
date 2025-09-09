# Privacy Policy

**Effective Date**: December 2024  
**Last Updated**: December 2024

## Introduction

The PII Checker Chrome Extension ("Extension", "we", "our") is designed to protect your privacy by detecting and masking personally identifiable information (PII) before you submit it to LLM web interfaces. This Privacy Policy explains how we handle information in connection with your use of our Extension.

## Our Privacy Commitment

**We do not collect, transmit, or store your personal information.** All PII detection and processing happens entirely on your device, with zero remote data transmission.

## Information We Do NOT Collect

### Personal Data
- **Original Text Content**: We never store your original, unmasked text
- **Personally Identifiable Information**: Detected PII is immediately masked and never stored in plaintext
- **Browsing History**: We only operate on allowlisted LLM websites  
- **User Accounts**: No authentication, registration, or user identification
- **Location Data**: No access to or collection of location information
- **Device Information**: No device fingerprinting or hardware data collection

### Usage Data
- **Analytics**: No usage tracking, metrics, or behavioral analytics
- **Telemetry**: No performance data or error reporting to external services
- **A/B Testing**: No experimentation or user segmentation
- **Marketing Data**: No advertising or promotional data collection

## Information We Do Collect (Locally Only)

All data listed below is stored exclusively on your device and never transmitted externally.

### Settings & Configuration
- **User Preferences**: Your chosen PII types to detect/mask
- **Confidence Thresholds**: Your sensitivity settings for detection
- **Site-Specific Overrides**: Custom settings per website
- **Preset Configurations**: Your selected protection level (Strict/Balanced/Loose)

**Purpose**: To customize the extension's behavior according to your preferences  
**Storage**: Chrome local storage, encrypted and tied to your browser profile  
**Retention**: Until you change settings, disable the extension, or uninstall

### Activity Logs (Optional)
- **Timestamps**: When masking operations occurred
- **Site Information**: Which website the masking happened on (e.g., "chat.openai.com")
- **Masked Text**: Only the redacted version with PII replaced by placeholders
- **Detection Metadata**: Number and types of PII detected (no actual content)

**Purpose**: To provide you with an audit trail of the extension's activities  
**Storage**: IndexedDB in your browser, with user-configurable retention periods  
**Retention**: Default 30 days, configurable from 1 day to 1 year, or disabled entirely

### Technical Data (Device-Only)
- **Extension Settings**: Configuration state and version information
- **Model Cache**: Downloaded ML models for offline PII detection
- **Error Logs**: Local debugging information (never transmitted)

**Purpose**: To ensure proper extension functionality  
**Storage**: Browser's extension storage areas  
**Retention**: Until extension update, cache clear, or uninstall

## How We Protect Your Privacy

### On-Device Processing
- **Local ML Models**: Uses `transformers.js` for client-side AI processing
- **No Cloud APIs**: No external services involved in PII detection
- **WebWorker Isolation**: Processing occurs in isolated browser contexts
- **Offline Capability**: Extension works without internet connection

### Data Minimization
- **Hash-Only Storage**: Original content is cryptographically hashed, never stored as plaintext
- **Immediate Masking**: PII is replaced with placeholders (`[[EMAIL]]`, `[[PHONE]]`) instantly
- **Selective Logging**: Only necessary metadata is retained, with granular user control
- **Automatic Expiration**: Data automatically purges according to user-set retention policies

### Technical Safeguards
- **Content Security Policy**: Prevents unauthorized script execution
- **Minimal Permissions**: Only requests essential Chrome API access
- **Input Sanitization**: All user inputs are validated and sanitized
- **Secure Storage**: Uses browser's encrypted storage mechanisms

## Your Privacy Rights & Controls

### Access & Control
- **Settings Dashboard**: Full control over what PII types are detected
- **Activity Viewer**: Review all extension activities and masked content  
- **Export Functionality**: Download your settings and activity logs in JSON/CSV format
- **Granular Controls**: Enable/disable specific PII types individually

### Data Management
- **Retention Settings**: Configure how long activity logs are kept (1 day - 1 year)
- **Selective Deletion**: Delete specific entries or entire activity history
- **Complete Erasure**: Uninstalling the extension removes all associated data
- **Cache Management**: Clear downloaded models and temporary data

### Site-Specific Privacy
- **Allowlist Control**: Extension only operates on explicitly allowed LLM websites
- **Per-Site Settings**: Different privacy levels for different websites
- **Quick Disable**: Temporarily disable extension for specific sites
- **Override Permissions**: Grant exceptions for trusted internal tools

## GDPR Compliance (EU Users)

### Legal Basis for Processing
- **Legitimate Interest**: Protection of personal data aligns with user's interests
- **Consent**: Explicit user installation and configuration of the extension
- **Performance**: Necessary for the extension's core PII protection functionality

### Your GDPR Rights
| Right | How to Exercise |
|-------|-----------------|
| **Access** | Use the export feature in extension settings |
| **Rectification** | Modify settings through the options page |
| **Erasure ("Right to be Forgotten")** | Clear data via settings or uninstall extension |
| **Data Portability** | Export data in machine-readable JSON format |
| **Restriction of Processing** | Disable specific PII types or pause extension |
| **Objection** | Disable or uninstall the extension at any time |

### Data Processing Record
- **Controller**: End user (you) - we don't have access to your data
- **Purpose**: PII detection and masking for privacy protection  
- **Legal Basis**: Article 6(1)(f) - legitimate interest
- **Categories**: Configuration settings, activity metadata only
- **Recipients**: None (processing is entirely local)
- **Third Country Transfers**: None
- **Retention Period**: User-configurable (default 30 days for logs)

## Children's Privacy

The Extension does not knowingly collect information from children under 13 (or applicable minimum age). If you are under the minimum age, please do not use this Extension without parental supervision and consent.

## Enterprise & Managed Deployments

For organizations deploying this extension:

### Administrator Controls
- **Policy Management**: Centralized configuration via Chrome Enterprise policies
- **Settings Lockdown**: Prevent user modification of security-critical settings
- **Audit Capabilities**: Enhanced logging for compliance requirements
- **Domain Controls**: Restrict or expand allowed websites

### Compliance Features
- **Data Residency**: All processing remains on user devices
- **Audit Trails**: Comprehensive activity logging (locally stored)
- **Retention Policies**: Configurable data lifecycle management
- **Export Capabilities**: Compliance-ready data export formats

## Third-Party Services & Dependencies

### What We Use
- **Transformers.js**: Open-source library for client-side AI processing
- **Chrome APIs**: Browser's built-in storage and scripting capabilities
- **No External Services**: No analytics, crash reporting, or cloud services

### Supply Chain Security
- **Dependency Scanning**: Regular security audits of all dependencies
- **Version Pinning**: Specific, tested versions of all libraries
- **License Compliance**: All dependencies use privacy-compatible licenses
- **Security Updates**: Prompt updates for any security-related patches

## Changes to This Privacy Policy

### Notification of Changes
- **Material Changes**: We will notify users through extension update mechanisms
- **Version History**: All policy versions are maintained and accessible
- **Effective Dates**: Clear indication of when changes take effect
- **User Choice**: Significant changes may require re-acceptance

### Types of Changes
- **Clarifications**: Minor language improvements or clarifications
- **Feature Updates**: Privacy implications of new extension features
- **Legal Updates**: Changes due to regulatory requirements
- **Security Enhancements**: Updates to privacy protection mechanisms

## International Privacy Laws

### Regional Compliance
- **GDPR** (EU/EEA): Full compliance with European data protection regulations
- **CCPA** (California): Adherence to California Consumer Privacy Act requirements  
- **PIPEDA** (Canada): Compliance with Personal Information Protection laws
- **LGPD** (Brazil): Alignment with Lei Geral de Proteção de Dados

### Cross-Border Considerations
Since all processing is local, there are no cross-border data transfers or jurisdictional complications.

## Technical Privacy Details

### Cryptographic Practices
- **Hashing Algorithm**: SHA-256 for irreversible content fingerprinting
- **Storage Encryption**: Leverages browser's built-in encryption
- **Secure Random**: Cryptographically secure random number generation
- **Key Management**: No persistent keys (stateless operation)

### Network Behavior
- **Zero External Requests**: Extension makes no outbound network calls for user data
- **Model Downloads**: Only during initial installation/updates, never user content
- **Offline Operation**: Full functionality without internet connectivity
- **Certificate Validation**: Extension marketplace handles integrity verification

## Contact & Support

### Privacy Questions
For questions about this Privacy Policy or our privacy practices:

- **GitHub Issues**: [Create an issue](../../issues) for general questions
- **Security Concerns**: See our [Security Policy](./SECURITY.md)
- **Data Protection Officer**: [Contact information if applicable]

### Feedback & Suggestions
We welcome feedback on our privacy practices and suggestions for improvement through our GitHub repository.

---

## Summary

**In Plain English**: This extension protects your privacy by detecting personally identifiable information in text before you send it to AI chatbots. Everything happens on your computer - we never see, store, or transmit your data. You control all settings and can delete everything at any time.

**Key Points**:
- ✅ **No data leaves your device** - ever
- ✅ **No user accounts** or tracking  
- ✅ **You control all settings** and data retention
- ✅ **Open source** and auditable
- ✅ **GDPR compliant** with full user rights
- ✅ **Works offline** after installation

---

**Document Version**: 1.0  
**Last Review**: December 2024  
**Next Review**: June 2025