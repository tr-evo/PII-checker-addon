# PII Checker Extension - Enterprise Deployment Guide

This guide covers enterprise deployment, managed policies, and centralized configuration for the PII Checker Extension.

## Overview

The PII Checker Extension supports Chrome Enterprise managed storage for centralized policy configuration. IT administrators can control extension behavior, enforce security policies, and ensure compliance across their organization.

## Key Features

- **Centralized Policy Management**: Configure extension settings via Chrome Enterprise policies
- **Three-tier Storage Hierarchy**: Managed > Sync > Local settings priority
- **Field-level Locking**: Lock specific settings while allowing others to be user-configurable
- **Compliance Controls**: Enforce mandatory logging, disable data export, require specific PII types
- **Site Management**: Whitelist/blacklist specific domains
- **Audit Support**: Enhanced logging for compliance and security auditing

## Quick Start

1. [Setup Enterprise Policies](./policy-setup.md) - Configure Chrome Enterprise managed storage
2. [Deploy Extension](./deployment.md) - Install and configure across your organization
3. [Monitor & Audit](./monitoring.md) - Track usage and ensure compliance
4. [Troubleshoot](./troubleshooting.md) - Common issues and solutions

## Policy Configuration

### Basic Configuration

```json
{
  "locked": false,
  "enabledSites": ["chat.openai.com", "claude.ai"],
  "piiToggles": {
    "EMAIL": true,
    "PHONE": true,
    "CARD": true,
    "SSN": true
  },
  "timeoutMs": 5000
}
```

### Advanced Enterprise Configuration

```json
{
  "locked": true,
  "enabledSites": ["chat.openai.com", "claude.ai"],
  "compliance": {
    "auditMode": true,
    "mandatoryLogging": true,
    "requiredPiiTypes": ["EMAIL", "PHONE", "CARD", "SSN"]
  },
  "features": {
    "exportDisabled": true,
    "loggingForced": true
  },
  "dataRetention": {
    "maxRetentionDays": 90,
    "forceRetention": true,
    "autoCleanup": true
  }
}
```

## Documentation Structure

- **[Policy Setup](./policy-setup.md)** - How to configure Chrome Enterprise policies
- **[Deployment Guide](./deployment.md)** - Rolling out the extension organization-wide  
- **[Policy Reference](./policy-reference.md)** - Complete policy schema documentation
- **[Monitoring & Audit](./monitoring.md)** - Compliance and usage monitoring
- **[Security Considerations](./security.md)** - Security best practices and threat model
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## Support

For enterprise support, please contact your IT administrator or reference the [troubleshooting guide](./troubleshooting.md).

## Schema Validation

The extension uses JSON Schema validation to ensure policy correctness. See [`policy-schema.json`](./policy-schema.json) for the complete schema definition.