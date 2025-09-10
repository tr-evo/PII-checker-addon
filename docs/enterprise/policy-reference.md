# Enterprise Policy Reference

Complete reference for all Chrome Enterprise managed storage policies supported by the PII Checker Extension.

## Policy Schema Overview

The extension uses JSON Schema validation to ensure policy correctness. All policies are optional and have sensible defaults.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "title": "PII Checker Extension - Enterprise Policy Schema"
}
```

## Global Settings

### locked
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Master lock that prevents users from modifying any extension settings
- **Impact**: When `true`, all settings become read-only regardless of other policy settings

```json
{
  "locked": true
}
```

## Site Management

### enabledSites
- **Type**: `array<string>`
- **Default**: `[]` (all sites allowed)
- **Description**: Whitelist of domains where the extension is allowed to operate
- **Pattern**: Each domain must match `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
- **Behavior**: Empty array means all sites are allowed

```json
{
  "enabledSites": [
    "chat.openai.com",
    "claude.ai",
    "bard.google.com"
  ]
}
```

### disabledSites  
- **Type**: `array<string>`
- **Default**: `[]`
- **Description**: Blacklist of domains where the extension is explicitly disabled
- **Pattern**: Each domain must match `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
- **Priority**: Takes precedence over `enabledSites`

```json
{
  "disabledSites": [
    "internal.company.com",
    "dev.staging.com"
  ]
}
```

## PII Detection Controls

### piiToggles
- **Type**: `object<PIIType, boolean>`
- **Description**: Configure which PII types should be detected and masked
- **Available Types**: `EMAIL`, `PHONE`, `IBAN`, `BIC`, `CARD`, `NAME`, `ADDRESS`, `POSTAL_CODE`, `URL`, `UUID`, `SSN`, `TAX_ID`, `DATE_OF_BIRTH`

```json
{
  "piiToggles": {
    "EMAIL": true,
    "PHONE": true,
    "IBAN": true,
    "BIC": true,
    "CARD": true,
    "NAME": false,
    "ADDRESS": true,
    "POSTAL_CODE": true,
    "URL": false,
    "UUID": false,
    "SSN": true,
    "TAX_ID": true,
    "DATE_OF_BIRTH": true
  }
}
```

### thresholds
- **Type**: `object<PIIType, number>`
- **Range**: `0.0` to `1.0`
- **Description**: Confidence thresholds for PII detection
- **Higher Values**: More selective (fewer false positives, more false negatives)
- **Lower Values**: More sensitive (more false positives, fewer false negatives)

```json
{
  "thresholds": {
    "EMAIL": 0.95,
    "PHONE": 0.90,
    "IBAN": 0.95,
    "BIC": 0.95,
    "CARD": 0.99,
    "NAME": 0.80,
    "ADDRESS": 0.75,
    "POSTAL_CODE": 0.90,
    "URL": 0.98,
    "UUID": 0.95,
    "SSN": 0.99,
    "TAX_ID": 0.95,
    "DATE_OF_BIRTH": 0.85
  }
}
```

## Performance Settings

### timeoutMs
- **Type**: `integer`
- **Range**: `1000` to `60000` (1-60 seconds)
- **Default**: `5000`
- **Description**: Maximum time to wait for PII detection before allowing submission
- **Impact**: Shorter timeouts may miss PII in large texts; longer timeouts may frustrate users

```json
{
  "timeoutMs": 3000
}
```

## Feature Controls

### features
- **Type**: `object`
- **Description**: Enable or disable specific extension features

#### nerEnabled
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable ML-based Named Entity Recognition for PII detection
- **Performance**: Disabling improves speed but reduces accuracy

#### regexEnabled
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable regex pattern matching for structured PII data
- **Coverage**: Handles emails, phone numbers, credit cards, etc.

#### denyListEnabled
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable exact pattern matching against known PII patterns
- **Security**: Provides additional protection layer

#### loggingForced
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Force activity logging to be enabled (users cannot disable)
- **Compliance**: Required for audit and compliance monitoring

#### exportDisabled
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Prevent users from exporting activity logs and settings
- **Security**: Prevents data exfiltration of sensitive logs

```json
{
  "features": {
    "nerEnabled": true,
    "regexEnabled": true,
    "denyListEnabled": true,
    "loggingForced": true,
    "exportDisabled": true
  }
}
```

## Data Retention Policies

### dataRetention
- **Type**: `object`
- **Description**: Configure how long data is kept

#### maxRetentionDays
- **Type**: `integer`
- **Range**: `1` to `365`
- **Default**: `30`
- **Description**: Maximum number of days to retain activity logs
- **Compliance**: Adjust based on regulatory requirements

#### forceRetention
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Prevent users from setting retention period below the maximum
- **Use Case**: Ensure minimum retention for compliance

#### autoCleanup
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Automatically delete old data past retention period
- **Performance**: Prevents storage bloat

```json
{
  "dataRetention": {
    "maxRetentionDays": 90,
    "forceRetention": true,
    "autoCleanup": true
  }
}
```

## UI Restrictions

### uiRestrictions
- **Type**: `object`
- **Description**: Control which UI elements users can access

#### hideAdvancedSettings
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Hide advanced configuration options from users
- **Impact**: Simplifies UI for non-technical users

#### disablePresetChanges
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Prevent users from switching between security presets
- **Enforcement**: Maintains consistent security posture

#### requireAdminPassword
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Require administrator password for settings changes
- **Note**: Not implemented in current version

```json
{
  "uiRestrictions": {
    "hideAdvancedSettings": true,
    "disablePresetChanges": true,
    "requireAdminPassword": false
  }
}
```

## Compliance Settings

### compliance
- **Type**: `object`
- **Description**: Regulatory and compliance requirements

#### auditMode
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable enhanced logging for compliance auditing
- **Data**: Includes additional metadata and user context

#### requiredPiiTypes
- **Type**: `array<PIIType>`
- **Description**: PII types that must always be enabled (cannot be disabled by users)
- **Enforcement**: Overrides user preferences and other policies
- **Values**: Same as `piiToggles` keys

#### prohibitedSites
- **Type**: `array<string>`
- **Description**: Sites where the extension must never operate
- **Priority**: Overrides both `enabledSites` and `disabledSites`
- **Pattern**: Same as other site arrays

#### mandatoryLogging
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Require activity logging to be enabled at all times
- **Difference**: Stricter than `loggingForced` - prevents any log management

```json
{
  "compliance": {
    "auditMode": true,
    "requiredPiiTypes": ["EMAIL", "PHONE", "CARD", "SSN"],
    "prohibitedSites": ["competitor.com", "public-forum.org"],
    "mandatoryLogging": true
  }
}
```

## Policy Precedence

The extension follows this precedence order:

1. **Chrome Managed Storage** (highest priority)
2. **Chrome Sync Storage** (user settings across devices)
3. **Chrome Local Storage** (device-specific settings)

### Field-level Precedence

Within managed storage, specific fields have precedence:

1. `compliance.prohibitedSites` > `disabledSites` > `enabledSites`
2. `compliance.requiredPiiTypes` > `piiToggles`
3. `compliance.mandatoryLogging` > `features.loggingForced`
4. `locked: true` > all other field-specific locks

## Validation Rules

### Domain Patterns
All site arrays must contain valid domains:
- Must include at least one dot
- Must end with valid TLD (2+ characters)
- May include subdomains
- No protocol prefixes (http/https)
- No paths or query parameters

### Threshold Ranges
All threshold values must be between 0.0 and 1.0:
- `0.0`: Accept everything (not recommended)
- `0.5`: Balanced detection
- `0.9`: High confidence only
- `1.0`: Perfect matches only (not recommended)

### Timeout Limits
Processing timeout must be reasonable:
- Minimum: 1000ms (1 second)
- Maximum: 60000ms (60 seconds)  
- Recommended: 3000-8000ms

## Example Configurations

### Development Environment
```json
{
  "locked": false,
  "enabledSites": ["localhost", "dev.company.com"],
  "piiToggles": {
    "EMAIL": true,
    "PHONE": false,
    "NAME": false
  },
  "timeoutMs": 10000,
  "features": {
    "loggingForced": false,
    "exportDisabled": false
  }
}
```

### Production Environment  
```json
{
  "locked": true,
  "enabledSites": ["approved-ai.company.com"],
  "piiToggles": {
    "EMAIL": true,
    "PHONE": true,
    "CARD": true,
    "SSN": true,
    "NAME": true,
    "ADDRESS": true
  },
  "thresholds": {
    "EMAIL": 0.99,
    "PHONE": 0.95,
    "CARD": 0.99,
    "SSN": 0.99
  },
  "timeoutMs": 5000,
  "features": {
    "loggingForced": true,
    "exportDisabled": true
  },
  "compliance": {
    "auditMode": true,
    "mandatoryLogging": true,
    "requiredPiiTypes": ["EMAIL", "PHONE", "CARD", "SSN"]
  }
}
```

### Financial Services
```json
{
  "locked": true,
  "enabledSites": [],
  "disabledSites": ["*"],
  "compliance": {
    "prohibitedSites": ["*"],
    "auditMode": true,
    "mandatoryLogging": true
  },
  "features": {
    "exportDisabled": true
  },
  "dataRetention": {
    "maxRetentionDays": 365,
    "forceRetention": true
  }
}
```