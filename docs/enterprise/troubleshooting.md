# Enterprise Troubleshooting Guide

This guide covers common issues encountered during enterprise deployment and management of the PII Checker Extension.

## Quick Diagnostic Steps

1. **Check Chrome Management**: Visit `chrome://management` to verify enterprise enrollment
2. **Verify Policies**: Review `chrome://policy` for extension-specific policies  
3. **Test Extension**: Try detecting PII with test text
4. **Check Console**: Review browser console and extension logs
5. **Policy Propagation**: Force policy refresh via `chrome://policy`

## Common Issues

### Installation Problems

#### Extension Not Installing

**Symptoms:**
- Extension doesn't appear in Chrome
- Installation fails silently
- Users report extension is missing

**Possible Causes:**
1. Chrome not enrolled in enterprise management
2. Extension not in ExtensionInstallForcelist
3. Extension blocked by ExtensionInstallBlacklist
4. Network connectivity issues
5. Incorrect extension ID

**Solutions:**

1. **Verify Chrome Enrollment:**
   ```
   Visit chrome://management
   Should show "Your browser is managed by [Organization]"
   ```

2. **Check Extension Policies:**
   ```json
   // In Google Admin Console
   {
     "ExtensionInstallForcelist": [
       "your-extension-id;https://clients2.google.com/service/update2/crx"
     ]
   }
   ```

3. **Verify Extension ID:**
   - Check Chrome Web Store URL
   - Confirm ID in admin console matches

4. **Network Diagnostics:**
   ```bash
   # Test connectivity
   curl -I https://clients2.google.com/service/update2/crx
   nslookup chrome.google.com
   ```

#### Extension Installs But Doesn't Work

**Symptoms:**
- Extension appears but no PII detection
- Settings page doesn't load
- Console errors visible

**Diagnostics:**
1. Check extension permissions in `chrome://extensions`
2. Review console errors (F12 → Console)
3. Test on known working website
4. Verify content script injection

**Solutions:**
1. **Permission Issues:**
   ```json
   // Ensure required permissions in manifest
   {
     "permissions": ["storage", "activeTab", "scripting"],
     "host_permissions": ["<all_urls>"]
   }
   ```

2. **Content Security Policy:**
   ```json
   // May need CSP updates for some sites
   "content_security_policy": {
     "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
   }
   ```

### Policy Management Issues

#### Policies Not Applied

**Symptoms:**
- Settings remain editable when should be locked
- Enterprise notice doesn't appear
- Policy restrictions ignored

**Diagnostic Steps:**
1. Check `chrome://policy` for extension policies
2. Verify organizational unit assignment
3. Confirm policy JSON syntax
4. Test policy propagation timing

**Solutions:**

1. **Check Policy Propagation:**
   ```javascript
   // In extension console
   chrome.storage.managed.get(null, (result) => {
     console.log('Managed policies:', result);
   });
   ```

2. **Force Policy Refresh:**
   - Visit `chrome://policy`
   - Click "Reload policies"
   - Wait 5-10 minutes for application

3. **Verify OU Assignment:**
   - Check user's organizational unit in Admin Console
   - Ensure policy is applied to correct OU
   - Verify inheritance settings

4. **JSON Syntax Validation:**
   ```bash
   # Validate policy JSON
   echo 'your-policy-json' | jq .
   ```

#### Partial Policy Application  

**Symptoms:**
- Some settings locked, others not
- Inconsistent enforcement across users
- Policy seems to work intermittently

**Common Causes:**
1. Policy inheritance conflicts
2. Field-specific locks not configured
3. Chrome cache issues
4. Timing issues during startup

**Solutions:**

1. **Clear Policy Cache:**
   ```bash
   # Windows
   rd /s /q "%LocalAppData%\Google\Chrome\User Data\Policy"
   
   # macOS  
   rm -rf ~/Library/Application\ Support/Google/Chrome/Policy
   
   # Linux
   rm -rf ~/.config/google-chrome/Policy
   ```

2. **Verify Field Locks:**
   ```json
   // Check specific field locks in extension
   {
     "locked": true,  // Global lock
     "piiToggles": {  // Specific field locks
       "EMAIL": true
     }
   }
   ```

### Functionality Issues

#### PII Not Being Detected

**Symptoms:**  
- Extension active but no PII warnings
- Known PII passes through undetected
- Detection seems inconsistent

