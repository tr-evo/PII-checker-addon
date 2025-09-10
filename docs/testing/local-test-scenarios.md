# Local Testing Scenarios

## Test Cases for Manual Verification

### 1. PII Detection Accuracy Tests

**Email Addresses:**
```
Valid emails to test:
- john.doe@company.com
- test.email+tag@domain.co.uk  
- user123@sub.domain.org
- firstname.lastname@enterprise-domain.com

Should NOT detect:
- not-an-email-address
- incomplete@
- @domain.com
```

**Phone Numbers:**
```
Valid phones to test:
- (555) 123-4567
- 555-123-4567
- +1-555-123-4567
- 5551234567

Should NOT detect:
- 123 (too short)
- random numbers in text
```

**Credit Cards:**
```
Valid test cards (Luhn valid):
- 4111111111111111 (Visa)
- 5555555555554444 (Mastercard)  
- 378282246310005 (Amex)

Should NOT detect:
- Random 16-digit numbers that fail Luhn check
- Short number sequences
```

**Names (ML-based, may have false positives):**
```
Common names to test:
- John Smith
- Mary Johnson
- Robert Williams
- Jennifer Brown

May incorrectly detect:
- Common words that look like names
- Brand names, place names
```

### 2. User Interface Tests

**Settings Persistence:**
1. Change settings in options page
2. Close and reopen options
3. Verify settings are saved
4. Test across browser restarts

**Real-time Updates:**
1. Change confidence threshold
2. Test immediately on AI platform
3. Verify detection sensitivity changes

**Cross-tab Functionality:**
1. Open multiple tabs with ChatGPT/Claude
2. Verify extension works in all tabs
3. Test simultaneous usage

### 3. Performance Tests

**Large Text Processing:**
```javascript
// Test with large text blocks
const largeText = `
This is a large block of text with multiple PII items scattered throughout.
My email is john.doe@company.com and I can be reached at (555) 123-4567.
My credit card number is 4111-1111-1111-1111 and my SSN is 123-45-6789.
I live at 123 Main Street, Anytown, NY 12345.
You can also contact me at mary.smith@example.org or call 555-987-6543.
Another card I have is 5555-5555-5555-4444 for backup payments.
My business address is 456 Oak Avenue, Suite 100, Business City, CA 90210.
For urgent matters, try my other number: +1-555-444-3333.
`.repeat(10); // Repeat to make it large

// Paste this into ChatGPT and verify performance
```

**Timeout Testing:**
1. Set processing timeout to 1 second (minimum)
2. Test with large text blocks
3. Verify timeout behavior (should allow/block/prompt based on settings)

### 4. Edge Case Testing

**Empty/Invalid Input:**
- Empty text areas
- Only spaces or special characters
- Very long single words
- Unicode characters and emojis

**Form Variations:**
- Different input types (textarea, contenteditable)
- Multiple forms on same page
- Dynamically created forms
- Forms with rich text editors

**Browser Edge Cases:**
- Browser zoom levels (50%, 200%)
- Different window sizes
- Incognito mode
- Multiple Chrome profiles

### 5. Enterprise Features Testing

**Note: These require Chrome Enterprise setup or mock policies**

**Policy Simulation:**
1. Manually test locked settings UI
2. Verify enterprise notice appears
3. Test field-level locking behavior

**Audit Logging:**
1. Enable comprehensive logging
2. Perform various PII detection activities
3. Export logs and verify content
4. Test log retention and cleanup

### 6. Error Handling Tests

**Network Disruption:**
1. Disconnect internet during usage
2. Verify extension continues working offline
3. Test model loading scenarios

**Resource Constraints:**
1. Open many browser tabs (memory pressure)
2. Test with low-end device simulation (Chrome DevTools)
3. Verify graceful degradation

**Malformed Content:**
1. Test with unusual HTML structures
2. Verify injection into complex web apps
3. Test with single-page applications (SPAs)

### 7. Privacy Verification

