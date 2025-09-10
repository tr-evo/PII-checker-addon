# Enterprise Deployment Guide

This guide covers deploying the PII Checker Extension across your organization using Chrome Enterprise management.

## Deployment Options

### Option 1: Chrome Web Store (Recommended)

Deploy the published extension from the Chrome Web Store for automatic updates and easier management.

1. **Find Extension ID**: Locate the extension in the Chrome Web Store and note the ID from the URL
2. **Configure in Admin Console**:
   - Navigate to **Devices** → **Chrome** → **Apps & extensions**
   - Click **Add Chrome app or extension**
   - Enter the extension ID
   - Configure installation policy

### Option 2: Private Chrome Web Store

For internal or custom builds:

1. **Package Extension**: Create a `.crx` file or upload to private store
2. **Deploy via Admin Console**: Configure private store access and deployment
3. **Manage Updates**: Handle version management internally

## Installation Policies

### Force Installation

Automatically install for all users:

```json
{
  "ExtensionInstallForcelist": [
    "your-extension-id;https://clients2.google.com/service/update2/crx"
  ]
}
```

### Allow Installation

Allow users to install optionally:

```json
{
  "ExtensionInstallWhitelist": [
    "your-extension-id"
  ]
}
```

### Prevent Removal

Prevent users from disabling or removing:

```json
{
  "ExtensionInstallBlacklist": ["*"],
  "ExtensionInstallWhitelist": ["your-extension-id"],
  "ExtensionInstallForcelist": [
    "your-extension-id;https://clients2.google.com/service/update2/crx"
  ]
}
```

## Deployment Phases

### Phase 1: Pilot Deployment (Week 1)

1. **Select Pilot Group**: 10-20 users from different departments
2. **Minimal Restrictions**: Set `locked: false` with basic PII protection
3. **Monitor Usage**: Track adoption and identify issues
4. **Gather Feedback**: Collect user experience feedback

**Pilot Policy Configuration**:
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
    "CARD": true,
    "SSN": true
  },
  "features": {
    "loggingForced": false,
    "exportDisabled": false
  }
}
```

### Phase 2: Department Rollout (Week 2-4)

1. **Expand to Departments**: Roll out to entire departments
2. **Increase Monitoring**: Enable audit logging
3. **Apply Site Restrictions**: Limit to approved AI platforms
4. **User Training**: Provide training materials and support

**Department Policy Configuration**:
```json
{
  "locked": false,
  "enabledSites": [
    "approved-ai-platform.company.com",
    "chat.openai.com",
    "claude.ai"
  ],
  "compliance": {
    "auditMode": true,
    "mandatoryLogging": true
  },
  "features": {
    "loggingForced": true,
    "exportDisabled": false
  }
}
```

### Phase 3: Organization-wide (Week 5+)

1. **Full Deployment**: Deploy to entire organization
2. **Lock Down Settings**: Apply final security policies
3. **Compliance Mode**: Enable strict audit and compliance features
4. **Ongoing Monitoring**: Establish regular review processes

**Production Policy Configuration**:
```json
{
  "locked": true,
  "enabledSites": [
    "approved-ai-platform.company.com"
  ],
  "compliance": {
    "auditMode": true,
    "mandatoryLogging": true,
    "requiredPiiTypes": ["EMAIL", "PHONE", "CARD", "SSN", "NAME"]
  },
  "features": {
    "loggingForced": true,
    "exportDisabled": true
  },
  "uiRestrictions": {
    "hideAdvancedSettings": true,
    "disablePresetChanges": true
  }
}
```

## Organizational Unit Structure

### Recommended OU Structure

```
Company Root
├── Executive (Minimal restrictions)
├── Engineering (Moderate restrictions, dev sites allowed)
├── Marketing (Standard restrictions)
├── HR (High restrictions, no export)
├── Finance (Maximum restrictions)
└── External Users (Locked down completely)
```

### Policy Inheritance

- Child OUs inherit parent policies
- More restrictive child policies override parent settings
- Use inheritance to reduce configuration complexity

## User Communication

### Pre-deployment Communication

**Email Template**:
```
Subject: New Privacy Protection Tool - PII Checker Extension