**Diagnostic Steps:**
1. Test with known PII patterns
2. Check confidence thresholds
3. Verify enabled PII types
4. Review processing timeout settings

**Test Cases:**
```javascript
// Test these PII patterns
const testCases = [
  "My email is john.doe@company.com",
  "Call me at (555) 123-4567", 
  "SSN: 123-45-6789",
  "Card: 4111 1111 1111 1111"
];
```

**Solutions:**

1. **Lower Confidence Thresholds:**
   ```json
   {
     "thresholds": {
       "EMAIL": 0.8,  // Lower = more sensitive
       "PHONE": 0.75,
       "CARD": 0.9
     }
   }
   ```

2. **Enable Detection Methods:**
   ```json
   {
     "features": {
       "nerEnabled": true,
       "regexEnabled": true,
       "denyListEnabled": true
     }
   }
   ```

3. **Increase Timeout:**
   ```json
   {
     "timeoutMs": 8000  // Allow more processing time
   }
   ```

#### Performance Issues

**Symptoms:**
- Slow response times
- Browser hanging during detection
- High CPU usage
- Memory consumption

**Performance Diagnostics:**
1. Monitor processing times in console
2. Check memory usage in Task Manager
3. Test with various text lengths
4. Review timeout frequency

**Optimization Solutions:**

1. **Adjust Processing Timeout:**
   ```json
   {
     "timeoutMs": 3000,  // Shorter timeout
     "timeout": {
       "onTimeoutAction": "allow"  // Don't block on timeout
     }
   }
   ```

2. **Optimize Detection Settings:**
   ```json
   {
     "features": {
       "nerEnabled": false,  // Disable heavy ML processing
       "regexEnabled": true,  // Keep lighter regex detection
       "denyListEnabled": true
     }
   }
   ```

3. **Reduce PII Types:**
   ```json
   {
     "piiToggles": {
       "EMAIL": true,
       "PHONE": true,
       "CARD": true,
       "NAME": false,     // Disable heavy detectors
       "ADDRESS": false
     }
   }
   ```

### User Experience Issues

#### Users Bypassing Extension

**Symptoms:**
- Users report disabling extension
- PII getting through despite extension
- Users finding workarounds

**Prevention Strategies:**

1. **Force Installation:**
   ```json
   {
     "ExtensionInstallForcelist": ["extension-id;update-url"],
     "ExtensionInstallBlacklist": ["*"],
     "ExtensionInstallWhitelist": ["extension-id"]
   }
   ```

2. **Lock Settings:**
   ```json
   {
     "locked": true,
     "compliance": {
       "mandatoryLogging": true
     }
   }
   ```

3. **Monitor Bypass Attempts:**
   ```javascript
   // Log bypass attempts
   chrome.management.onDisabled.addListener((info) => {
     if (info.id === extensionId) {
       logger.logSecurityEvent('extension_disabled_attempt', info);
     }
   });
   ```

#### User Complaints About False Positives

**Symptoms:**
- Users report legitimate text being flagged
- High frequency of PII warnings
- Users ignoring warnings

**Solutions:**

1. **Tune Confidence Thresholds:**
   ```json
   {
     "thresholds": {
       "NAME": 0.9,      // Increase for fewer false positives
       "ADDRESS": 0.85,
       "URL": 0.95       // URLs often cause false positives
     }
   }
   ```

2. **Disable Problematic Types:**
   ```json
   {
     "piiToggles": {
       "NAME": false,    // Often has false positives
       "URL": false,     // May be needed in AI contexts
       "UUID": false     // Technical users may need these
     }
   }
   ```

3. **Site-Specific Configuration:**
   ```json
   // Different settings for different sites
   {
     "sites": {
       "internal-ai.company.com": {
         "piiOverrides": {
           "enabledTypes": {
             "NAME": false  // Allow names on internal platform
           }
         }
       }
     }
   }
   ```

## Enterprise Environment Issues

### Network and Firewall

#### Extension Updates Failing

**Required Network Access:**
```
# Chrome Web Store
*.google.com:443
chrome.google.com:443
clients2.google.com:443

# Policy Distribution
*.googleapis.com:443
*.gstatic.com:443

# DNS Resolution
8.8.8.8:53 (Google DNS)
```

