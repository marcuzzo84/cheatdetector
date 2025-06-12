# FairPlay-Scout Extension - Local Testing Guide

## ✅ Build Status: SUCCESS

The extension has been successfully built and is ready for testing!

### 📁 Build Output Structure
```
dist/
├── manifest.json                 # Extension manifest (MV3)
├── background/
│   └── service-worker.js         # Background service worker
├── content/
│   └── content-script.js         # Content script for Chess sites
├── ui/
│   ├── popup.html               # Extension popup interface
│   ├── popup.css                # Popup styling
│   ├── popup.js                 # Popup functionality
│   └── icons/                   # Extension icons
└── shared/                      # Shared utilities
```

## 🚀 Loading the Extension in Chrome

### Step 1: Enable Developer Mode
1. Open Chrome and navigate to `chrome://extensions/`
2. Toggle "Developer mode" in the top-right corner
3. Click "Load unpacked"
4. Select the `src/extension/dist/` folder

### Step 2: Verify Installation
- Extension should appear in the extensions list
- FairPlay-Scout icon should be visible in the toolbar
- No errors should be displayed

## 🧪 Testing Checklist

### ✅ Basic Functionality
- [ ] Extension loads without errors
- [ ] Popup opens when clicking the icon
- [ ] All three tabs (Import, History, Settings) are accessible
- [ ] No console errors in popup

### ✅ Site Integration
- [ ] Visit Chess.com - import button should appear
- [ ] Visit Lichess - import button should appear
- [ ] Button detects current site correctly
- [ ] Username auto-detection works (if logged in)

### ✅ Import Functionality
- [ ] Import form validates input correctly
- [ ] Progress tracking works during import
- [ ] Error handling displays properly
- [ ] Success notifications appear

### ✅ Real-time Features
- [ ] WebSocket connection establishes
- [ ] Live score updates appear
- [ ] Connection status indicators work
- [ ] Reconnection logic functions

## 🔧 Development Testing

### Console Debugging
```javascript
// In popup console:
chrome.runtime.sendMessage({type: 'GET_SETTINGS'}, console.log)

// In background console:
console.log('Service worker active:', self.registration.active)
```

### Network Monitoring
- Check Network tab for API calls
- Verify WebSocket connections
- Monitor rate limiting behavior

### Storage Inspection
```javascript
// Check extension storage:
chrome.storage.local.get(null, console.log)
```

## 🐛 Common Issues & Solutions

### Issue: Extension won't load
**Solution**: Check manifest.json syntax and file paths

### Issue: Content script not injecting
**Solution**: Verify host permissions in manifest

### Issue: API calls failing
**Solution**: Check CORS headers and authentication

### Issue: WebSocket not connecting
**Solution**: Verify WebSocket URL and authentication

## 📊 Performance Monitoring

### Memory Usage
- Monitor background script memory consumption
- Check for memory leaks in long-running connections

### Network Efficiency
- Verify rate limiting compliance
- Monitor API quota usage
- Check WebSocket connection stability

## 🔒 Security Verification

### Content Security Policy
- No inline scripts or styles
- All resources properly declared
- External connections whitelisted

### Permission Audit
- Minimal required permissions
- No unnecessary host access
- Secure token handling

## 📦 Packaging for Distribution

### Before Publishing
1. Test on multiple Chrome versions
2. Verify on different operating systems
3. Test with various Chess.com/Lichess accounts
4. Validate all error scenarios

### Build for Production
```bash
cd src/extension
npm run build
cd dist && zip -r ../fairplay-scout-extension.zip .
```

## 🎯 Next Steps

1. **Load the extension** in Chrome developer mode
2. **Test basic functionality** on Chess.com and Lichess
3. **Verify import process** with a test account
4. **Monitor console** for any errors or warnings
5. **Test real-time features** with live data

The extension is now ready for comprehensive testing! 🚀