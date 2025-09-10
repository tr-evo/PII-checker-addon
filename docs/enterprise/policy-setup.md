# Enterprise Policy Setup

This guide walks through configuring Chrome Enterprise managed storage policies for the PII Checker Extension.

## Prerequisites

- Chrome Enterprise license
- Google Admin Console access
- Domain administrator privileges
- Extension deployed to Chrome Web Store or Enterprise store

## Step 1: Access Chrome Enterprise Policies

1. Sign in to the [Google Admin Console](https://admin.google.com)
2. Navigate to **Devices** → **Chrome** → **Apps & extensions**
3. Select your organizational unit
4. Click **Manage** next to the PII Checker Extension

## Step 2: Configure Managed Storage

### Basic Configuration

For a simple deployment with moderate security:

```json
{
  "locked": false,
  "enabledSites": [
    "chat.openai.com",
    "claude.ai", 
    "bard.google.com"
  ],
  "piiToggles": {
    "EMAIL": true,
    "PHONE": true,
    "IBAN": true,
    "BIC": true,
    "CARD": true,
    "SSN": true,
    "TAX_ID": true
  },
  "thresholds": {
    "EMAIL": 0.9,
    "PHONE": 0.85,
    "CARD": 0.95,
    "SSN": 0.95
  },
  "timeoutMs": 5000
}
```

### High-Security Configuration

For organizations requiring strict compliance:

```json
{
  "locked": true,
  "enabledSites": [
    "approved-ai-platform.company.com"
  ],
  "piiToggles": {
    "EMAIL": true,
    "PHONE": true,
    "IBAN": true,
    "BIC": true,
    "CARD": true,
    "NAME": true,
    "ADDRESS": true,
    "POSTAL_CODE": true,
    "SSN": true,
    "TAX_ID": true,
    "DATE_OF_BIRTH": true
  },
  "thresholds": {
    "EMAIL": 0.99,
    "PHONE": 0.99,
    "CARD": 0.99,
    "SSN": 0.99,
    "NAME": 0.9,
    "ADDRESS": 0.9
  },
  "timeoutMs": 3000,
  "features": {
    "nerEnabled": true,
    "regexEnabled": true,
    "denyListEnabled": true,
    "loggingForced": true,
    "exportDisabled": true
  },
  "dataRetention": {
    "maxRetentionDays": 90,
    "forceRetention": true,
    "autoCleanup": true
  },
  "compliance": {
    "auditMode": true,
    "mandatoryLogging": true,
    "requiredPiiTypes": ["EMAIL", "PHONE", "CARD", "SSN"],
    "prohibitedSites": ["public-ai.example.com"]
  },
  "uiRestrictions": {
    "hideAdvancedSettings": true,
    "disablePresetChanges": true
  }
}
```

## Step 3: Test Policy Deployment

1. Deploy to a test organizational unit first
2. Install the extension on a test Chrome browser
3. Verify that policies are applied by checking:
   - Extension settings show locked fields with 🔒 icons
   - Enterprise notice appears at the top of settings
   - Restricted features are disabled
   - Site restrictions are enforced

## Step 4: Monitor Policy Application

### Verify Policy Loading

The extension logs policy loading in the console:

```
[Managed Storage] Managed policy loaded: { locked: true, policyKeys: [...] }
```

### Check Policy Status

In the extension's settings UI:
- Look for the enterprise notice banner
- Verify locked settings have lock icons
- Test that restricted actions show error messages

## Policy Fields Reference

### Core Settings

| Field | Type | Description |
|-------|------|-------------|
| `locked` | boolean | Locks all extension settings |
| `enabledSites` | array | Whitelist of allowed domains |
| `disabledSites` | array | Blacklist of prohibited domains |

### PII Configuration

| Field | Type | Description |
|-------|------|-------------|
| `piiToggles` | object | Enable/disable specific PII types |
| `thresholds` | object | Confidence thresholds (0.0-1.0) |
| `timeoutMs` | number | Processing timeout (1000-60000ms) |

### Features Control

| Field | Type | Description |
|-------|------|-------------|
| `features.nerEnabled` | boolean | Enable ML-based NER detection |
| `features.regexEnabled` | boolean | Enable regex pattern matching |
| `features.loggingForced` | boolean | Force logging to be enabled |
| `features.exportDisabled` | boolean | Disable data export |

### Compliance Settings

| Field | Type | Description |
|-------|------|-------------|
| `compliance.auditMode` | boolean | Enhanced audit logging |
| `compliance.mandatoryLogging` | boolean | Require logging always on |
| `compliance.requiredPiiTypes` | array | PII types that must be enabled |
| `compliance.prohibitedSites` | array | Sites where extension is blocked |

### UI Restrictions

| Field | Type | Description |
|-------|------|-------------|
| `uiRestrictions.hideAdvancedSettings` | boolean | Hide advanced options |
| `uiRestrictions.disablePresetChanges` | boolean | Prevent preset switching |
| `uiRestrictions.requireAdminPassword` | boolean | Require password for changes |

## Best Practices

1. **Start Small**: Begin with unlocked policies and gradually increase restrictions
2. **Test Thoroughly**: Always test policies on a small group before organization-wide deployment
3. **Document Changes**: Keep records of policy changes for audit purposes
4. **Monitor Usage**: Regularly review extension usage and compliance reports
5. **User Communication**: Inform users about policy changes and restrictions

## Troubleshooting

### Policy Not Applied

- Check organizational unit assignment
- Verify Chrome is enrolled in enterprise management
- Confirm extension has proper permissions
- Review Chrome policy application via `chrome://policy`

### Settings Still Editable

- Ensure `locked: true` is set for global lock
- Verify specific field locks are configured
- Check for policy syntax errors in JSON
- Confirm policy propagation (can take up to 24 hours)

### Extension Not Loading

- Verify extension ID matches deployed extension
- Check Chrome version compatibility
- Confirm network access to policy servers
- Review Chrome enterprise enrollment status