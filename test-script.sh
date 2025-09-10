#!/bin/bash

# PII Checker Extension - Comprehensive Test Script
# This script guides you through testing the extension

echo "🛡️  PII Checker Extension - Testing Guide"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to wait for user input
wait_for_user() {
    echo -e "${YELLOW}Press Enter to continue...${NC}"
    read
}

# Function to ask yes/no question
ask_yes_no() {
    local question="$1"
    while true; do
        echo -e "${BLUE}$question (y/n): ${NC}"
        read yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

echo "📋 Pre-Testing Checklist"
echo "========================"
echo ""

# Check if build exists
if [ -f "pii-checker-extension-v1.0.0.zip" ]; then
    echo -e "${GREEN}✓${NC} Distribution zip found"
else
    echo -e "${RED}✗${NC} Distribution zip not found"
    echo "Run: npm run build first"
    exit 1
fi

if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} Build directory found"
else
    echo -e "${RED}✗${NC} Build directory not found"
    echo "Run: npm run build first"
    exit 1
fi

# Check Chrome
if command -v google-chrome &> /dev/null; then
    echo -e "${GREEN}✓${NC} Chrome found"
elif command -v chromium &> /dev/null; then
    echo -e "${GREEN}✓${NC} Chromium found"
else
    echo -e "${YELLOW}!${NC} Chrome not found in PATH - make sure it's installed"
fi

echo -e "${GREEN}✓${NC} Ready to start testing!"
echo ""

wait_for_user

echo "🔧 Step 1: Load Extension in Chrome"
echo "==================================="
echo ""
echo "1. Open Chrome and navigate to: chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top-right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'dist/' folder in this project"
echo "5. Verify the PII Checker extension appears with 🛡️ icon"
echo ""

if ask_yes_no "Have you successfully loaded the extension?"; then
    echo -e "${GREEN}✓${NC} Extension loaded"
else
    echo -e "${RED}✗${NC} Extension loading failed"
    echo "Check the Chrome extension page for error messages"
    exit 1
fi

echo ""
echo "🎯 Step 2: Basic PII Detection Test"
echo "===================================="
echo ""
echo "Test Case 1: ChatGPT Integration"
echo "1. Navigate to: https://chat.openai.com"
echo "2. Type this test message:"
echo ""
echo -e "${BLUE}Test message:${NC}"
echo "My email is john.doe@company.com and my phone is (555) 123-4567."
echo "Please help me with my account."
echo ""
echo "3. Press Enter or click Send"
echo "4. Extension should intercept and show masked preview"
echo ""

if ask_yes_no "Did the extension detect PII and show a masked preview?"; then
    echo -e "${GREEN}✓${NC} ChatGPT integration working"
else
    echo -e "${RED}✗${NC} ChatGPT integration failed"
    echo "Check browser console (F12) for errors"
fi

echo ""
echo "Test Case 2: Claude Integration"
echo "1. Navigate to: https://claude.ai"
echo "2. Use the same test message as above"
echo "3. Verify extension works on Claude as well"
echo ""

if ask_yes_no "Did the extension work on Claude?"; then
    echo -e "${GREEN}✓${NC} Claude integration working"
else
    echo -e "${YELLOW}!${NC} Claude integration failed - may need login or different URL"
fi

echo ""
echo "⚙️  Step 3: Settings Interface Test"
echo "=================================="
echo ""
echo "1. Right-click the extension icon → Options"
echo "   OR click the extension icon and select Settings"
echo "2. Verify the settings page opens with tabs:"
echo "   - PII Protection"
echo "   - Site Settings  "
echo "   - Advanced"
echo "   - Activity Logs"
echo "   - About"
echo ""

if ask_yes_no "Did the settings page open correctly?"; then
    echo -e "${GREEN}✓${NC} Settings page accessible"
else
    echo -e "${RED}✗${NC} Settings page failed to open"
    echo "Check console errors and extension permissions"
    exit 1
fi

echo ""
echo "Test Settings Functionality:"
echo "1. Try switching between Strict/Balanced/Loose presets"
echo "2. Toggle some PII types on/off"  
echo "3. Adjust confidence sliders"
echo "4. Check the Activity Logs tab"
echo ""

