# Security Policy

## Overview

The PII Checker Chrome Extension is designed with security and privacy as core principles. This document outlines our security model, threat assessment, and privacy guarantees.

## Core Security Principles

### 1. **Zero Remote Data Transmission**
- All PII detection and masking occurs entirely on-device
- No user data is ever transmitted to external servers
- No telemetry or analytics collection
- Extension works completely offline after initial installation

### 2. **Minimal Permissions Model** 
- Only requests essential Chrome permissions:
  - `storage`: For user settings and activity logs
  - `scripting`: For content script injection on specified sites
  - `offscreen`: For WebWorker-based ML processing
- Host permissions limited to specific LLM sites (ChatGPT, Claude, etc.)
- No broad `<all_urls>` permissions

### 3. **On-Device Processing**
- Uses `transformers.js` for client-side machine learning
- WebWorker isolation prevents blocking main UI thread
- No cloud-based APIs or external model endpoints

### 4. **Data Minimization**
- Original text is hashed before storage, never stored in plaintext
- Only masked versions are retained for user review
- Automatic data expiration and user-controlled deletion

## Threat Model

### Protected Against

| Threat | Mitigation |
|--------|------------|
| **Data Exfiltration** | Zero remote transmission + host permission restrictions |
| **Man-in-the-Middle Attacks** | No network requests for user data processing |
| **Server-Side Data Breaches** | No server-side data storage |
| **Cross-Site Scripting (XSS)** | Content Security Policy + input sanitization |
| **Malicious Websites** | Restricted to allowlisted LLM domains |
| **Data Persistence Attacks** | Encrypted local storage + user-controlled deletion |
| **Supply Chain Attacks** | Dependency scanning + minimal external dependencies |

### Limitations & Assumptions

| Assumption | Risk | Mitigation |
|------------|------|------------|
| Browser Security | Compromised browser could access extension data | Use browser's built-in security features |
| Local Device Security | Physical access could expose stored data | Encourage device encryption |
| Extension Marketplace | Malicious updates through Chrome Web Store | Code signing + reproducible builds |
| Dependencies | Vulnerabilities in `transformers.js` or other deps | Regular dependency updates + scanning |

## Privacy Guarantees

### What We Collect
- **Settings/Preferences**: User configuration choices (stored locally)
- **Activity Logs**: Timestamps and metadata about masking operations
- **Masked Text**: Only the redacted versions for user review

### What We Never Collect
- **Original Text Content**: Never stored in plaintext
- **Personally Identifiable Information**: Detected PII is immediately masked
- **Browsing History**: No tracking of non-LLM site activity  
- **Usage Analytics**: No metrics or telemetry collection
- **User Accounts**: No authentication or user identification

### Data Retention
- **Settings**: Persist until user deletion or extension uninstall
- **Activity Logs**: Configurable retention period (default: 30 days)
- **Cached Models**: Stored until extension update or manual cache clear
- **Automatic Cleanup**: Built-in data expiration and purging

## GDPR & Privacy Compliance

### Legal Basis
- **Legitimate Interest**: PII protection is in the user's legitimate interest
- **Consent**: User explicitly installs and configures the extension
- **Data Protection**: Prevents inadvertent PII disclosure

### User Rights
| Right | Implementation |
|-------|----------------|
| **Access** | Export functionality for all stored data |
| **Rectification** | Settings can be modified at any time |
| **Erasure** | Complete data deletion via settings or uninstall |
| **Portability** | JSON/CSV export of activity logs |
| **Restriction** | Granular PII type controls |
| **Object** | Extension can be disabled or uninstalled |

### Data Processing Records
- **Purpose**: PII detection and masking for user protection
- **Legal Basis**: Legitimate interest + user consent
- **Categories**: Configuration data, activity metadata
- **Recipients**: None (all processing is local)
- **Transfers**: None (no cross-border data movement)
- **Retention**: User-configurable with automatic expiration

## Security Implementation Details

### Content Security Policy
```javascript
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    "sandbox": "sandbox allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';"
  }
}
```

### Secure Storage
- Uses Chrome's `storage.sync` and `storage.local` APIs
- Sensitive data is hashed before storage using SHA-256
- Settings encryption available for enterprise deployments
- Automatic data validation and sanitization

### Input Validation
```typescript
// Example: Secure text processing
function sanitizeInput(text: string): string {
  // Remove potential script injections
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

function validateSettings(settings: any): PIISettings {
  // Type checking and validation
  return settingsSchema.parse(settings);
}
```

### WebWorker Isolation
- ML processing runs in isolated WebWorker context
- No access to DOM or sensitive browser APIs
- Structured message passing with input validation
- Automatic worker termination on completion

## Security Testing

### Automated Security Scans
- **Dependency Scanning**: Automated vulnerability detection
- **SAST**: Static Application Security Testing via ESLint security rules
- **License Compliance**: Automated license compatibility checking
- **Supply Chain**: Package integrity verification

### Manual Security Review
- **Code Review**: All changes undergo security-focused review
- **Penetration Testing**: Regular security assessments
- **Privacy Impact Assessment**: GDPR compliance verification
- **Threat Modeling**: Regular threat landscape updates

### Security Checklist
- [ ] No hardcoded secrets or credentials
- [ ] Input validation on all user inputs
- [ ] Secure random number generation where needed
- [ ] Protection against XSS and injection attacks
- [ ] Minimal permission requests
- [ ] Secure data storage and transmission
- [ ] Regular dependency updates
- [ ] Error handling that doesn't leak sensitive information

## Vulnerability Reporting

### Responsible Disclosure
If you discover a security vulnerability, please report it responsibly:

1. **Email**: security@[domain] (if available)
2. **GitHub**: Create a private security advisory
3. **Response Time**: We aim to respond within 48 hours
4. **Timeline**: Security fixes are prioritized and released ASAP

### What to Include
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested mitigation (if any)

### Bug Bounty
While we don't currently offer a formal bug bounty program, we greatly appreciate security research and will acknowledge contributors in our security hall of fame.

## Enterprise Security

### Managed Deployment
- Support for Chrome Enterprise policies
- Centralized configuration management
- Audit logging for compliance
- Settings lockdown capabilities

### Compliance Features
- GDPR-compliant data handling
- SOC 2 compatible logging
- HIPAA-consideration data processing
- ISO 27001 aligned security controls

## Security Updates

### Update Policy
- **Critical Security Issues**: Emergency releases within 24-48 hours
- **High Priority Issues**: Releases within 1 week
- **Medium/Low Issues**: Included in regular release cycle
- **Dependencies**: Monthly security update reviews

### Update Verification
- All releases are signed and verified
- Reproducible builds for transparency
- Changelog includes security-relevant changes
- Users notified of critical security updates

## Additional Resources

- [Privacy Policy](./PRIVACY.md)
- [Threat Model Documentation](./docs/threat-model.md)
- [Security Architecture](./docs/security-architecture.md)
- [Data Flow Diagrams](./docs/data-flows.md)

## Contact

For security-related questions or concerns:
- Security Team: security@[domain]
- General Issues: [GitHub Issues](../../issues)
- Private Disclosure: [GitHub Security Advisories](../../security/advisories)

---

**Last Updated**: December 2024  
**Next Review**: March 2025