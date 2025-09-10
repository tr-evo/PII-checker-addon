# Privacy Policy - PII Checker Extension

**Last Updated:** January 15, 2024  
**Effective Date:** January 15, 2024

## Overview

PII Checker ("we", "our", "the extension") is designed with privacy as our core principle. This privacy policy explains how our Chrome extension handles data and protects your privacy when using AI chat platforms.

## Our Privacy Commitment

**We do not collect, store, transmit, or have access to your personal data.**

PII Checker is built on a foundation of privacy-by-design principles:
- All processing happens locally on your device
- No data is transmitted to external servers
- No tracking or analytics are performed
- No user accounts or registration required

## Data Processing

### What We Process
The extension processes text content in AI chat interfaces to detect personally identifiable information (PII). This processing includes:

- Text typed into AI chat platforms (ChatGPT, Claude, Bard, etc.)
- Analysis of text patterns to identify potential PII
- Generation of masked versions of detected PII

### How We Process Data
- **Locally Only**: All text analysis happens on your device using on-device machine learning models
- **Real-Time**: Processing occurs in real-time as you type, with no data retention for analysis
- **User Control**: You review and approve all masked content before submission

### What We Don't Do
- ❌ Send your data to our servers
- ❌ Store your conversations or messages  
- ❌ Track your browsing activity
- ❌ Share data with third parties
- ❌ Use your data for advertising
- ❌ Create user profiles or analytics

## Local Data Storage

### Settings Storage
The extension stores your preferences locally using Chrome's secure storage APIs:
- PII detection preferences (which types to detect)
- Confidence threshold settings
- Site-specific configurations
- UI preferences

### Activity Logs (Optional)
If you enable activity logging:
- **Metadata Only**: Only detection events and timestamps are logged, never the actual PII content
- **Local Storage**: All logs are stored locally on your device using Chrome's IndexedDB
- **User Control**: You can view, export, or delete logs at any time
- **Automatic Cleanup**: Logs are automatically deleted based on your retention settings

### What's Never Stored
- ❌ The actual PII content that was detected
- ❌ Your conversations with AI platforms
- ❌ URLs or website content beyond basic site identifiers
- ❌ Any personally identifiable information

## Enterprise Deployments

### Managed Environments
In enterprise environments using Chrome Enterprise policies:
- IT administrators can configure extension settings through Chrome policies
- Policy settings are applied locally without data transmission
- Audit logging (if enabled) remains local to the user's device
- No data is transmitted to the organization's servers unless explicitly exported by users

### Compliance Features
- **Data Minimization**: Only necessary metadata is logged
- **User Consent**: Enterprise deployment implies organizational consent
- **Right to Delete**: Users can clear logs and data at any time
- **Transparency**: All processing is done locally and transparently

## Third-Party Services

### Machine Learning Models
The extension uses pre-trained models from Hugging Face (via transformers.js):
- **No Data Transmission**: Models run entirely offline on your device
- **No Telemetry**: No usage data is sent back to model providers
- **Static Models**: Models are bundled with the extension, no dynamic loading

### No Third-Party Analytics
We do not use:
- Google Analytics or similar services
- Error reporting services that transmit data
- A/B testing frameworks
- Social media tracking pixels
- Advertising networks

## Data Security

### Local Security Measures
- **Encrypted Storage**: Settings and logs use Chrome's encrypted storage APIs
- **Content Security Policy**: Strict CSP prevents code injection
- **Minimal Permissions**: Only requests necessary Chrome permissions
- **Secure Processing**: All PII detection happens in isolated contexts

### No Network Security Concerns
Since no data is transmitted externally:
- No risk of data interception during transmission
- No server-side data breaches possible
- No third-party data sharing vulnerabilities

## User Rights and Control

### Your Rights
- **Transparency**: View exactly what the extension detects and logs
- **Control**: Enable/disable any PII detection types
- **Access**: Export your settings and activity logs
- **Deletion**: Clear all extension data at any time
- **Modification**: Adjust detection sensitivity and preferences

### How to Exercise Your Rights
- **View Data**: Open extension settings → Activity Logs tab
- **Export Data**: Use the export function in settings
- **Delete Data**: Use "Clear All Logs" or uninstall the extension
- **Modify Settings**: Access via extension icon → Options

## Children's Privacy

The extension does not specifically target children under 13 and does not collect any data that would require additional protections under COPPA or similar regulations.

## International Data Transfers

Since all processing happens locally on your device, there are no international data transfers.

## Compliance

### GDPR (General Data Protection Regulation)
- **Article 25**: Data protection by design and by default
- **Article 5**: Data minimization and purpose limitation
- **Article 7**: No processing without consent (enterprise implies organizational consent)

### HIPAA (Health Insurance Portability and Accountability Act)
- **Technical Safeguards**: Local processing protects PHI
- **Workstation Use**: Extension runs on user's controlled workstation
- **Access Control**: Only user has access to their data

### CCPA (California Consumer Privacy Act)
- **No Data Sale**: No personal information is sold or shared
- **Right to Delete**: Users can delete all extension data
- **Right to Know**: This policy explains all data processing

## Updates to This Policy

We may update this privacy policy to reflect changes in:
- Extension functionality
- Legal requirements
- Industry best practices

### Notification of Changes
- **In-Extension Notice**: Major changes will be shown in the extension
- **Version Control**: Policy versions are tracked in our documentation
- **No Retroactive Changes**: Changes only apply to future use

## Contact Information

### Questions About This Policy
- **GitHub Issues**: https://github.com/your-org/pii-checker-addon/issues
- **Documentation**: See docs/ folder in the repository
- **Security Reports**: Follow SECURITY.md process

### Data Protection Officer (Enterprise)
For enterprise deployments, contact your organization's IT department or Data Protection Officer.

## Technical Implementation

### Privacy-by-Design Features
1. **Local Processing**: All PII detection uses on-device ML models
2. **No Network Calls**: Extension makes no external HTTP requests for core functionality
3. **Ephemeral Processing**: Text is analyzed in memory and immediately discarded
4. **User Approval**: All actions require explicit user consent
5. **Transparent Operation**: Users see exactly what is detected and how

### Open Source Transparency
The extension's source code is available for inspection, allowing:
- Independent security audits
- Verification of privacy claims
- Community contributions and improvements

## Legal Basis for Processing

### Individual Users
- **Consent**: By installing and using the extension
- **Legitimate Interest**: Protection of personal data privacy

### Enterprise Users  
- **Legitimate Interest**: Organizational data protection requirements
- **Contractual Necessity**: Employment or service agreements

## Retention Periods

### Settings Data
- Retained until extension is uninstalled or user clears data
- No automatic expiration (user controls retention)

### Activity Logs (if enabled)
- Default retention: 90 days
- User configurable: 1-365 days  
- Enterprise configurable: Per organizational policy

### No Long-term Retention
- No data is retained beyond user-configured periods
- No backup systems that extend retention
- Automatic cleanup prevents data accumulation

## Conclusion

PII Checker is designed to protect your privacy while using AI chat platforms. By processing everything locally and never transmitting data externally, we ensure your sensitive information remains secure and private.

If you have any questions about this privacy policy or the extension's data practices, please review our documentation or contact us through the channels listed above.

---

**This privacy policy is effective as of January 15, 2024, and applies to version 1.0.0 and later of the PII Checker Chrome extension.**