Dear Team,

We are deploying a new browser extension to help protect personally identifiable information (PII) when using AI chat platforms. 

What it does:
- Automatically detects PII in text before submission
- Masks sensitive information to protect privacy
- Works with ChatGPT, Claude, and other AI platforms
- Maintains local logs for compliance

What to expect:
- Extension will be automatically installed
- You may see prompts when PII is detected
- All processing happens locally on your device
- Settings may be managed by IT policy

For questions or support, contact IT helpdesk.

Best regards,
IT Security Team
```

### Training Materials

1. **Quick Start Guide**: Basic usage and features
2. **Video Tutorial**: 5-minute walkthrough
3. **FAQ Document**: Common questions and answers
4. **Troubleshooting Guide**: Common issues and solutions

## Monitoring and Compliance

### Deployment Metrics

Track these metrics during deployment:

- **Installation Rate**: Percentage of successful installations
- **User Adoption**: Active daily/weekly users
- **Policy Compliance**: Settings alignment with policies
- **Error Rates**: Installation and runtime errors
- **Support Tickets**: User issues and questions

### Compliance Monitoring

- **Audit Logs**: Review regular usage patterns
- **Policy Violations**: Monitor attempts to bypass restrictions
- **Data Export**: Track any data export activities
- **Site Usage**: Monitor which AI platforms are being used

## Troubleshooting Deployment Issues

### Common Installation Problems

| Issue | Cause | Solution |
|-------|-------|---------|
| Extension not installing | Chrome not managed | Verify enterprise enrollment |
| Settings not locked | Policy not applied | Check OU assignment |
| Wrong sites enabled | Incorrect policy | Review JSON configuration |
| Users can disable | Installation not forced | Set ExtensionInstallForcelist |

### Policy Propagation

- **Immediate**: Chrome restarts or policy refresh
- **Normal**: Up to 90 minutes for automatic refresh  
- **Delayed**: Up to 24 hours in some enterprise environments
- **Force Refresh**: Use `chrome://policy` → **Reload policies**

### Verification Steps

1. **Check Chrome Management**: Visit `chrome://management`
2. **Verify Policies**: Review `chrome://policy` for extension policies
3. **Test Extension**: Confirm functionality with test PII
4. **Check Audit Logs**: Verify logging is working if enabled

## Security Considerations

### Network Requirements

- Chrome policy servers (googleapis.com)
- Chrome Web Store access (if using public store)
- Internal policy distribution (if using private deployment)

### Firewall Rules

Allow outbound HTTPS traffic to:
- `*.googleapis.com` (Policy distribution)
- `clients2.google.com` (Extension updates)
- `chrome.google.com` (Chrome Web Store)

### Privacy Impact

- Extension processes all text locally
- No data sent to external servers (except logs if configured)
- Audit logs contain metadata only, not actual PII
- User privacy maintained while ensuring compliance

## Rollback Plan

If deployment issues occur:

1. **Immediate**: Remove from ExtensionInstallForcelist
2. **Partial**: Move problematic OUs to different policy
3. **Complete**: Disable extension via ExtensionInstallBlacklist
4. **Data**: Export any required audit logs before rollback

## Post-Deployment

### Regular Maintenance

- **Weekly**: Review deployment metrics and user feedback
- **Monthly**: Update policies based on usage patterns
- **Quarterly**: Conduct compliance audits and policy reviews
- **Annually**: Review and update security requirements

### Updates and Patches

- **Automatic**: Chrome Web Store updates are automatic
- **Testing**: Test major updates on pilot group first
- **Communication**: Notify users of significant feature changes
- **Monitoring**: Watch for issues after updates