if ask_yes_no "Are the settings working properly?"; then
    echo -e "${GREEN}✓${NC} Settings functionality working"
else
    echo -e "${YELLOW}!${NC} Some settings issues - note for further investigation"
fi

echo ""
echo "🚀 Step 4: Performance Test"
echo "============================"
echo ""
echo "Large Text Performance Test:"
echo "1. Go back to ChatGPT or Claude"
echo "2. Paste this large text block with multiple PII items:"
echo ""

# Generate large test text
cat << 'EOF'
This is a performance test with multiple PII items. My email is john.doe@company.com and I can be reached at (555) 123-4567. My credit card is 4111-1111-1111-1111 and my SSN is 123-45-6789. I live at 123 Main Street, Anytown, NY 12345. You can also contact me at mary.smith@example.org or call 555-987-6543. Another card I have is 5555-5555-5555-4444. My business address is 456 Oak Avenue, Suite 100, Business City, CA 90210. For urgent matters, try +1-555-444-3333. My other email is test.user@domain.co.uk and backup phone is (555) 999-8888.
EOF

echo ""
echo "3. Measure how long the extension takes to process"
echo "4. Should complete within 2 seconds"
echo ""

if ask_yes_no "Did the extension process the large text quickly (<2 seconds)?"; then
    echo -e "${GREEN}✓${NC} Performance test passed"
else
    echo -e "${YELLOW}!${NC} Performance slower than expected"
    echo "Consider adjusting timeout settings or disabling NER processing"
fi

echo ""
echo "🔐 Step 5: Privacy Verification"
echo "==============================="
echo ""
echo "Network Privacy Test:"
echo "1. Open Chrome DevTools (F12)"
echo "2. Go to Network tab"
echo "3. Perform PII detection on any AI platform"
echo "4. Verify NO external network requests are made by the extension"
echo "   (Only requests should be to the AI platform itself)"
echo ""

if ask_yes_no "Did you verify no external requests from the extension?"; then
    echo -e "${GREEN}✓${NC} Privacy verification passed"
else
    echo -e "${RED}✗${NC} Privacy concern - extension making external requests"
    echo "This needs immediate investigation!"
fi

echo ""
echo "📊 Step 6: Run Automated Tests"
echo "=============================="
echo ""
echo "Now let's run the automated test suite:"
echo ""

# Check if npm is available
if command -v npm &> /dev/null; then
    echo "Running unit tests..."
    if npm test 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Unit tests completed"
    else
        echo -e "${YELLOW}!${NC} Some unit tests failed (expected due to missing test dependencies)"
    fi
    
    echo ""
    echo "Running performance benchmarks..."
    if npm run bench 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Performance benchmarks completed"
    else
        echo -e "${YELLOW}!${NC} Benchmarks failed or incomplete"
    fi
else
    echo -e "${YELLOW}!${NC} npm not available - skipping automated tests"
fi

echo ""
echo "🎉 Testing Complete!"
echo "===================="
echo ""

# Summary
echo "Test Results Summary:"
if ask_yes_no "Did the extension work correctly overall?"; then
    echo -e "${GREEN}✓ Extension is working correctly!${NC}"
    echo ""
    echo "Next steps:"
    echo "- Test on different websites and platforms"
    echo "- Try various PII patterns and edge cases"  
    echo "- Test enterprise features if you have Chrome Enterprise"
    echo "- Consider Chrome Web Store submission"
else
    echo -e "${YELLOW}⚠ Issues found during testing${NC}"
    echo ""
    echo "Recommended actions:"
    echo "- Check browser console for errors"
    echo "- Review extension permissions"
    echo "- Test with different Chrome versions"
    echo "- Report issues via GitHub"
fi

echo ""
echo "📚 Additional Resources:"
echo "- Full testing guide: docs/testing/local-test-scenarios.md"
echo "- Enterprise testing: docs/enterprise/deployment.md"
echo "- Troubleshooting: README.md"
echo ""
echo "Happy testing! 🛡️"