**Firewall Rules:**
```bash
# Allow HTTPS to Chrome services
iptables -A OUTPUT -d chrome.google.com -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -d clients2.google.com -p tcp --dport 443 -j ACCEPT
```

### SSO and Authentication Issues

#### Policy Not Loading with SSO

**Symptoms:**
- Policies work for non-SSO users
- SSO users don't get policies
- Inconsistent policy application

**Solutions:**
1. Verify Chrome sync settings with SSO
2. Check organizational unit mapping
3. Ensure proper Chrome enrollment post-SSO
4. Review SAML/OIDC attribute mapping

### Multi-Domain Environments

#### Cross-Domain Policy Issues

**Symptoms:**
- Different policies for different domains
- Users switching between domains
- Policy conflicts

**Solutions:**
1. Standardize policies across domains
2. Use domain-specific OUs
3. Implement policy inheritance carefully
4. Consider using parent domain policies

## Advanced Diagnostics

### Extension Debugging

#### Enable Debug Logging

```javascript
// In extension background script
console.log = (...args) => {
  chrome.storage.local.get(['debugLogs'], (result) => {
    const logs = result.debugLogs || [];
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'debug',
      message: args.join(' ')
    });
    chrome.storage.local.set({ debugLogs: logs.slice(-1000) });
  });
};
```

#### Performance Profiling

```javascript
// Profile PII detection performance
async function profileDetection(text) {
  const start = performance.now();
  
  performance.mark('detection-start');
  const result = await piiDetector.detectPII(text);
  performance.mark('detection-end');
  
  performance.measure('detection-time', 'detection-start', 'detection-end');
  
  const measure = performance.getEntriesByName('detection-time')[0];
  console.log(`Detection took ${measure.duration}ms for ${text.length} characters`);
  
  return result;
}
```

### Policy Validation Tools

#### Policy Testing Script

```javascript
// Test policy application
async function validatePolicy() {
  const managedPolicy = await chrome.storage.managed.get(null);
  const effectiveSettings = await settingsService.getSettings();
  
  console.log('Managed Policy:', managedPolicy);
  console.log('Effective Settings:', effectiveSettings);
  console.log('Locked Fields:', effectiveSettings._managedSettings?.lockedFields);
  
  // Test specific field locks
  const testFields = [
    'pii.enabledTypes.EMAIL',
    'timeout.processingTimeoutMs',
    'logging.enabled'
  ];
  
  testFields.forEach(field => {
    const isLocked = settingsService.isFieldLocked(field);
    console.log(`${field}: ${isLocked ? 'LOCKED' : 'unlocked'}`);
  });
}
```

## Support and Escalation

### Internal Support Process

1. **Level 1**: Basic troubleshooting (installation, basic functionality)
2. **Level 2**: Policy and configuration issues
3. **Level 3**: Complex enterprise integration issues
4. **Vendor Support**: Extension-specific bugs and feature requests

### Escalation Criteria

**Immediate Escalation:**
- Security policy bypass
- Data leakage incidents  
- System-wide performance impact
- Compliance violations

**Normal Escalation:**
- Persistent functionality issues
- Policy configuration problems
- Performance degradation
- User adoption challenges

### Documentation Requirements

For all support cases, collect:

1. **Environment Information:**
   - Chrome version and OS
   - Extension version
   - Enterprise enrollment status
   - Applied policies (`chrome://policy`)

2. **Issue Details:**
   - Exact error messages
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/recordings

3. **Logs and Diagnostics:**
   - Extension console logs
   - Network traces if relevant
   - Policy application logs
   - Performance measurements

### Emergency Procedures

#### Critical Security Issue

1. **Immediate Actions:**
   - Document the incident
   - Assess scope and impact
   - Implement temporary containment

2. **Containment Options:**
   ```json
   // Emergency lockdown policy
   {
     "locked": true,
     "disabledSites": ["*"],  // Disable everywhere
     "compliance": {
       "prohibitedSites": ["*"]
     }
   }
   ```

3. **Recovery Steps:**
   - Develop and test fix
   - Deploy updated policy/extension
   - Monitor for resolution
   - Conduct post-incident review

#### Mass Deployment Issues

1. **Rollback Policy:**
   ```json
   {
     "ExtensionInstallBlacklist": ["extension-id"]
   }
   ```

2. **Staged Recovery:**
   - Fix issues in test environment
   - Deploy to pilot group
   - Gradually expand deployment
   - Monitor at each stage