**No External Network Calls:**
1. Open Chrome DevTools → Network tab
2. Perform PII detection activities  
3. Verify NO external requests are made
4. Confirm all processing is local

**Data Storage Verification:**
1. Check Chrome storage contents:
   - Go to `chrome://extensions/`
   - Click "Details" on PII Checker
   - Click "Extension options" → "Storage"
   - Verify only settings/logs are stored, no PII content

**Memory Inspection:**
1. Chrome DevTools → Memory tab
2. Take heap snapshots before/after PII detection
3. Verify no PII content remains in memory
4. Check for memory leaks during repeated usage

## Testing Checklist

### Basic Functionality ✓
- [ ] Extension loads without errors
- [ ] Icon appears in toolbar
- [ ] Settings page opens correctly
- [ ] PII detection works on ChatGPT
- [ ] PII detection works on Claude
- [ ] Masking preview appears correctly
- [ ] User can approve/reject masking

### PII Detection Accuracy ✓
- [ ] Email addresses detected correctly
- [ ] Phone numbers detected correctly  
- [ ] Credit cards detected correctly
- [ ] SSNs detected correctly
- [ ] Names detected (with expected false positives)
- [ ] Addresses detected correctly
- [ ] False positive rate acceptable

### Settings & Configuration ✓
- [ ] Presets change detection behavior
- [ ] Individual PII toggles work
- [ ] Confidence sliders affect detection
- [ ] Site-specific settings work
- [ ] Settings persist across sessions
- [ ] Import/export settings works

### Performance ✓
- [ ] Detection completes within 2 seconds
- [ ] No UI blocking during processing
- [ ] Memory usage stays reasonable (<50MB)
- [ ] Works with large text blocks
- [ ] Timeout handling works correctly

### Privacy & Security ✓
- [ ] No external network requests
- [ ] No PII stored in logs/settings
- [ ] Local processing only
- [ ] Secure storage APIs used
- [ ] Extension permissions minimal

### Cross-Platform ✓
- [ ] Works on Windows Chrome
- [ ] Works on macOS Chrome  
- [ ] Works on Linux Chrome
- [ ] Compatible with Chrome 88+
- [ ] Works in incognito mode

### Error Handling ✓
- [ ] Graceful fallbacks for errors
- [ ] No console errors during normal use
- [ ] Handles malformed web pages
- [ ] Recovers from processing failures

## Troubleshooting Common Issues

**Extension Not Loading:**
```bash
# Check console for errors
# In Chrome DevTools → Console
# Look for extension-related errors

# Verify manifest.json is valid
cat dist/manifest.json | jq .
```

**PII Not Being Detected:**
1. Check confidence thresholds (lower = more sensitive)
2. Verify PII types are enabled in settings
3. Test with known-good PII examples
4. Check browser console for JavaScript errors

**Performance Issues:**
1. Disable NER processing (keep regex only)
2. Reduce number of enabled PII types
3. Increase processing timeout
4. Check available browser memory

**Settings Not Saving:**
1. Verify Chrome storage permissions
2. Check browser storage quotas
3. Test in incognito mode
4. Clear extension data and reconfigure

## Reporting Issues

If you find bugs during testing:

1. **Gather Information:**
   - Chrome version (`chrome://version/`)
   - Extension version (from settings)
   - Operating system
   - Exact steps to reproduce
   - Expected vs actual behavior

2. **Console Logs:**
   - Open Chrome DevTools → Console
   - Reproduce the issue
   - Copy any error messages

3. **Create Issue:**
   - Use GitHub Issues template
   - Include all gathered information
   - Add screenshots if helpful
   - Label appropriately (bug, enhancement, etc.)

## Performance Benchmarking

For detailed performance analysis:

```bash
# Run automated benchmarks
npm run bench

# Memory-specific benchmarks
npm run bench:memory

# Performance-specific benchmarks  
npm run bench:performance
```

This provides quantitative performance metrics to compare against our targets.